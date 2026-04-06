/**
 * Persona simulation review: one `saifctl sandbox` run that writes a markdown report under
 * `outputDir/review/<product>/<persona>/`.
 *
 * The agent reads generated docs from the repo workspace; only the report path is extracted
 * (`--extract-include` scoped to `…/review`). Gate ensures the report file exists and is non-empty.
 * Distinct from `gen` / `audit` (no new product docs, only a review artifact).
 */
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { DEFAULT_GATE_RETRIES, getDefaultReviewCedarPath } from '../constants.js';
import { DocspecError } from '../docspec/errors.js';
import type { ParsedDocspec } from '../docspec/types.js';
import {
  extractIncludePrefix,
  outputPathRelativeToProject,
  sandboxNameFromEntryId,
} from '../generation/output-paths.js';
import { buildReferenceGateScript } from '../generation/reference-gate.js';
import {
  runSaifctlSandboxCli,
  type RunSandboxCliOpts,
  type RunSandboxPassthroughFields,
} from '../generation/run-sandbox.js';
import { consola } from '../logger.js';
import { renderReviewTaskFile } from './review-task-file.js';

/** Injectable sandbox runner (tests pass a mock; default spawns `saifctl sandbox`). */
export type RunSaifctlSandboxFn = (opts: RunSandboxCliOpts) => Promise<{ code: number | null }>;

/** Paths must match `gen`: `outputDir` inside `projectDir` so extract + gate paths stay repo-relative. */
export type ReviewSettings = {
  docspecDir: string;
  outputDir: string;
  projectDir: string;
  saifctlDir?: string;
  saifctlConfig?: string;
  gateRetries?: number;
  dryRun?: boolean;
  /** Override default packaged review.cedar */
  cedarPolicyPath?: string;
} & Partial<RunSandboxPassthroughFields>;

/** Outcome of one review run; `message` holds errors or `dry-run`. */
export type ReviewRunResult = {
  productId: string;
  personaId: string;
  taskId: string;
  reportPath: string;
  success: boolean;
  message?: string;
};

/** Which persona task to simulate (directory names under `docspec/products/<product>/`). */
export type PersonaTaskIds = { productId: string; personaId: string; taskId: string };

/** Resolve docspec tree to persona + task files; throws {@link DocspecError} with a useful path. */
function findPersonaTask(parsed: ParsedDocspec, docspecDir: string, ids: PersonaTaskIds) {
  const { productId, personaId, taskId } = ids;
  const product = parsed.products.find((p) => p.id === productId);
  if (!product) {
    throw new DocspecError(
      `Unknown product "${productId}"`,
      join(docspecDir, 'products', productId, 'product.md'),
    );
  }
  const persona = product.personas.find((p) => p.id === personaId);
  if (!persona) {
    throw new DocspecError(
      `Unknown persona "${personaId}" for product "${productId}"`,
      product.product.absolutePath,
    );
  }
  const task = persona.tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new DocspecError(
      `Unknown task "${taskId}" for persona "${personaId}"`,
      join(docspecDir, 'products', productId, 'personas', personaId, 'tasks', `${taskId}.md`),
    );
  }
  return { product, persona, task };
}

/** `saifctl sandbox --name` must be kebab-case and length-safe; reuse manifest entry sanitizer. */
function reviewSandboxName(productId: string, personaId: string, taskId: string): string {
  return sandboxNameFromEntryId(`review--${productId}--${personaId}--${taskId}`);
}

