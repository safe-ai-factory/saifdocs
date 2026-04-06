import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { MANIFEST_FILENAME } from '../constants.js';
import type { ManifestDocument } from './types.js';

export async function writeManifestToDocspec(
  docspecDir: string,
  manifest: ManifestDocument,
): Promise<string> {
  const target = join(docspecDir, MANIFEST_FILENAME);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return target;
}

export function serializeManifest(manifest: ManifestDocument): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
