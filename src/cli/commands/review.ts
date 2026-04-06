import { resolve } from 'node:path';

import { sandboxPassthroughArgs } from '@safe-ai-factory/saifctl';
import { defineCommand } from 'citty';

import { DEFAULT_GATE_RETRIES, getDefaultReviewStrictCedarPath } from '../../constants.js';
import { DocspecError } from '../../docspec/errors.js';
import { readDocspec } from '../../docspec/reader.js';
import { consola } from '../../logger.js';
import { runReview } from '../../review/review.js';
import {
  docspecDirArg,
  dryRunArg,
  outputDirArg,
  projectDirArg,
  saifctlConfigArg,
  saifctlDirArg,
} from '../args.js';
import { readSandboxPassthroughFromCittyArgs } from '../sandbox.js';

const reviewCommand = defineCommand({
  meta: {
    name: 'review',
    description:
      'Run a persona simulation review via saifctl sandbox (writes report under output-dir/review/). Use --strict-network for hostname allowlisted outbound access.',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'project-dir': projectDirArg,
    'saifctl-config': saifctlConfigArg,
    'saifctl-dir': saifctlDirArg,
    'dry-run': dryRunArg,
    ...sandboxPassthroughArgs,
    cedar: {
      type: 'string' as const,
      description:
        'Path to Cedar policy for Leash (default: packaged review.cedar; overrides --strict-network)',
    },
    'strict-network': {
      type: 'boolean' as const,
      description:
        'Use packaged review-strict.cedar (allowlist: registries, GitHub, common LLM API hosts)',
      default: false,
    },
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

    const product = typeof args.product === 'string' ? args.product.trim() : '';
    const persona = typeof args.persona === 'string' ? args.persona.trim() : '';
    const task = typeof args.task === 'string' ? args.task.trim() : '';
    if (!product || !persona || !task) {
      consola.error('Error: --product, --persona, and --task are required');
      process.exit(1);
    }

    const gateRetriesRaw =
      typeof args['gate-retries'] === 'string'
        ? args['gate-retries'].trim()
        : String(DEFAULT_GATE_RETRIES);
    const gateRetriesParsed = parseInt(gateRetriesRaw, 10);
    if (Number.isNaN(gateRetriesParsed) || gateRetriesParsed < 1) {
      consola.error(`Invalid --gate-retries: ${gateRetriesRaw} (expected positive integer)`);
      process.exit(1);
    }

    const passthrough = readSandboxPassthroughFromCittyArgs(args as Record<string, unknown>);
    const { cedarPolicyPath: cedarFromCli, ...restPassthrough } = passthrough;
    const cedarPolicyPath =
      cedarFromCli ??
      (args['strict-network'] === true ? getDefaultReviewStrictCedarPath() : undefined);

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
          saifctlConfig:
            typeof args['saifctl-config'] === 'string' ? args['saifctl-config'] : undefined,
          saifctlDir: typeof args['saifctl-dir'] === 'string' ? args['saifctl-dir'] : 'saifctl',
          gateRetries: gateRetriesParsed,
          dryRun: args['dry-run'] === true,
          cedarPolicyPath,
          ...restPassthrough,
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
        process.exit(0);
      }
      consola.success(`[review] Report: ${result.reportPath}`);
      process.exit(0);
    }

    consola.error(`[review] Failed: ${result.message ?? 'unknown error'}`);
    process.exit(1);
  },
});

export default reviewCommand;