/** Unique report per invocation so concurrent reviews do not overwrite each other. */
function reportFileName(taskId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${taskId}-${stamp}.md`;
}

/**
 * Run a single persona×task review via saifctl sandbox.
 *
 * @throws DocspecError from {@link findPersonaTask} when ids are invalid (callers may catch for CLI).
 */
export async function runReview(
  parsed: ParsedDocspec,
  ids: PersonaTaskIds,
  settings: ReviewSettings,
  options?: { runSandbox?: RunSaifctlSandboxFn },
): Promise<ReviewRunResult> {
  const { productId, personaId, taskId } = ids;
  const { persona, task } = findPersonaTask(parsed, settings.docspecDir, ids);

  const projectDir = resolve(settings.projectDir);
  const outputDir = resolve(settings.outputDir);
  // Host path where the report should appear after successful extract
  const reportAbs = join(outputDir, 'review', productId, personaId, reportFileName(taskId));

  const resultBase: ReviewRunResult = {
    productId,
    personaId,
    taskId,
    reportPath: reportAbs,
    success: false,
  };

  // Path as seen inside the container workspace (must stay under projectDir for saifctl extract)
  let reportWorkspaceRel: string;
  try {
    reportWorkspaceRel = outputPathRelativeToProject(projectDir, reportAbs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...resultBase, message: msg };
  }

  if (settings.dryRun) {
    consola.info(`[review] Dry run: would write report to ${reportAbs}`);
    return { ...resultBase, success: true, message: 'dry-run' };
  }

  // Only apply hunks under review/ — avoids touching generated docs if the agent miswrites elsewhere
  let extractPrefix: string;
  try {
    extractPrefix = extractIncludePrefix(projectDir, join(outputDir, 'review'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...resultBase, message: msg };
  }

  const taskMarkdown = renderReviewTaskFile({
    projectDir,
    outputDir,
    productId,
    personaId,
    taskId,
    personaBody: persona.persona.body,
    taskFrontmatter: task.frontmatter,
    taskBody: task.body,
    reportWorkspaceRel,
  });

  // Task + gate live on the host; saifctl copies the gate into the run (same pattern as `gen`)
  const tmpBase = await mkdtemp(join(tmpdir(), 'saifdocs-review-'));
  const taskPath = join(tmpBase, 'task.md');
  const gatePath = join(tmpBase, 'gate.sh');
  await writeFile(taskPath, taskMarkdown, 'utf8');
  await writeFile(gatePath, buildReferenceGateScript([reportWorkspaceRel]), 'utf8');
  await chmod(gatePath, 0o755);

  // Packaged review.cedar (or override); passed through to `saifctl sandbox --cedar`
  const cedar = settings.cedarPolicyPath?.trim() || getDefaultReviewCedarPath();
  const saifctlDir = settings.saifctlDir?.trim() || 'saifctl';
  const gateRetries = settings.gateRetries ?? DEFAULT_GATE_RETRIES;
  const runSandbox = options?.runSandbox ?? runSaifctlSandboxCli;

  // Inner gate retries re-run the agent until the report file passes `buildReferenceGateScript`
  const { code } = await runSandbox({
    projectDir,
    saifctlDir,
    ...(settings.saifctlConfig ? { saifctlConfig: settings.saifctlConfig } : {}),
    cedarPolicyPath: cedar,
    taskFile: taskPath,
    gateScript: gatePath,
    extractInclude: extractPrefix,
    name: reviewSandboxName(productId, personaId, taskId),
    gateRetries,
    model: settings.model,
    baseUrl: settings.baseUrl,
    agent: settings.agent,
    agentScript: settings.agentScript,
    agentInstallScript: settings.agentInstallScript,
    profile: settings.profile,
    startupScript: settings.startupScript,
    coderImage: settings.coderImage,
    engine: settings.engine,
    dangerousNoLeash: settings.dangerousNoLeash,
    sandboxBaseDir: settings.sandboxBaseDir,
    agentEnv: settings.agentEnv,
    agentEnvFile: settings.agentEnvFile,
    agentSecret: settings.agentSecret,
    agentSecretFile: settings.agentSecretFile,
    verbose: settings.verbose,
  });

  if (code === 0) {
    return { ...resultBase, success: true };
  }
  // Timeout, gate failure after retries, or agent crash — details on stderr from saifctl
  return { ...resultBase, message: 'saifctl sandbox exited non-zero' };
}
