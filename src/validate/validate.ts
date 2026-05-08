import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { ManifestDocument, OutputType } from '../manifest/types.js';

export type StaleEntry = {
  id: string;
  output: string;
  /**
   * ISO timestamp of when hashes were last populated for this entry, or the
   * epoch when no prior gen has run. Useful for "how long has this been stale"
   * reporting; not used by the staleness decision itself.
   */
  staleSince: string;
  /**
   * Paths whose current SHA-256 differs from the one recorded in the manifest,
   * or synthetic reasons such as `(never generated)` / `(output file missing)`.
   */
  staleInputs: string[];
};

export type ValidateResult = {
  stale: StaleEntry[];
  upToDate: number;
  /** Entries excluded by `types` filter (not checked for staleness). */
  skipped: number;
};

function settingsIncludeType(types: OutputType[] | 'all', t: OutputType): boolean {
  if (types === 'all') return true;
  return types.includes(t);
}

async function hashFile(path: string): Promise<string | null> {
  try {
    const bytes = await readFile(path);
    return createHash('sha256').update(bytes).digest('hex');
  } catch (e) {
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    throw e;
  }
}

/**
 * Compare each entry's `read` and `output` hashes against the values recorded
 * in the manifest. An entry is stale when:
 *
 *   - `outputHash === null` or `inputHashes === null` (never generated)
 *   - the output file is missing
 *   - the current output hash differs from the recorded one
 *   - the current hash of any `read` path differs from the recorded one
 *
 * Missing `read` files (current hash is `null`) are ignored — matching the
 * pre-hash mtime-based behaviour where missing reads did not cause staleness.
 *
 * Hash-based comparison is filesystem-independent: it survives fresh CI
 * checkouts, file copies, tar extracts, and anything else that resets mtimes.
 */
export async function validateManifest(
  manifest: ManifestDocument,
  options?: { types?: OutputType[] | 'all' },
): Promise<ValidateResult> {
  const types = options?.types ?? 'all';
  const stale: StaleEntry[] = [];
  let upToDate = 0;
  let skipped = 0;

  for (const entry of manifest.entries) {
    if (!settingsIncludeType(types, entry.type)) {
      skipped++;
      continue;
    }

    const epochIso = new Date(0).toISOString();
    const recordedSince = entry.generatedAt ?? epochIso;

    if (entry.outputHash === null || entry.inputHashes === null) {
      stale.push({
        id: entry.id,
        output: entry.output,
        staleSince: epochIso,
        staleInputs: ['(never generated)'],
      });
      continue;
    }

    if (entry.inputHashes.length !== entry.read.length) {
      // Manifest written by an earlier gen that saw a different read list —
      // treat as stale to force a fresh hash sweep.
      stale.push({
        id: entry.id,
        output: entry.output,
        staleSince: recordedSince,
        staleInputs: ['(read list changed since last gen)'],
      });
      continue;
    }

    const currentOutputHash = await hashFile(entry.output);
    if (currentOutputHash === null) {
      stale.push({
        id: entry.id,
        output: entry.output,
        staleSince: recordedSince,
        staleInputs: ['(output file missing)'],
      });
      continue;
    }

    const staleInputs: string[] = [];
    if (currentOutputHash !== entry.outputHash) {
      staleInputs.push('(output file modified externally)');
    }

    for (let i = 0; i < entry.read.length; i++) {
      const readPath = entry.read[i]!;
      const recordedHash = entry.inputHashes[i] ?? null;
      const currentHash = await hashFile(readPath);
      // Missing input files are ignored (matches the prior mtime-based
      // behaviour). They neither cause staleness nor up-to-date counts.
      if (currentHash === null) continue;
      // First time we've seen this input — treat as a change.
      if (recordedHash === null) {
        staleInputs.push(readPath);
        continue;
      }
      if (currentHash !== recordedHash) {
        staleInputs.push(readPath);
      }
    }

    if (staleInputs.length > 0) {
      stale.push({
        id: entry.id,
        output: entry.output,
        staleSince: recordedSince,
        staleInputs,
      });
    } else {
      upToDate++;
    }
  }

  return { stale, upToDate, skipped };
}
