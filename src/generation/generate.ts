/**
 * Doc generation: one `saifctl sandbox --subtasks` run for all selected manifest entries.
 * Subtasks are ordered references → concepts → how-tos → tutorials → landing-pages.
 * The agent writes under the repo workspace; `--extract-include` limits what gets applied to the host.
 */
import { readFile, stat } from 'node:fs/promises';

import type { RunSubtaskInput } from '@safe-ai-factory/saifctl';
import matter from 'gray-matter';

import { DEFAULT_GATE_RETRIES } from '../constants.js';
import { TaskFrontmatterSchema } from '../docspec/schema.js';
import { consola } from '../logger.js';
import type { GenSettings, ManifestDocument, ManifestEntry } from '../manifest/types.js';
import { writeManifestToDocspec } from '../manifest/writer.js';
import {
  extractIncludePrefix,
  outputPathRelativeToProject,
  sandboxNameFromEntryId,
} from './output-paths.js';
import { buildReferenceGateScript } from './reference-gate.js';
import {
  buildSubtasksJsonFile,
  runSaifctlSandboxCli,
  type RunSandboxCliOpts,
} from './run-sandbox.js';
import {
  type HowToTaskHints,
  renderConceptTaskFile,
  renderHowToTaskFile,
  renderLandingPageTaskFile,
  renderReferenceTaskFile,
  renderTutorialTaskFile,
} from './task-file.js';

/** Injectable sandbox runner (default: real `saifctl sandbox` CLI). */
export type RunSaifctlSandboxFn = (opts: RunSandboxCliOpts) => Promise<{ code: number | null }>;

/** Counts from a generate pass (dry-run / skip still bump `skipped`). */
export type GenerateSummary = {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  failures: { id: string; message: string }[];
};

export type GenerateResult = {
  summary: GenerateSummary;
  /** Manifest after generation (includes updated generatedAt on success). */
  manifest: ManifestDocument;
};

/**
 * Phases: references → concepts → how-tos → tutorials → landing-pages.
 * Tutorials may read prior-stage outputs and how-tos; landing pages link to all product outputs.
 */
export const GEN_PHASES = [
  'references',
  'concepts',
  'how-tos',
  'tutorials',
  'landing-pages',
] as const;
type GenPhase = (typeof GEN_PHASES)[number];

function entryInFilter(entry: ManifestEntry, onlyEntryIds?: Set<string>): boolean {
  if (!onlyEntryIds || onlyEntryIds.size === 0) return true;
  return onlyEntryIds.has(entry.id);
}

/** Respects `gen --types` / `all`. */
function settingsIncludesType(settings: GenSettings, t: GenPhase): boolean {
  if (settings.types === 'all') return true;
  return settings.types.includes(t);
}

function entriesForPhase(
  manifest: ManifestDocument,
  t: GenPhase,
  onlyEntryIds?: Set<string>,
): ManifestEntry[] {
  return manifest.entries.filter((e) => e.type === t && entryInFilter(e, onlyEntryIds));
}

/** Sandbox invocations we would run for the current type filter (used for dry-run and early exit). */
function countEntriesToGenerate(
  manifest: ManifestDocument,
  settings: GenSettings,
  onlyEntryIds?: Set<string>,
): number {
  let n = 0;
  for (const t of GEN_PHASES) {
    if (!settingsIncludesType(settings, t)) continue;
    n += entriesForPhase(manifest, t, onlyEntryIds).length;
  }
  return n;
}

/** Manifest `read` includes the docspec task path; match by `…/tasks/<taskId>.md` (Windows-safe). */
function findTaskFileInRead(entry: ManifestEntry): string | undefined {
  if (!entry.taskId) return undefined;
  const needle = `/tasks/${entry.taskId}.md`;
  return entry.read.find((p) => p.replace(/\\/g, '/').endsWith(needle));
}

