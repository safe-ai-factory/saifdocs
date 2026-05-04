/**
 * `saifdocs review` — emit a single-phase saifctl feature for a persona
 * simulation review. The user (or CI) runs `saifctl feat run --feature <id>`
 * afterwards to actually execute the review.
 *
 * Saifdocs no longer spawns saifctl; Cedar policy / agent profile / model
 * are decided by the consumer repo.
 */
import { resolve } from 'node:path';

import { defineCommand } from 'citty';

import { DocspecError } from '../../docspec/errors.js';
import { readDocspec } from '../../docspec/reader.js';
import { consola } from '../../logger.js';
import { runReview } from '../../review/review.js';
import {
  docspecDirArg,
  dryRunArg,
  featureIdArg,
  outputDirArg,
  projectDirArg,
  saifctlFeaturesDirArg,
} from '../args.js';

const reviewCommand = defineCommand({
  meta: {
    name: 'review',
    description:
      'Emit a single-phase saifctl feature for a persona-simulation review. Run `saifctl feat run --feature <id>` afterwards to execute it.',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'project-dir': projectDirArg,
    'saifctl-features-dir': saifctlFeaturesDirArg,
    'feature-id': featureIdArg,
    'dry-run': dryRunArg,
    product: {
      type: 'string' as const,
      description: 'Product id (docspec/products/<id>/)',
    },
    persona: {
      type: 'string' as const,
      description: 'Persona id under that product',
    },
    task: {
      type: 'string' as const,
      description: 'Task id (tasks/<id>.md under the persona)',
    },
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

    const product = typeof args.product === 'string' ? args.product.trim() : '';
    const persona = typeof args.persona === 'string' ? args.persona.trim() : '';
    const task = typeof args.task === 'string' ? args.task.trim() : '';
    if (!product || !persona || !task) {
      consola.error('Error: --product, --persona, and --task are required');
      process.exit(1);
    }

    let parsed;
    try {
      parsed = await readDocspec(docspecDir);
    } catch (e) {
      if (e instanceof DocspecError) {
        consola.error(e.message);
      } else {
        consola.error(e instanceof Error ? e.message : String(e));
      }
      process.exit(1);
    }

    let result;
    try {
      result = await runReview(
        parsed,
        { productId: product, personaId: persona, taskId: task },
        {
          docspecDir,
          outputDir,
          projectDir,
          saifctlFeaturesDir,
          ...(featureIdOverride ? { featureId: featureIdOverride } : {}),
          dryRun: args['dry-run'] === true,
        },
      );
    } catch (e) {
      if (e instanceof DocspecError) {
        consola.error(e.message);
      } else {
        consola.error(e instanceof Error ? e.message : String(e));
      }
      process.exit(1);
    }

    if (result.success) {
      if (result.message === 'dry-run') {
        consola.info(`[review] Dry run: would emit feature for ${product}/${persona}/${task}`);
        process.exit(0);
      }
      if (result.feature) {
        consola.success(
          `[review] Emitted feature: ${result.feature.featureId} at ${result.feature.featureDir}`,
        );
        consola.info(`[review] Next step: saifctl feat run --feature ${result.feature.featureId}`);
      }
      consola.info(`[review] Report will land at: ${result.reportPath}`);
      process.exit(0);
    }

    consola.error(`[review] Failed: ${result.message ?? 'unknown error'}`);
    process.exit(1);
  },
});

export default reviewCommand;
