/**
 * Compile a saifdocs manifest into a saifctl phases-and-critics feature tree.
 *
 * The contract: saifdocs no longer orchestrates LLM runs. Instead, each
 * `saifdocs gen` invocation emits one timestamped feature dir under the
 * consumer's `saifctl/features/` with N phases (one per file-to-generate).
 * The user (or CI) then invokes `saifctl feat run --feature <id>`.
 *
 * Output shape:
 *
 *   <saifctlFeaturesDir>/<featureId>/
 *     feature.yml
 *     plan.md
 *     critics/
 *       audit.md
 *     phases/
 *       0001-references-cli-flags/
 *         spec.md
 *         tests/
 *           gate.sh
 *       0002-references-config/
 *       ...
 *
 * Phase numbering width is computed from the total phase count
 * (`String(N).length`) so 50 pages → `01..50`, 1023 pages → `0001..1023`.
 * Phases are ordered: references → concepts → how-tos → tutorials →
 * landing-pages (matching saifdocs's existing `GEN_PHASES`).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { getSaifdocsPackageVersion } from '../constants.js';
import { outputPathRelativeToProject } from '../generation/output-paths.js';
import {
  type HowToTaskHints,
  renderConceptTaskFile,
  renderHowToTaskFile,
  renderLandingPageTaskFile,
  renderReferenceTaskFile,
  renderTutorialTaskFile,
} from '../generation/task-file.js';
import type { ManifestDocument, ManifestEntry, OutputType } from '../manifest/types.js';
import { loadHowToTaskHints } from './howto-hints.js';
import {
  renderAuditCriticMd,
  renderFeatureYml,
  renderGateScript,
  renderPlanMd,
} from './templates.js';
import { assertValidFeatureId, generateTimestampFeatureId } from './timestamp.js';

/**
 * Phase order — matches the historical GEN_PHASES from generate.ts. References
 * land first because they're the canonical surface; concepts land before
 * how-tos so how-tos can cite them; landing-pages land last because they
 * link to everything else.
 */
const PHASE_ORDER: readonly OutputType[] = [
  'references',
  'concepts',
  'how-tos',
  'tutorials',
  'landing-pages',
] as const;

export type CompileToFeatureTreeOpts = {
  /** The saifdocs manifest (already built from docspec). */
  manifest: ManifestDocument;
  /** Absolute path to the consumer's saifctl features dir, e.g. `<project>/saifctl/features`. */
  saifctlFeaturesDir: string;
  /** Absolute path to the consumer's project root (for workspace-relative output paths). */
  projectDir: string;
  /** Filter manifest by output type. `'all'` runs every type. */
  types: OutputType[] | 'all';
  /** Filter to specific entry ids (used by `saifdocs update --entry <id>`). */
  onlyEntryIds?: Set<string>;
  /** Override the timestamp-based default feature id. */
  featureId?: string;
  /** Injectable clock for deterministic tests. */
  now?: Date;
};

export type CompiledPhase = {
  /** Lex-sorted phase dir name, e.g. `0001-references-cli-flags`. */
  phaseId: string;
  /** Absolute path to the emitted phase dir. */
  phaseDir: string;
  /** The manifest entry this phase renders. */
  entry: ManifestEntry;
};

export type CompileToFeatureTreeResult = {
  /** Final feature id (basename of the emitted dir). */
  featureId: string;
  /** Absolute path to the emitted feature dir. */
  featureDir: string;
  /** Path to the feature dir relative to the consumer's project root (handy for log output). */
  featureDirRel: string;
  /** Compiled phases in lexicographic order. */
  phases: CompiledPhase[];
  /** Per-type counts. Useful for the plan.md breakdown and CLI summary. */
  byType: Partial<Record<OutputType, number>>;
};

/** Result of `selectAndOrderEntries` (also exported for tests). */
export type SelectedEntry = { entry: ManifestEntry; type: OutputType };

