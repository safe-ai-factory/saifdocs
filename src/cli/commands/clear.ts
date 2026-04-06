import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { defineCommand } from 'citty';

import { DEFAULT_OUTPUT_DIR } from '../../constants.js';
import { consola } from '../../logger.js';
import { outputDirArg } from '../args.js';

const clearCommand = defineCommand({
  meta: {
    name: 'clear',
    description: 'Delete generated documentation output directory',
  },
  args: {
    'output-dir': outputDirArg,
  },
  async run({ args }) {
    const outputDir = resolve(process.cwd(), args['output-dir'] ?? DEFAULT_OUTPUT_DIR);
    await rm(outputDir, { recursive: true, force: true });
    consola.success(`Cleared ${outputDir}`);
  },
});

export default clearCommand;