/** Pull arrival_context / search_terms / user_stage into the sandbox task body so the agent need not re-open the task file. */
async function loadHowToTaskHints(entry: ManifestEntry): Promise<HowToTaskHints | undefined> {
  const taskPath = findTaskFileInRead(entry);
  if (!taskPath) return undefined;
  try {
    const raw = await readFile(taskPath, 'utf8');
    const parsed = matter(raw);
    const result = TaskFrontmatterSchema.safeParse(parsed.data);
    if (!result.success) return undefined;
    const d = result.data;
    const hints: HowToTaskHints = {
      arrival_context: d.arrival_context,
      user_stage: d.user_stage,
    };
    if (d.search_terms?.length) hints.search_terms = d.search_terms;
    return hints;
  } catch {
    return undefined;
  }
}

function renderTaskMarkdown(
  phase: GenPhase,
  entry: ManifestEntry,
  projectDir: string,
): Promise<string> | string {
  switch (phase) {
    case 'references':
      return renderReferenceTaskFile(entry, projectDir);
    case 'concepts':
      return renderConceptTaskFile(entry, projectDir);
    case 'how-tos':
      return loadHowToTaskHints(entry).then((hints) =>
        renderHowToTaskFile(entry, projectDir, hints),
      );
    case 'tutorials':
      return renderTutorialTaskFile(entry, projectDir);
    case 'landing-pages':
      return renderLandingPageTaskFile(entry, projectDir);
  }
}

/** `saifctl sandbox --name` must be kebab-case; single run label for the merged subtask list. */
function allSubtasksSandboxName(entries: ManifestEntry[]): string {
  if (entries.length === 1) return sandboxNameFromEntryId(entries[0]!.id);
  return sandboxNameFromEntryId(`saifdocs-all-${entries.length}`);
}