/** Filter + order manifest entries by `types` and `onlyEntryIds`. */
export function selectAndOrderEntries(
  manifest: ManifestDocument,
  opts: { types: OutputType[] | 'all'; onlyEntryIds?: Set<string> },
): SelectedEntry[] {
  const typeAllowed = (t: OutputType): boolean =>
    opts.types === 'all' ? true : opts.types.includes(t);
  const idAllowed = (id: string): boolean =>
    !opts.onlyEntryIds || opts.onlyEntryIds.size === 0 || opts.onlyEntryIds.has(id);

  const out: SelectedEntry[] = [];
  for (const t of PHASE_ORDER) {
    for (const entry of manifest.entries) {
      if (entry.type !== t) continue;
      if (!typeAllowed(entry.type)) continue;
      if (!idAllowed(entry.id)) continue;
      out.push({ entry, type: entry.type });
    }
  }
  return out;
}

/**
 * Slug for a phase dir from a manifest entry. Format: `<type-prefix>-<id-suffix>`.
 * Type prefix is shortened (`ref`, `con`, `how`, `tut`, `lp`) to keep dirs scannable.
 * Falls back to a hash-suffixed form if the entry id contains characters that
 * don't survive kebab normalization.
 */
export function slugForEntry(entry: ManifestEntry): string {
  const prefix = typePrefix(entry.type);
  // Saifdocs entry ids are already kebab-ish (e.g. `concept--saifdocs--docspec`).
  // Collapse `--` runs and strip the type prefix from the start if it's there.
  let id = entry.id.replace(/--+/g, '-').replace(/^-+|-+$/g, '');
  // Strip a leading type marker (e.g. `concept-`, `reference-`) to avoid double-prefixing.
  const typeMarkers = ['concept', 'reference', 'how-to', 'tutorial', 'landing-page'];
  for (const marker of typeMarkers) {
    if (id.startsWith(`${marker}-`)) {
      id = id.slice(marker.length + 1);
      break;
    }
  }
  // Kebab-normalize the remainder.
  id = id
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (id === '') id = 'unknown';
  return `${prefix}-${id}`;
}

function typePrefix(t: OutputType): string {
  switch (t) {
    case 'references':
      return 'ref';
    case 'concepts':
      return 'con';
    case 'how-tos':
      return 'how';
    case 'tutorials':
      return 'tut';
    case 'landing-pages':
      return 'lp';
  }
}

/**
 * Zero-pad a 1-based index to the width of the total. Width is the number
 * of digits in `total`, so for 1023 entries width=4 → `0001..1023`.
 */
export function padPhaseIndex(index1Based: number, total: number): string {
  const width = String(Math.max(total, 1)).length;
  return String(index1Based).padStart(width, '0');
}

/**
 * Render the `spec.md` body for one phase by dispatching to the right
 * task-file renderer based on the entry's output type.
 */
async function renderPhaseSpecMd(
  type: OutputType,
  entry: ManifestEntry,
  projectDir: string,
): Promise<string> {
  switch (type) {
    case 'references':
      return renderReferenceTaskFile(entry, projectDir);
    case 'concepts':
      return renderConceptTaskFile(entry, projectDir);
    case 'how-tos': {
      const hints: HowToTaskHints | undefined = await loadHowToTaskHints(entry);
      return renderHowToTaskFile(entry, projectDir, hints);
    }
    case 'tutorials':
      return renderTutorialTaskFile(entry, projectDir);
    case 'landing-pages':
      return renderLandingPageTaskFile(entry, projectDir);
  }
}

/**
 * Compile a manifest into a saifctl feature tree.
 *
 * Idempotent up to the timestamp: if `featureId` is supplied explicitly, the
 * compiler overwrites that dir on re-emit. Without an override, every run
 * produces a new timestamped dir.
 */
