/**
 * Core logic for `saifdocs update` — testable without `process.exit` / citty.
 *
 * Flow: read last `docspec/.manifest.json` → mark entries stale when any `read` path is newer than
 * `generatedAt` (same as `validate`) → re-run sandbox only for those rows via `generateEntries` with
 * `onlyEntryIds`. Does not rebuild the manifest from docspec; use `gen` when structure or `read`
 * lists change.
 */
import { generateEntries, type GenerateSummary } from '../generation/generate.js';
import { readManifestFromDocspec } from '../manifest/reader.js';
import type { GenSettings, ManifestDocument, OutputType } from '../manifest/types.js';
import { type StaleEntry, validateManifest } from '../validate/validate.js';
import type { SandboxPassthroughReadResult } from './sandbox.js';

/** Injectable I/O for tests (real disk reader + real generator by default). */
export type UpdateCoreDeps = {
  readManifestFromDocspec: (docspecDir: string) => Promise<ManifestDocument | null>;
  generateEntries: typeof generateEntries;
};

export type UpdateCoreInput = {
  /** Root of docspec tree (contains `.manifest.json`). */
  docspecDir: string;
  /** Generated docs root; must sit under `projectDir` for sandbox extract. */
  outputDir: string;
  /** Repo root (reference sources, extract prefix). */
  projectDir: string;
  /** Limit staleness checks / regen to these manifest `type` values (mirrors `gen --types`). */
  types: OutputType[] | 'all';
  /** If true, list stale entries only; no sandbox. */
  dryRun: boolean;
  /** Treat missing `.manifest.json` as success (CI / fresh clone). */
  allowMissingManifest: boolean;
  /** CLI string (e.g. "8") or pre-parsed positive integer */
  gateRetries: string | number;
  saifctlConfig?: string;
  saifctlDir?: string;
  /** Fires immediately before `generateEntries` (after stale detection, not in dry-run). */
  onRegenerating?: (staleCount: number) => void;
  /** Forwarded to `saifctl sandbox` (same flags as `saifdocs gen`). */
  sandboxPassthrough?: SandboxPassthroughReadResult;
};

/** `code` matches CLI exit: 0 ok, 1 regen/validation failure, 2 manifest I/O or missing file. */
export type UpdateCoreResult =
  | { code: 0; kind: 'missing-manifest-skipped' }
  | { code: 2; kind: 'missing-manifest-error' }
  | { code: 2; kind: 'read-manifest-failed'; message: string }
  | { code: 0; kind: 'nothing-to-update' }
  | { code: 0; kind: 'dry-run'; stale: StaleEntry[] }
  | { code: 0; kind: 'success'; summary: GenerateSummary }
  | { code: 1; kind: 'generate-failed'; summary: GenerateSummary }
  | { code: 1; kind: 'invalid-gate-retries'; raw: string };

const defaultDeps: UpdateCoreDeps = {
  readManifestFromDocspec,
  generateEntries,
};

/** Parse `--gate-retries`; stale branch runs only after dry-run, so invalid values skip sandbox. */
function parseGateRetries(
  raw: string | number,
): { ok: true; n: number } | { ok: false; raw: string } {
  const s = typeof raw === 'number' ? String(raw) : raw.trim();
  const n = typeof raw === 'number' ? raw : parseInt(s, 10);
  if (Number.isNaN(n) || n < 1) {
    return { ok: false, raw: s };
  }
  return { ok: true, n };
}

/**
 * Load manifest, find stale entries (same rules as `validate`), optionally regenerate via sandbox.
 * Passes the **full** manifest into `generateEntries` so non-stale rows keep their `generatedAt`.
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

  // File-level staleness: any `read` path mtime > entry.generatedAt (see validateManifest).
  const validation = await validateManifest(manifest, { types: input.types });
  const staleIds = new Set(validation.stale.map((s) => s.id));

  if (staleIds.size === 0) {
    return { code: 0, kind: 'nothing-to-update' };
  }

  if (input.dryRun) {
    return { code: 0, kind: 'dry-run', stale: validation.stale };
  }

  const parsedRetries = parseGateRetries(input.gateRetries);
  if (!parsedRetries.ok) {
    return { code: 1, kind: 'invalid-gate-retries', raw: parsedRetries.raw };
  }

  const settings: GenSettings = {
    docspecDir: input.docspecDir,
    outputDir: input.outputDir,
    projectDir: input.projectDir,
    types: input.types,
    saifctlConfig: input.saifctlConfig,
    saifctlDir: input.saifctlDir ?? 'saifctl',
    gateRetries: parsedRetries.n,
    dryRun: false,
    ...(input.sandboxPassthrough ?? {}),
  };

  input.onRegenerating?.(staleIds.size);

  // generateEntries walks phases in order; filter limits sandbox to stale ids only.
  const { summary } = await deps.generateEntries(manifest, settings, { onlyEntryIds: staleIds });

  if (summary.failed > 0) {
    return { code: 1, kind: 'generate-failed', summary };
  }
  return { code: 0, kind: 'success', summary };
}
