import { resolve } from 'node:path';

import { sandboxPassthroughArgs } from '@safe-ai-factory/saifctl';
import { defineCommand } from 'citty';

import { DocspecError } from '../../docspec/errors.js';
import { readDocspec } from '../../docspec/reader.js';
import { generateEntries } from '../../generation/generate.js';
import { consola } from '../../logger.js';
import { buildManifest } from '../../manifest/builder.js';
import type { GenSettings } from '../../manifest/types.js';
import { serializeManifest, writeManifestToDocspec } from '../../manifest/writer.js';
import { DEFAULT_GATE_RETRIES } from '../../constants.js';
import {
  docspecDirArg,
  dryRunArg,
  exportManifestOutArg,
  exportManifestStdoutArg,
  outputDirArg,
  parseOutputTypes,
  projectDirArg,
  resolveExportManifestOutPath,
  saifctlConfigArg,
  saifctlDirArg,
  typesArg,
} from '../args.js';
import { readSandboxPassthroughFromCittyArgs } from '../sandbox.js';

const genCommand = defineCommand({
  meta: {
    name: 'gen',
    description:
      'Resolve docspec, write manifest, and generate docs (references, concepts, how-tos, tutorials, landing-pages via saifctl sandbox)',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'project-dir': projectDirArg,
    types: typesArg,
    'export-manifest': exportManifestStdoutArg,
    'export-manifest-out': exportManifestOutArg,
    'saifctl-config': saifctlConfigArg,
    'saifctl-dir': saifctlDirArg,
    'dry-run': dryRunArg,
    ...sandboxPassthroughArgs,
  },
  async run({ args }) {
    const cwd = process.cwd();
    const docspecDir = resolve(cwd, args['docspec-dir'] ?? 'docspec');
    const outputDir = resolve(cwd, args['output-dir'] ?? 'docs');
    const projectDir = resolve(cwd, args['project-dir'] ?? '.');

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

    const gateRetriesRaw =
      typeof args['gate-retries'] === 'string'
        ? args['gate-retries'].trim()
        : String(DEFAULT_GATE_RETRIES);
    const sandboxPassthrough = readSandboxPassthroughFromCittyArgs(args as Record<string, unknown>);
    const gateRetriesParsed = parseInt(gateRetriesRaw, 10);
    if (Number.isNaN(gateRetriesParsed) || gateRetriesParsed < 1) {
      consola.error(`Invalid --gate-retries: ${gateRetriesRaw} (expected positive integer)`);
      process.exit(1);
    }

    const settings: GenSettings = {
      docspecDir,
      outputDir,
      projectDir,
      types,
      saifctlConfig:
        typeof args['saifctl-config'] === 'string' ? args['saifctl-config'] : undefined,
      saifctlDir: typeof args['saifctl-dir'] === 'string' ? args['saifctl-dir'] : 'saifctl',
      gateRetries: gateRetriesParsed,
      dryRun: args['dry-run'] === true,
      ...sandboxPassthrough,
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

    const { summary, manifest: manifestAfterGen } = await generateEntries(manifest, settings);
    if (summary.failed > 0) {
      process.exit(1);
    }

    const serialized = serializeManifest(manifestAfterGen);
    if (exportStdout || exportOut === 'stdout') {
      process.stdout.write(serialized);
    }
    if (typeof exportOut === 'string' && exportOut !== 'stdout') {
      const { writeFile } = await import('node:fs/promises');
      const outPath = resolve(cwd, exportOut);
      await writeFile(outPath, serialized, 'utf8');
      consola.success(`Exported manifest: ${outPath}`);
    }
  },
});

export default genCommand;