export async function compileManifestToFeatureTree(
  opts: CompileToFeatureTreeOpts,
): Promise<CompileToFeatureTreeResult> {
  const { manifest, projectDir, types, onlyEntryIds } = opts;
  const saifctlFeaturesDir = resolve(opts.saifctlFeaturesDir);
  const now = opts.now ?? new Date();
  const featureId = assertValidFeatureId(opts.featureId ?? generateTimestampFeatureId(now));

  const featureDir = join(saifctlFeaturesDir, featureId);
  const featureDirRel = relative(resolve(projectDir), featureDir) || featureDir;

  const selected = selectAndOrderEntries(manifest, { types, onlyEntryIds });

  // Aggregate per-type counts for the plan.md breakdown.
  const byType: Partial<Record<OutputType, number>> = {};
  for (const { type } of selected) {
    byType[type] = (byType[type] ?? 0) + 1;
  }

  // Pre-compute phase slugs so we can detect collisions (extremely unlikely
  // but possible if two manifest entries share a normalized id).
  const totalPhases = selected.length;
  const seenSlugs = new Set<string>();
  const phasePlan: { phaseId: string; selection: SelectedEntry }[] = [];
  for (let i = 0; i < selected.length; i++) {
    const sel = selected[i]!;
    const indexStr = padPhaseIndex(i + 1, totalPhases);
    let slug = slugForEntry(sel.entry);
    if (seenSlugs.has(slug)) {
      // Append a numeric disambiguator. Cannot happen often given saifdocs ids
      // are derived from docspec paths, but we don't want a silent collision.
      let n = 2;
      while (seenSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    seenSlugs.add(slug);
    phasePlan.push({ phaseId: `${indexStr}-${slug}`, selection: sel });
  }

  await mkdir(featureDir, { recursive: true });
  await mkdir(join(featureDir, 'critics'), { recursive: true });
  await mkdir(join(featureDir, 'phases'), { recursive: true });

  // Feature-level scaffolding (constant across all entries in this run).
  await writeFile(join(featureDir, 'feature.yml'), renderFeatureYml(), 'utf8');
  await writeFile(
    join(featureDir, 'plan.md'),
    renderPlanMd({
      featureId,
      generatedAt: now,
      saifdocsVersion: getSaifdocsPackageVersion(),
      totalPhases,
      byType,
    }),
    'utf8',
  );
  await writeFile(join(featureDir, 'critics', 'audit.md'), renderAuditCriticMd(), 'utf8');

  // Per-phase emission.
  const compiledPhases: CompiledPhase[] = [];
  for (const { phaseId, selection } of phasePlan) {
    const phaseDir = join(featureDir, 'phases', phaseId);
    const testsDir = join(phaseDir, 'tests');
    await mkdir(testsDir, { recursive: true });

    const specMd = await renderPhaseSpecMd(selection.type, selection.entry, projectDir);
    await writeFile(join(phaseDir, 'spec.md'), specMd, 'utf8');

    const workspaceRel = outputPathRelativeToProject(projectDir, selection.entry.output);
    await writeFile(join(testsDir, 'gate.sh'), renderGateScript(workspaceRel), {
      encoding: 'utf8',
      mode: 0o755,
    });

    compiledPhases.push({ phaseId, phaseDir, entry: selection.entry });
  }

  return { featureId, featureDir, featureDirRel, phases: compiledPhases, byType };
}

/**
 * Render `feature.yml` for a review feature — no critics declared (the
 * review is itself the deliverable; there's no separate adversarial pass).
 * Saifctl treats an empty critics list as "no critic phases", which is what
 * we want here.
 */
function renderReviewFeatureYml(): string {
  return `# Generated by saifdocs (review). Single-phase feature whose deliverable
# is a markdown report file. No critics — the report IS the review output.
critics: []
tests:
  mutable: false
`;
}

/** Render a minimal plan.md for a review feature. */
function renderReviewPlanMd(opts: {
  featureId: string;
  generatedAt: Date;
  saifdocsVersion: string;
  productId: string;
  personaId: string;
  taskId: string;
  reportPath: string;
}): string {
  const isoUtc = opts.generatedAt.toISOString();
  return `# ${opts.featureId} — review feature

Generated by **saifdocs** v${opts.saifdocsVersion} at \`${isoUtc}\`.

A persona-simulation review for product **${opts.productId}**, persona
**${opts.personaId}**, task **${opts.taskId}**. The agent reads the
generated docs and writes a markdown report to:

\`${opts.reportPath}\`

## How to run this feature

\`\`\`bash
saifctl feat run --feature ${opts.featureId}
\`\`\`

Cedar policy, agent profile, model selection, etc. are decided by the
consumer repo, not by saifdocs.
`;
}

export type CompileReviewToFeatureTreeOpts = {
  /** Absolute path to the consumer's saifctl features dir. */
  saifctlFeaturesDir: string;
  /** Absolute path to the consumer's project root. */
  projectDir: string;
  /** Override the timestamp-based default feature id. */
  featureId?: string;
  /** Injectable clock for deterministic tests. */
  now?: Date;
  /** docspec product id (e.g. `auth`). */
  productId: string;
  /** persona id (e.g. `admin`). */
  personaId: string;
  /** task id (e.g. `security-audit`). */
  taskId: string;
  /** Already-rendered review task markdown (from `renderReviewTaskFile`). */
  reviewSpecMd: string;
  /** Workspace-relative path the agent should write its report to. */
  reportWorkspaceRelPath: string;
};

export type CompiledReviewResult = {
  featureId: string;
  featureDir: string;
  featureDirRel: string;
  phaseId: string;
  phaseDir: string;
};

/**
 * Compile a review request into a single-phase saifctl feature tree.
 *
 *   <saifctlFeaturesDir>/<featureId>/
 *     feature.yml      (critics: [])
 *     plan.md
 *     phases/
 *       1-review-<product>-<persona>-<task>/
 *         spec.md      (the review prompt)
 *         tests/
 *           gate.sh    (checks the report file appeared)
 */
export async function compileReviewToFeatureTree(
  opts: CompileReviewToFeatureTreeOpts,
): Promise<CompiledReviewResult> {
  const saifctlFeaturesDir = resolve(opts.saifctlFeaturesDir);
  const projectDir = resolve(opts.projectDir);
  const now = opts.now ?? new Date();

  const baseId = opts.featureId ?? generateTimestampFeatureId(now);
  // For reviews the default has a `review-` infix to distinguish from `gen` runs.
  const featureId = assertValidFeatureId(
    opts.featureId ?? `${baseId.replace(/^saifdocs-/, 'saifdocs-review-')}`,
  );
  const featureDir = join(saifctlFeaturesDir, featureId);
  const featureDirRel = relative(projectDir, featureDir) || featureDir;

  // Slug for the single phase: kebab the product/persona/task.
  const slugPart = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'x';
  const phaseId = `1-review-${slugPart(opts.productId)}-${slugPart(opts.personaId)}-${slugPart(opts.taskId)}`;
  const phaseDir = join(featureDir, 'phases', phaseId);

  await mkdir(featureDir, { recursive: true });
  await mkdir(join(featureDir, 'phases'), { recursive: true });
  await mkdir(join(phaseDir, 'tests'), { recursive: true });

  await writeFile(join(featureDir, 'feature.yml'), renderReviewFeatureYml(), 'utf8');
  await writeFile(
    join(featureDir, 'plan.md'),
    renderReviewPlanMd({
      featureId,
      generatedAt: now,
      saifdocsVersion: getSaifdocsPackageVersion(),
      productId: opts.productId,
      personaId: opts.personaId,
      taskId: opts.taskId,
      reportPath: opts.reportWorkspaceRelPath,
    }),
    'utf8',
  );

  await writeFile(join(phaseDir, 'spec.md'), opts.reviewSpecMd, 'utf8');
  await writeFile(
    join(phaseDir, 'tests', 'gate.sh'),
    renderGateScript(opts.reportWorkspaceRelPath),
    {
      encoding: 'utf8',
      mode: 0o755,
    },
  );

  return { featureId, featureDir, featureDirRel, phaseId, phaseDir };
}
