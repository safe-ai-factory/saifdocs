#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';

import { getSaifdocsPackageVersion } from '../constants.js';
import auditCommand from './commands/audit.js';
import clearCommand from './commands/clear.js';
import genCommand from './commands/gen.js';
import reviewCommand from './commands/review.js';
import updateCommand from './commands/update.js';
import validateCommand from './commands/validate.js';

const main = defineCommand({
  meta: {
    name: 'saifdocs',
    version: getSaifdocsPackageVersion(),
    description: 'AI-driven documentation generator with persona-aware quality control.',
  },
  subCommands: {
    gen: genCommand,
    generate: genCommand,
    audit: auditCommand,
    clear: clearCommand,
    review: reviewCommand,
    validate: validateCommand,
    update: updateCommand,
  },
});

void runMain(main);
