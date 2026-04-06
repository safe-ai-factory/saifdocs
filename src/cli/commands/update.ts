/**
 * `saifdocs update` — incremental regen after docspec (or read-list) changes.
 *
 * Flow: load `.manifest.json` → same staleness rules as `validate` (mtime of any `read` path
 * vs `generatedAt`) → run sandbox only for stale entry ids (`onlyEntryIds`), keeping the full
 * manifest so untouched rows keep their timestamps. Does not rebuild the manifest from docspec;
 * run `gen` when the manifest structure or `read` lists need to change.
 */
import { resolve } from 'node:path';

import { sandboxPassthroughArgs } from '@safe-ai-factory/saifctl';
import { defineCommand } from 'citty';

import { DEFAULT_GATE_RETRIES } from '../../constants.js';
import { consola } from '../../logger.js';
import {
  allowMissingManifestArg,
  cliBooleanTrue,
  docspecDirArg,
  dryRunArg,
  outputDirArg,
  parseOutputTypes,
  projectDirArg,
  saifctlConfigArg,
  saifctlDirArg,
  typesArg,
} from '../args.js';
import { readSandboxPassthroughFromCittyArgs } from '../sandbox.js';
import { runUpdateCore } from '../update-core.js';

const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description:
      'Regenerate only manifest entries whose read inputs are newer than generatedAt (see validate)',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'project-dir': projectDirArg,
    types: typesArg,
    'saifctl-config': saifctlConfigArg,
    'saifctl-dir': saifctlDirArg,
    'dry-run': dryRunArg,
    'allow-missing-manifest': allowMissingManifestArg,
    ...sandboxPassthroughArgs,
  },
  async run({ args }) {
    const cwd = process.cwd();
    // Paths must match what was used for `gen` so manifest `read`/`output` and extract prefix align.
    const docspecDir = resolve(cwd, args['docspec-dir'] ?? 'docspec');
    const outputDir = resolve(cwd, args['output-dir'] ?? 'docs');
    const projectDir = resolve(cwd, args['project-dir'] ?? '.');

    // Mirrors `gen --types`; limits which manifest rows are checked for staleness and regen.
    let types;
    try {
      types = parseOutputTypes(args.types);
    } catch (e) {
      consola.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    // String passed through; `runUpdateCore` validates (only after stale + non–dry-run).
    const gateRetriesRaw =
      typeof args['gate-retries'] === 'string'
        ? args['gate-retries'].trim()
        : String(DEFAULT_GATE_RETRIES);
    const sandboxPassthrough = readSandboxPassthroughFromCittyArgs(args as Record<string, unknown>);

    const result = await runUpdateCore({
      docspecDir,
      outputDir,
      projectDir,
      types,
      dryRun: cliBooleanTrue(args as Record<string, unknown>, 'dry-run', 'dryRun'),
      allowMissingManifest: cliBooleanTrue(
        args as Record<string, unknown>,
        'allow-missing-manifest',
        'allowMissingManifest',
      ),
      gateRetries: gateRetriesRaw,
      saifctlConfig:
        typeof args['saifctl-config'] === 'string' ? args['saifctl-config'] : undefined,
      saifctlDir: typeof args['saifctl-dir'] === 'string' ? args['saifctl-dir'] : 'saifctl',
      sandboxPassthrough,
      // Log before sandbox work starts; `generateEntries` already logs per entry.
      onRegenerating: (n) => consola.info(`[update] Regenerating ${n} stale page(s)…`),
    });

    // Exit codes: 0 ok, 1 user/config or sandbox failure, 2 manifest missing or unreadable.
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
        consola.info(`[update] Dry run: would regenerate ${result.stale.length} page(s):`);
        for (const s of result.stale) {
          consola.info(`  - ${s.id}`);
          for (const p of s.staleInputs) {
            consola.info(`      ${p}`);
          }
        }
        process.exit(0);
        break;
      case 'invalid-gate-retries':
        consola.error(`Invalid --gate-retries: ${result.raw} (expected positive integer)`);
        process.exit(1);
        break;
      case 'generate-failed':
        // Errors already logged inside `generateEntries` / sandbox.
        process.exit(1);
        break;
      case 'success':
        consola.success(`[update] Done. ${result.summary.succeeded} page(s) regenerated.`);
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
