import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { MANIFEST_FILENAME, MANIFEST_VERSION } from '../constants.js';
import type { ManifestDocument, ManifestEntry } from './types.js';

const OutputTypeSchema = z.enum([
  'references',
  'concepts',
  'how-tos',
  'tutorials',
  'landing-pages',
]);

const ManifestEntrySchema: z.ZodType<ManifestEntry> = z.object({
  id: z.string(),
  type: OutputTypeSchema,
  output: z.string(),
  read: z.array(z.string()),
  productId: z.string().nullable(),
  personaId: z.string().nullable(),
  taskId: z.string().nullable(),
  conceptId: z.string().nullable(),
  tutorialPosition: z.number().int().positive().nullable(),
  tutorialThreadLength: z.number().int().positive().nullable(),
  generatedAt: z.string().nullable(),
});

export const ManifestDocumentSchema: z.ZodType<ManifestDocument> = z.object({
  version: z.number().int(),
  createdAt: z.string(),
  docspecDir: z.string(),
  outputDir: z.string(),
  projectDir: z.string(),
  entries: z.array(ManifestEntrySchema),
});

/**
 * Read and parse `docspec/.manifest.json`. Returns `null` if the file does not exist.
 * Throws if the file exists but is invalid JSON or fails schema validation.
 */
export async function readManifestFromDocspec(
  docspecDir: string,
): Promise<ManifestDocument | null> {
  const target = join(docspecDir, MANIFEST_FILENAME);
  try {
    const raw = await readFile(target, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const result = ManifestDocumentSchema.safeParse(parsed);
    if (!result.success) {
      const msg = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Invalid manifest at ${target}: ${msg}`);
    }
    if (result.data.version !== MANIFEST_VERSION) {
      throw new Error(
        `Unsupported manifest version ${result.data.version} at ${target} (expected ${MANIFEST_VERSION})`,
      );
    }
    return result.data;
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
