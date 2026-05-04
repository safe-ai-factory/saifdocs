/**
 * `saifdocs update` — incremental regen after docspec (or read-list) changes.
 *
 * Flow: load `.manifest.json` → same staleness rules as `validate` (mtime of
 * any `read` path vs `generatedAt`) → emit a saifctl feature tree containing
 * **only** the stale phases (so `saifctl feat run` regenerates just those).
 * Does not rebuild the manifest from docspec; run `gen` when the manifest
 * structure or `read` lists need to change.
 *
 * Saifdocs no longer orchestrates the regen run itself — the user runs
 * `saifctl feat run --feature <id>` after this command emits the feature.
 */
import { resolve } from 'node:path';

import { defineCommand } from 'citty';

import { consola } from '../../logger.js';
import {
  allowMissingManifestArg,
  cliBooleanTrue,
  docspecDirArg,
  dryRunArg,
  entryArg,
  featureIdArg,
  outputDirArg,
  parseOutputTypes,
  projectDirArg,
  saifctlFeaturesDirArg,
  typesArg,
} from '../args.js';
import { runUpdateCore } from '../update-core.js';

const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description:
      'Emit a saifctl feature tree containing only the stale entries (per validate). Use --entry to force one page. Run `saifctl feat run --feature <id>` afterwards.',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'project-dir': projectDirArg,
    'saifctl-features-dir': saifctlFeaturesDirArg,
    'feature-id': featureIdArg,
    entry: entryArg,
    types: typesArg,
    'dry-run': dryRunArg,
    'allow-missing-manifest': allowMissingManifestArg,
  },
  async run({ args }) {
    const cwd = process.cwd();
    // Paths must match what was used for `gen` so manifest `read`/`output`
    // paths still resolve correctly for staleness checks.
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

    // Mirrors `gen --types`; limits which manifest rows are checked for staleness.
    let types;
    try {
      types = parseOutputTypes(args.types);
    } catch (e) {
      consola.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    const entryRaw = args.entry;
    const entry =
      typeof entryRaw === 'string' && entryRaw.trim() !== '' ? entryRaw.trim() : undefined;

    const result = await runUpdateCore({
      docspecDir,
      outputDir,
      projectDir,
      saifctlFeaturesDir,
      types,
      ...(featureIdOverride ? { featureId: featureIdOverride } : {}),
      ...(entry ? { entry } : {}),
      dryRun: cliBooleanTrue(args as Record<string, unknown>, 'dry-run', 'dryRun'),
      allowMissingManifest: cliBooleanTrue(
        args as Record<string, unknown>,
        'allow-missing-manifest',
        'allowMissingManifest',
      ),
      // Log before compile starts.
      onRegenerating: (n) => consola.info(`[update] Emitting feature for ${n} stale page(s)…`),
    });

    // Exit codes: 0 ok, 1 user/config or compile failure, 2 manifest missing or unreadable.
    switch (result.kind) {
      case 'read-manifest-failed':
        consola.error(result.message);
        process.exit(2);
        break;
      case 'missing-manifest-error':
        consola.error(`[update] No manifest at ${docspecDir}/.manifest.json`);
        process.exit(2);
        break;
      case 'missing-manifest-skipped':
        consola.info('[update] No manifest found; nothing to update (--allow-missing-manifest).');
        process.exit(0);
        break;
      case 'nothing-to-update':
        consola.success('[update] Nothing to update (no stale entries in scope).');
        process.exit(0);
        break;
      case 'dry-run':
        consola.info(`[update] Dry run: would emit feature for ${result.stale.length} page(s):`);
        for (const s of result.stale) {
          consola.info(`  - ${s.id}`);
          for (const p of s.staleInputs) {
            consola.info(`      ${p}`);
          }
        }
        process.exit(0);
        break;
      case 'compile-failed':
        consola.error(`[update] Compile failed: ${result.message}`);
        process.exit(1);
        break;
      case 'entry-not-found':
        consola.error(
          `[update] No manifest entry matches --entry ${JSON.stringify(result.selector)} (use manifest id or a unique suffix of the output path).`,
        );
        process.exit(1);
        break;
      case 'entry-ambiguous':
        consola.error(
          `[update] --entry ${JSON.stringify(result.selector)} matches multiple outputs; use a longer path suffix or the manifest id:`,
        );
        for (const id of result.candidates) {
          consola.error(`  - ${id}`);
        }
        process.exit(1);
        break;
      case 'entry-excluded-by-types':
        consola.error(
          `[update] --entry ${JSON.stringify(result.entryId)} has type "${result.entryType}" but --types is ${result.types.join(',')} (use "all" or include "${result.entryType}").`,
        );
        process.exit(1);
        break;
      case 'success':
        consola.success(
          `[update] Emitted feature: ${result.result.featureId} (${result.result.phases.length} phase(s)) at ${result.result.featureDir}`,
        );
        consola.info(`[update] Next step: saifctl feat run --feature ${result.result.featureId}`);
        process.exit(0);
        break;
      default: {
        const _exhaustive: never = result;
        void _exhaustive;
        process.exit(1);
      }
    }
  },
});

export default updateCommand;
