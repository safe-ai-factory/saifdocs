import { readdir, rm, rmdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { defineCommand } from 'citty';

import { DEFAULT_DOCSPEC_DIR, DEFAULT_OUTPUT_DIR } from '../../constants.js';
import { consola } from '../../logger.js';
import { readManifestFromDocspec } from '../../manifest/reader.js';
import { docspecDirArg, outputDirArg } from '../args.js';

const clearCommand = defineCommand({
  meta: {
    name: 'clear',
    description:
      'Delete saifdocs-generated files in the output directory (manifest-aware: only files the manifest claims to own)',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
  },
  async run({ args }) {
    const cwd = process.cwd();
    const docspecDir = resolve(cwd, args['docspec-dir'] ?? DEFAULT_DOCSPEC_DIR);
    const outputDir = resolve(cwd, args['output-dir'] ?? DEFAULT_OUTPUT_DIR);

    const manifest = await readManifestFromDocspec(docspecDir);
    if (!manifest) {
      consola.info(`[clear] No manifest at ${docspecDir} — nothing to clear.`);
      return;
    }

    const ownedFiles = manifest.entries
      .map((entry) => resolve(entry.output))
      .filter((path) => isWithin(outputDir, path));

    if (ownedFiles.length === 0) {
      consola.info(`[clear] Manifest has no entries under ${outputDir} — nothing to clear.`);
      return;
    }

    let removed = 0;
    let missing = 0;
    const dirsToCheck = new Set<string>();

    for (const file of ownedFiles) {
      try {
        await rm(file, { force: false });
        removed += 1;
        dirsToCheck.add(dirname(file));
      } catch (e) {
        if (isENOENT(e)) {
          missing += 1;
          continue;
        }
        throw e;
      }
    }

    const prunedDirs = await pruneEmptyDirs(dirsToCheck, outputDir);

    const parts = [`Removed ${removed} file(s)`];
    if (missing > 0) parts.push(`${missing} already absent`);
    if (prunedDirs > 0) parts.push(`pruned ${prunedDirs} empty dir(s)`);
    consola.success(`[clear] ${parts.join(', ')}.`);
  },
});

/** True when `child` is at or below `parent` (excluding `parent` itself). */
function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Walk each seed dir upward toward `stopAt` (exclusive), removing it if empty.
 * Stops at the first non-empty ancestor on each path. Returns the count removed.
 */
async function pruneEmptyDirs(seedDirs: Set<string>, stopAt: string): Promise<number> {
  const stopAtResolved = resolve(stopAt);
  let pruned = 0;
  for (const seed of seedDirs) {
    let current = resolve(seed);
    while (isWithin(stopAtResolved, current)) {
      let entries: string[];
      try {
        entries = await readdir(current);
      } catch (e) {
        if (isENOENT(e)) {
          current = dirname(current);
          continue;
        }
        break;
      }
      if (entries.length > 0) break;
      try {
        await rmdir(current);
        pruned += 1;
      } catch {
        break;
      }
      current = dirname(current);
    }
  }
  return pruned;
}

function isENOENT(e: unknown): boolean {
  return (
    e !== null &&
    typeof e === 'object' &&
    'code' in e &&
    (e as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

export default clearCommand;
