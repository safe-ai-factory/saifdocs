import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { ManifestDocument, ManifestEntry } from './types.js';

/**
 * SHA-256 hex digest of the file's bytes, or `null` if the file does not exist.
 * Re-throws other I/O errors so they surface to the caller.
 */
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
 * Returns a copy of `manifest` where each entry's `outputHash` and
 * `inputHashes` reflect the SHA-256 of the corresponding files on disk.
 * `generatedAt` is set to the current ISO time as informational metadata.
 *
 * Hashes are content-based (not mtime-based) so staleness detection survives
 * fresh CI checkouts, file copies, tar extracts, and any other transport that
 * resets filesystem mtimes. Missing files contribute `null` (the validate
 * command treats missing `read` files as "ignored", matching the original
 * mtime-based behaviour; missing `output` files mark the entry as stale).
 */
export async function populateHashesFromFiles(
  manifest: ManifestDocument,
): Promise<ManifestDocument> {
  const now = new Date().toISOString();
  const entries: ManifestEntry[] = await Promise.all(
    manifest.entries.map(async (entry) => {
      const [outputHash, inputHashes] = await Promise.all([
        hashFile(entry.output),
        Promise.all(entry.read.map((p) => hashFile(p))),
      ]);
      return {
        ...entry,
        // Only stamp generatedAt when there's actually a generated output to
        // anchor it to; otherwise null preserves "never generated" semantics.
        generatedAt: outputHash !== null ? now : null,
        outputHash,
        inputHashes,
      };
    }),
  );
  return { ...manifest, entries };
}