async function outputFileLooksSuccessful(outputAbs: string): Promise<boolean> {
  try {
    const s = await stat(outputAbs);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

export type BuildAllSubtasksResult = {
  subtasks: RunSubtaskInput[];
  entries: ManifestEntry[];
  phases: GenPhase[];
};

/**
 * Builds one ordered subtask list for every selected manifest entry (phase order preserved).
 */
export async function buildAllSubtasksOrdered(opts: {
  manifest: ManifestDocument;
  settings: GenSettings;
  onlyEntryIds?: Set<string>;
}): Promise<BuildAllSubtasksResult> {
  const { manifest, settings, onlyEntryIds } = opts;
  const { projectDir } = settings;
  const gateRetries = settings.gateRetries ?? DEFAULT_GATE_RETRIES;

  const subtasks: RunSubtaskInput[] = [];
  const entries: ManifestEntry[] = [];
  const phases: GenPhase[] = [];

  for (const phase of GEN_PHASES) {
    if (!settingsIncludesType(settings, phase)) continue;
    for (const entry of entriesForPhase(manifest, phase, onlyEntryIds)) {
      const taskMarkdown = await renderTaskMarkdown(phase, entry, projectDir);
      const workspaceRel = outputPathRelativeToProject(projectDir, entry.output);
      subtasks.push({
        title: entry.id,
        content: taskMarkdown,
        gateScript: buildReferenceGateScript([workspaceRel]),
        gateRetries,
      });
      entries.push(entry);
      phases.push(phase);
    }
  }

  return { subtasks, entries, phases };
}

/**
 * Runs generation for manifest rows (references, concepts, how-tos, tutorials, landing-pages when selected).
 * Persists `generatedAt` and rewrites `.manifest.json` once after the single sandbox run if any entry succeeded.
 */
export async function generateEntries(
  manifest: ManifestDocument,
  settings: GenSettings,
  options?: { runSandbox?: RunSaifctlSandboxFn; onlyEntryIds?: Set<string> },
): Promise<GenerateResult> {
  const runSandbox = options?.runSandbox ?? runSaifctlSandboxCli;
  const onlyEntryIds = options?.onlyEntryIds;
  const summary: GenerateSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };

  let workingManifest: ManifestDocument = manifest;
  const total = countEntriesToGenerate(manifest, settings, onlyEntryIds);

  // e.g. `--types concepts` but manifest only has references — nothing to do, no sandbox.
  if (total === 0) {
    consola.info('[gen] No entries to generate for selected types.');
    return { summary, manifest: workingManifest };
  }

  if (settings.dryRun) {
    consola.info(`[gen] Dry run: would generate ${total} page(s) via saifctl sandbox.`);
    summary.skipped = total;
    return { summary, manifest: workingManifest };
  }

  // Single prefix for all phases: output-dir must sit under project-dir so extract can apply hunks.
  let extractPrefix: string;
  try {
    extractPrefix = extractIncludePrefix(settings.projectDir, settings.outputDir);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    consola.error(`[gen] ${msg}`);
    // Fail every row we would have attempted so callers get a full failure list.
    for (const t of GEN_PHASES) {
      if (!settingsIncludesType(settings, t)) continue;
      for (const entry of entriesForPhase(manifest, t, onlyEntryIds)) {
        summary.failures.push({ id: entry.id, message: msg });
      }
    }
    summary.failed = total;
    return { summary, manifest: workingManifest };
  }

  consola.info(`[gen] Generating ${total} page(s) (extract-include: ${extractPrefix})…`);

  const updatedEntries = [...manifest.entries];

  const entriesToRun: ManifestEntry[] = [];

  try {
    const built = await buildAllSubtasksOrdered({
      manifest,
      settings,
      onlyEntryIds,
    });
    entriesToRun.push(...built.entries);

    const subtasksFile = await buildSubtasksJsonFile(built.subtasks);
    const name = allSubtasksSandboxName(built.entries);
    const saifctlDir = settings.saifctlDir?.trim() || 'saifctl';
    const gateRetries = settings.gateRetries ?? DEFAULT_GATE_RETRIES;

    const { code } = await runSandbox({
      projectDir: settings.projectDir,
      saifctlDir,
      ...(settings.saifctlConfig ? { saifctlConfig: settings.saifctlConfig } : {}),
      ...(settings.cedarPolicyPath?.trim()
        ? { cedarPolicyPath: settings.cedarPolicyPath.trim() }
        : {}),
      subtasksFile,
      extractInclude: extractPrefix,
      name,
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

    const results = new Map<string, boolean>();
    if (code === 0) {
      for (const entry of built.entries) results.set(entry.id, true);
    } else {
      await Promise.all(
        built.entries.map(async (entry) => {
          results.set(entry.id, await outputFileLooksSuccessful(entry.output));
        }),
      );
    }

    let anySuccess = false;

    for (let i = 0; i < built.entries.length; i++) {
      const entry = built.entries[i]!;
      const phase = built.phases[i]!;
      summary.attempted++;

      const phaseLabel = phase.replace(/s$/, '');
      consola.info(`[gen] ${phaseLabel}: ${entry.id}`);

      const ok = results.get(entry.id) ?? false;
      if (ok) {
        summary.succeeded++;
        const idx = updatedEntries.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
          updatedEntries[idx] = {
            ...updatedEntries[idx]!,
            generatedAt: new Date().toISOString(),
          };
          anySuccess = true;
        }
        consola.success(`[gen] ✓ ${entry.id}`);
      } else {
        summary.failed++;
        summary.failures.push({
          id: entry.id,
          message: 'saifctl sandbox subtask failed or output missing',
        });
        consola.error(`[gen] ✗ ${entry.id} — saifctl sandbox failed`);
      }
    }

    if (anySuccess) {
      workingManifest = { ...workingManifest, entries: updatedEntries };
      await writeManifestToDocspec(settings.docspecDir, workingManifest);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const toFail =
      entriesToRun.length > 0
        ? entriesToRun
        : GEN_PHASES.flatMap((t) =>
            settingsIncludesType(settings, t) ? entriesForPhase(manifest, t, onlyEntryIds) : [],
          );
    for (const entry of toFail) {
      summary.attempted++;
      summary.failed++;
      summary.failures.push({ id: entry.id, message: msg });
      consola.error(`[gen] ✗ ${entry.id} — ${msg}`);
    }
  }

  if (summary.failed === 0) {
    consola.success(`[gen] Done. ${summary.succeeded} page(s) generated.`);
  } else {
    consola.warn(
      `[gen] Done with errors: ${summary.succeeded} succeeded, ${summary.failed} failed (of ${summary.attempted} attempted).`,
    );
  }

  return { summary, manifest: workingManifest };
}
