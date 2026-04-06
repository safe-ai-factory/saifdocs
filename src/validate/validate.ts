import { stat } from 'node:fs/promises';

import type { ManifestDocument, OutputType } from '../manifest/types.js';

export type StaleEntry = {
  id: string;
  output: string;
  /** ISO timestamp of the most recently modified stale input path. */
  staleSince: string;
  /** Paths under `read` that are newer than `generatedAt`. */
  staleInputs: string[];
};

export type ValidateResult = {
  stale: StaleEntry[];
  upToDate: number;
  /** Entries with `generatedAt === null` (never generated). */
  skipped: number;
};

function settingsIncludeType(types: OutputType[] | 'all', t: OutputType): boolean {
  if (types === 'all') return true;
  return types.includes(t);
}

async function statMtimeMs(path: string): Promise<number | null> {
  try {
    const s = await stat(path);
    return s.mtimeMs;
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
 * Compare each entry's `read` paths to `generatedAt`. If any existing file's mtime is strictly
 * after `generatedAt`, the entry is stale. Missing `read` files are ignored (do not cause staleness).
 * Entries with `generatedAt === null` are counted as `skipped`, not stale.
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
    if (!settingsIncludeType(types, entry.type)) continue;

    if (entry.generatedAt === null) {
      skipped++;
      continue;
    }

    const generatedMs = Date.parse(entry.generatedAt);
    if (Number.isNaN(generatedMs)) {
      stale.push({
        id: entry.id,
        output: entry.output,
        staleSince: new Date(0).toISOString(),
        staleInputs: ['(invalid generatedAt on manifest entry)'],
      });
      continue;
    }

    const staleInputs: string[] = [];
    let maxStaleMtime = 0;

    // Get filesystem mtime of each `read` path.
    for (const p of entry.read) {
      const mtimeMs = await statMtimeMs(p);
      if (mtimeMs === null) continue;
      if (mtimeMs > generatedMs) {
        staleInputs.push(p);
        if (mtimeMs > maxStaleMtime) maxStaleMtime = mtimeMs;
      }
    }

    if (staleInputs.length > 0) {
      stale.push({
        id: entry.id,
        output: entry.output,
        staleSince: new Date(maxStaleMtime).toISOString(),
        staleInputs,
      });
    } else {
      upToDate++;
    }
  }

  return { stale, upToDate, skipped };
}
