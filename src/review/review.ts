/**
 * Persona-simulation review — emit a single-phase saifctl feature dir whose
 * deliverable is a markdown review report.
 *
 * Saifdocs no longer spawns `saifctl sandbox`. This function only *prepares*
 * the feature tree; the user (or CI) runs `saifctl feat run --feature <id>`
 * to actually execute the review. Cedar policy, agent profile, etc. are
 * decided by the consumer repo, not by saifdocs.
 */
import { join, resolve } from 'node:path';

import { DocspecError } from '../docspec/errors.js';
import type { ParsedDocspec } from '../docspec/types.js';
import { type CompiledReviewResult, compileReviewToFeatureTree } from '../features/compiler.js';
import { outputPathRelativeToProject } from '../generation/output-paths.js';
import { renderReviewTaskFile } from './review-task-file.js';

/** Minimal settings — no cedar, no gate-retries, no sandbox passthrough. */
export type ReviewSettings = {
  /** Path to the docspec dir (used to resolve persona/task body content). */
  docspecDir: string;
  /** Path to the docs output dir (where the report lands). */
  outputDir: string;
  /** Path to the consumer project root (workspace mount inside the container). */
  projectDir: string;
  /** Path to the consumer's saifctl features dir (default: `<projectDir>/saifctl/features`). */
  saifctlFeaturesDir: string;
  /** Override the default timestamped feature id. */
  featureId?: string;
  /** If true, plan but do not write any files. */
  dryRun?: boolean;
};

export type ReviewRunResult = {
  productId: string;
  personaId: string;
  taskId: string;
  /** Workspace-relative path where the report will be written by saifctl. */
  reportPath: string;
  success: boolean;
  /** Set on failure or for `dry-run`. */
  message?: string;
  /** Present on success (non-dry-run): the emitted feature tree details. */
  feature?: CompiledReviewResult;
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

/** Unique report file name per invocation so concurrent reviews do not overwrite each other. */
function reportFileName(taskId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${taskId}-${stamp}.md`;
}

/**
 * Plan one persona×task review and emit a saifctl feature dir for it.
 *
 * @throws DocspecError from {@link findPersonaTask} when ids are invalid.
 */
export async function runReview(
  parsed: ParsedDocspec,
  ids: PersonaTaskIds,
  settings: ReviewSettings,
): Promise<ReviewRunResult> {
  const { productId, personaId, taskId } = ids;
  const { persona, task } = findPersonaTask(parsed, settings.docspecDir, ids);

  const projectDir = resolve(settings.projectDir);
  const outputDir = resolve(settings.outputDir);
  const saifctlFeaturesDir = resolve(settings.saifctlFeaturesDir);
  // Host path where the report should appear after `saifctl feat run` completes.
  const reportAbs = join(outputDir, 'review', productId, personaId, reportFileName(taskId));

  const resultBase: Omit<ReviewRunResult, 'success'> = {
    productId,
    personaId,
    taskId,
    reportPath: reportAbs,
  };

  // Path as seen inside the container workspace (must stay under projectDir).
  let reportWorkspaceRel: string;
  try {
    reportWorkspaceRel = outputPathRelativeToProject(projectDir, reportAbs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...resultBase, success: false, message: msg };
  }

  if (settings.dryRun) {
    return {
      ...resultBase,
      success: true,
      message: 'dry-run',
    };
  }

  const reviewSpecMd = renderReviewTaskFile({
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

  try {
    const feature = await compileReviewToFeatureTree({
      saifctlFeaturesDir,
      projectDir,
      ...(settings.featureId ? { featureId: settings.featureId } : {}),
      productId,
      personaId,
      taskId,
      reviewSpecMd,
      reportWorkspaceRelPath: reportWorkspaceRel,
    });
    return { ...resultBase, success: true, feature };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...resultBase, success: false, message: msg };
  }
}
