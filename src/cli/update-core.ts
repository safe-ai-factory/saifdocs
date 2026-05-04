/**
 * Core logic for `saifdocs update` — testable without `process.exit` / citty.
 *
 * Flow: read last `docspec/.manifest.json` → mark entries stale when any
 * `read` path is newer than `generatedAt` (same as `validate`) → emit a
 * feature tree containing **only** the stale phases via the compiler.
 *
 * Saifdocs no longer orchestrates anything — it just emits feature dirs.
 * The user runs `saifctl feat run --feature <id>` to actually regenerate.
 *
 * Optional `--entry` forces one id into the regen set regardless of
 * staleness.
 */
import {
  compileManifestToFeatureTree,
  type CompileToFeatureTreeResult,
} from '../features/compiler.js';
import { posixPath } from '../generation/output-paths.js';
import { readManifestFromDocspec } from '../manifest/reader.js';
import type { ManifestDocument, ManifestEntry, OutputType } from '../manifest/types.js';
import { type StaleEntry, validateManifest, type ValidateResult } from '../validate/validate.js';

/** Injectable I/O for tests (real disk reader + real compiler by default). */
export type UpdateCoreDeps = {
  readManifestFromDocspec: (docspecDir: string) => Promise<ManifestDocument | null>;
  compileManifestToFeatureTree: typeof compileManifestToFeatureTree;
};

export type UpdateCoreInput = {
  /** Root of docspec tree (contains `.manifest.json`). */
  docspecDir: string;
  /** Generated docs root (kept for staleness comparison; passed to compiler for output-rel paths). */
  outputDir: string;
  /** Repo root (used for workspace-relative paths inside the emitted spec.md files). */
  projectDir: string;
  /** Where the compiled feature dir is written (default: `<projectDir>/saifctl/features`). */
  saifctlFeaturesDir: string;
  /** Optional override for the timestamped feature id. */
  featureId?: string;
  /** Limit staleness checks / regen to these manifest `type` values (mirrors `gen --types`). */
  types: OutputType[] | 'all';
  /** If true, list stale entries only; do not emit a feature tree. */
  dryRun: boolean;
  /** Treat missing `.manifest.json` as success (CI / fresh clone). */
  allowMissingManifest: boolean;
  /** Fires immediately before the compile step (after stale detection, not in dry-run). */
  onRegenerating?: (staleCount: number) => void;
  /**
   * Manifest entry id or a suffix of `entry.output` (forward slashes). That
   * row is always included in the emitted feature (union with stale
   * entries). Must match `--types` when types is not `all`.
   */
  entry?: string;
};

/** `code` matches CLI exit: 0 ok, 1 user/config or compile failure, 2 manifest I/O or missing file. */
export type UpdateCoreResult =
  | { code: 0; kind: 'missing-manifest-skipped' }
  | { code: 2; kind: 'missing-manifest-error' }
  | { code: 2; kind: 'read-manifest-failed'; message: string }
  | { code: 0; kind: 'nothing-to-update' }
  | { code: 0; kind: 'dry-run'; stale: StaleEntry[] }
  | { code: 0; kind: 'success'; result: CompileToFeatureTreeResult }
  | { code: 1; kind: 'compile-failed'; message: string }
  | { code: 1; kind: 'entry-not-found'; selector: string }
  | { code: 1; kind: 'entry-ambiguous'; selector: string; candidates: string[] }
  | {
      code: 1;
      kind: 'entry-excluded-by-types';
      entryId: string;
      entryType: OutputType;
      types: OutputType[];
    };

const defaultDeps: UpdateCoreDeps = {
  readManifestFromDocspec,
  compileManifestToFeatureTree,
};

export type ResolveUpdateEntryResult =
  | { kind: 'ok'; id: string }
  | { kind: 'not-found' }
  | { kind: 'ambiguous'; candidates: string[] };

/**
 * Map `--entry` to a manifest row: exact `id`, or unique suffix of `entry.output` (forward slashes).
 */
