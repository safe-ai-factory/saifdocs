import { stat } from 'node:fs/promises';

import type { ManifestDocument, ManifestEntry } from './types.js';

async function statMtimeIso(path: string): Promise<string | null> {
  try {
    const s = await stat(path);
    return new Date(s.mtimeMs).toISOString();
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
 * Returns a copy of `manifest` where each entry's `generatedAt` is set to the
 * mtime of its `output` file (ISO 8601), or `null` if the file does not exist.
 *
 * The manifest builder always emits `generatedAt: null`; the field is meant to
 * be filled in from disk state after the docs have actually been written.
 * Callers (`gen`, `update`, `clear`, `audit`) run this helper to reconcile the
 * manifest with what's on disk — the `validate` command then has a meaningful
 * timestamp to compare input mtimes against.
 */
export async function populateGeneratedAtFromOutputs(
  manifest: ManifestDocument,
): Promise<ManifestDocument> {
  const entries: ManifestEntry[] = await Promise.all(
    manifest.entries.map(async (entry) => ({
      ...entry,
      generatedAt: await statMtimeIso(entry.output),
    })),
  );
  return { ...manifest, entries };
}
