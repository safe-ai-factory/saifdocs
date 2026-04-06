import { resolve } from 'node:path';

import { defineCommand } from 'citty';

import { consola } from '../../logger.js';
import { readManifestFromDocspec } from '../../manifest/reader.js';
import { validateManifest } from '../../validate/validate.js';
import {
  allowMissingManifestArg,
  cliBooleanTrue,
  docspecDirArg,
  jsonOutputArg,
  parseOutputTypes,
  typesArg,
} from '../args.js';

const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description:
      'Check generated docs against docspec/.manifest.json: stale if any read input is newer than generatedAt',
  },
  args: {
    'docspec-dir': docspecDirArg,
    types: typesArg,
    json: jsonOutputArg,
    'allow-missing-manifest': allowMissingManifestArg,
  },
  async run({ args }) {
    const cwd = process.cwd();
    const docspecDir = resolve(cwd, args['docspec-dir'] ?? 'docspec');

    let types;
    try {
      types = parseOutputTypes(args.types);
    } catch (e) {
      consola.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    let manifest;
    try {
      manifest = await readManifestFromDocspec(docspecDir);
    } catch (e) {
      consola.error(e instanceof Error ? e.message : String(e));
      process.exit(2);
    }

    if (manifest === null) {
      if (
        cliBooleanTrue(
          args as Record<string, unknown>,
          'allow-missing-manifest',
          'allowMissingManifest',
        )
      ) {
        consola.info('[validate] No manifest found; skipping (--allow-missing-manifest).');
        process.exit(0);
      }
      consola.error(`[validate] No manifest at ${docspecDir}/.manifest.json`);
      process.exit(2);
    }

    const result = await validateManifest(manifest, { types });

    if (args.json === true) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const totalChecked = result.stale.length + result.upToDate + result.skipped;
      consola.info(
        `[validate] ${result.stale.length} stale, ${result.upToDate} up-to-date, ${result.skipped} never generated (of ${totalChecked} entries in scope)`,
      );
      for (const s of result.stale) {
        consola.warn(`  STALE  ${s.id}`);
        consola.warn(`         output: ${s.output}`);
        consola.warn(`         stale since: ${s.staleSince}`);
        for (const p of s.staleInputs) {
          consola.warn(`         - ${p}`);
        }
      }
    }

    if (result.stale.length > 0) {
      process.exit(1);
    }
    process.exit(0);
  },
});

export default validateCommand;