export function resolveUpdateEntrySelector(
  manifest: ManifestDocument,
  selector: string,
): ResolveUpdateEntryResult {
  const trimmed = selector.trim();
  if (!trimmed) return { kind: 'not-found' };

  if (manifest.entries.some((e) => e.id === trimmed)) {
    return { kind: 'ok', id: trimmed };
  }

  const needle = posixPath(trimmed)
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '');
  if (!needle) return { kind: 'not-found' };

  const matches = manifest.entries.filter((e) => {
    const out = posixPath(e.output);
    return out === needle || out.endsWith(`/${needle}`);
  });

  if (matches.length === 1) return { kind: 'ok', id: matches[0]!.id };
  if (matches.length === 0) return { kind: 'not-found' };
  return { kind: 'ambiguous', candidates: matches.map((m) => m.id) };
}

function syntheticStaleForced(e: ManifestEntry): StaleEntry {
  return {
    id: e.id,
    output: e.output,
    staleSince: e.generatedAt ?? new Date(0).toISOString(),
    staleInputs: ['(forced via --entry)'],
  };
}

function buildDryRunStaleList(
  manifest: ManifestDocument,
  idsToRegen: Set<string>,
  validation: ValidateResult,
): StaleEntry[] {
  const staleById = new Map(validation.stale.map((s) => [s.id, s]));
  const out: StaleEntry[] = [];
  for (const e of manifest.entries) {
    if (!idsToRegen.has(e.id)) continue;
    out.push(staleById.get(e.id) ?? syntheticStaleForced(e));
  }
  return out;
}

/**
 * Load manifest, find stale entries (same rules as `validate`), optionally
 * emit a feature tree containing only those entries.
 */
export async function runUpdateCore(
  input: UpdateCoreInput,
  deps: UpdateCoreDeps = defaultDeps,
): Promise<UpdateCoreResult> {
  let manifest: ManifestDocument | null;
  try {
    manifest = await deps.readManifestFromDocspec(input.docspecDir);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 2, kind: 'read-manifest-failed', message };
  }

  if (manifest === null) {
    if (input.allowMissingManifest) {
      return { code: 0, kind: 'missing-manifest-skipped' };
    }
    return { code: 2, kind: 'missing-manifest-error' };
  }

  const entrySelector = input.entry?.trim();

  let forcedEntryId: string | null = null;
  if (entrySelector) {
    const resolved = resolveUpdateEntrySelector(manifest, entrySelector);
    if (resolved.kind === 'not-found') {
      return { code: 1, kind: 'entry-not-found', selector: entrySelector };
    }
    if (resolved.kind === 'ambiguous') {
      return {
        code: 1,
        kind: 'entry-ambiguous',
        selector: entrySelector,
        candidates: resolved.candidates,
      };
    }
    forcedEntryId = resolved.id;
    const ent = manifest.entries.find((e) => e.id === forcedEntryId);
    if (!ent) {
      return { code: 1, kind: 'entry-not-found', selector: entrySelector };
    }
    if (input.types !== 'all' && !input.types.includes(ent.type)) {
      return {
        code: 1,
        kind: 'entry-excluded-by-types',
        entryId: ent.id,
        entryType: ent.type,
        types: [...input.types],
      };
    }
  }

  // Staleness: never generated, missing output, or any `read` path mtime >
  // generatedAt (same logic as validateManifest).
  const validation = await validateManifest(manifest, { types: input.types });
  const staleIds = new Set(validation.stale.map((s) => s.id));

  const idsToRegen = new Set(staleIds);
  if (forcedEntryId) {
    idsToRegen.add(forcedEntryId);
  }

  if (idsToRegen.size === 0) {
    return { code: 0, kind: 'nothing-to-update' };
  }

  if (input.dryRun) {
    return {
      code: 0,
      kind: 'dry-run',
      stale: buildDryRunStaleList(manifest, idsToRegen, validation),
    };
  }

  input.onRegenerating?.(idsToRegen.size);

  try {
    const result = await deps.compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir: input.saifctlFeaturesDir,
      projectDir: input.projectDir,
      types: input.types,
      onlyEntryIds: idsToRegen,
      ...(input.featureId ? { featureId: input.featureId } : {}),
    });
    return { code: 0, kind: 'success', result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 1, kind: 'compile-failed', message };
  }
}
