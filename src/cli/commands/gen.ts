/**
 * `saifdocs gen` — emit a saifctl feature tree from docspec.
 *
 *   1. Read docspec → build manifest
 *   2. Write the manifest to `<docspec>/.manifest.json` (staleness tracking)
 *   3. Emit a saifctl feature tree under `<saifctl-features-dir>/<feature-id>/`
 *      with one phase per file-to-generate.
 *   4. Exit. The user (or CI) runs `saifctl feat run --feature <id>` next.
 */
import { resolve } from 'node:path';

import { defineCommand } from 'citty';

import { DocspecError } from '../../docspec/errors.js';
import { readDocspec } from '../../docspec/reader.js';
import { compileManifestToFeatureTree } from '../../features/compiler.js';
import { consola } from '../../logger.js';
import { buildManifest } from '../../manifest/builder.js';
import type { GenSettings } from '../../manifest/types.js';
import { serializeManifest, writeManifestToDocspec } from '../../manifest/writer.js';
import {
  docspecDirArg,
  dryRunArg,
  exportManifestOutArg,
  exportManifestStdoutArg,
  featureIdArg,
  outputDirArg,
  parseOutputTypes,
  projectDirArg,
  resolveExportManifestOutPath,
  saifctlFeaturesDirArg,
  typesArg,
} from '../args.js';

const genCommand = defineCommand({
  meta: {
    name: 'gen',
    description:
      'Compile docspec into a saifctl feature tree. Run `saifctl feat run --feature <id>` afterwards to generate the docs.',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'project-dir': projectDirArg,
    'saifctl-features-dir': saifctlFeaturesDirArg,
    'feature-id': featureIdArg,
    types: typesArg,
    'export-manifest': exportManifestStdoutArg,
    'export-manifest-out': exportManifestOutArg,
    'dry-run': dryRunArg,
  },
  async run({ args }) {
    const cwd = process.cwd();
    const docspecDir = resolve(cwd, args['docspec-dir'] ?? 'docspec');
    const outputDir = resolve(cwd, args['output-dir'] ?? 'docs');
    const projectDir = resolve(cwd, args['project-dir'] ?? '.');
    const saifctlFeaturesDir = resolve(
      cwd,
      typeof args['saifctl-features-dir'] === 'string' && args['saifctl-features-dir'].length > 0
        ? args['saifctl-features-dir']
        : resolve(projectDir, 'saifctl', 'features'),
    );
    const featureIdOverride =
      typeof args['feature-id'] === 'string' && args['feature-id'].length > 0
        ? args['feature-id']
        : undefined;

    let types;
    try {
      types = parseOutputTypes(args.types);
    } catch (e) {
      consola.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    const exportStdout = args['export-manifest'] === true;
    const exportOut = resolveExportManifestOutPath(
      typeof args['export-manifest-out'] === 'string' ? args['export-manifest-out'] : undefined,
    );

    const settings: GenSettings = {
      docspecDir,
      outputDir,
      projectDir,
      types,
      dryRun: args['dry-run'] === true,
    };

    let manifest;
    try {
      const parsed = await readDocspec(docspecDir);
      manifest = buildManifest(parsed, settings);
    } catch (e) {
      if (e instanceof DocspecError) {
        consola.error(e.message);
        process.exit(1);
      }
      throw e;
    }

    const written = await writeManifestToDocspec(docspecDir, manifest);
    consola.success(`Wrote manifest: ${written}`);

    if (settings.dryRun) {
      consola.info('[gen] Dry run: would emit feature tree (skipped).');
    } else {
      try {
        const result = await compileManifestToFeatureTree({
          manifest,
          saifctlFeaturesDir,
          projectDir,
          types,
          ...(featureIdOverride ? { featureId: featureIdOverride } : {}),
        });
        consola.success(
          `[gen] Emitted feature: ${result.featureId} (${result.phases.length} phase(s)) at ${result.featureDir}`,
        );
        consola.info(`[gen] Next step: saifctl feat run --feature ${result.featureId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        consola.error(`[gen] Compile failed: ${msg}`);
        process.exit(1);
      }
    }

    if (exportStdout || exportOut === 'stdout') {
      process.stdout.write(serializeManifest(manifest));
    }
    if (typeof exportOut === 'string' && exportOut !== 'stdout') {
      const { writeFile } = await import('node:fs/promises');
      const outPath = resolve(cwd, exportOut);
      await writeFile(outPath, serializeManifest(manifest), 'utf8');
      consola.success(`Exported manifest: ${outPath}`);
    }
  },
});

export default genCommand;
