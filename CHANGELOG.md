# Changelog

All notable changes to saifdocs are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); saifdocs follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] — 2026-05-09

### Changed (BREAKING)

- **Content-hash staleness instead of mtimes.** Each manifest entry now
  carries `outputHash` (SHA-256 of the output file) and `inputHashes`
  (SHA-256 of each `read` path, parallel to `read[]`); both are `null`
  until populated by `gen` / `update` / `clear` / `audit`. The
  `generatedAt` field is retained as informational metadata (the time
  hashes were last computed) but no longer drives staleness decisions.

  Why: mtime-based staleness was unreliable across any transport that
  resets filesystem mtimes — fresh git checkouts (every file gets the
  clone time), `cp`/`rsync` without `-t`, `tar` without `-p`, etc. In CI
  on a fresh clone, validate became a coin flip. SHA-256 over file
  bytes is filesystem-independent and correctly fires only when content
  actually changed.

  Existing manifests written by 0.3.x lack the new fields and fail the
  reader's schema validation; run `saifdocs gen --dry-run` to rewrite
  the manifest with hashes populated for every output that exists.

  Validate's stale-reason vocabulary is updated: `(never generated)`,
  `(output file missing)`, `(output file modified externally)`,
  `(read list changed since last gen)`, plus per-path entries for any
  `read` whose hash differs from the recorded one.

  The helper `populateGeneratedAtFromOutputs` (introduced in 0.3.2) is
  renamed to `populateHashesFromFiles` to reflect its new responsibility.

## [0.3.2] — 2026-05-08

### Fixed

- **`generatedAt` was never written to non-null values** — the manifest
  builder always emitted `null`, and no codepath updated it after a
  successful regeneration. As a result `saifdocs validate` (and
  `update`'s staleness check, which shares the logic) reported every
  entry as stale "(never generated)" even immediately after a clean
  `gen` + `saifctl feat run`. The CI swap from `gen --dry-run` to
  `validate` was unimplementable while this gap existed.

  New helper `populateGeneratedAtFromOutputs` (in
  `src/manifest/freshness.ts`) stats each entry's `output` path and
  writes its mtime as an ISO 8601 timestamp (or `null` if the file is
  missing). Wired in:
  - `gen` — runs the helper after `buildManifest`, before persisting,
    so the manifest written to `<docspec>/.manifest.json` reflects
    actual disk state.
  - `update` — refreshes in-memory before staleness checks so
    "regenerate stale entries" sees current state without requiring a
    prior `gen` run.
  - `clear` — refreshes and persists the manifest after deletion;
    cleared outputs become `null` automatically.
  - `audit` — refreshes and persists the manifest as part of its
    docspec ↔ outputDir reconciliation pass.

  After this change, the first `saifdocs gen` (or `gen --dry-run`)
  against an existing project populates `generatedAt` for every entry
  whose output already exists on disk. No manual manifest edits
  required.

## [0.3.1] — 2026-05-06

### Fixed

- **`output.spec.ts` body-content check always failed** — POSIX awk
  semantics gotcha: the program had `/[^[:space:]]/ { print; exit 0 }`
  followed by `END { exit 1 }`. Per POSIX, `exit 0` from a regular rule
  routes through END, and END's `exit 1` overrides — so the spec
  reported "no body content" even when the matching rule had clearly
  printed a non-empty line. Replaced the awk-and-exit-status approach
  with `cat` over the sidecar plus a JS regex that strips a leading
  YAML frontmatter (`/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n?/`) and
  asserts the remaining body is non-empty. Sidesteps awk dialect
  variation (mawk vs gawk vs bwk) and is easier to read.

## [0.3.0] — 2026-05-06

### Changed (BREAKING)

- **Per-phase post-condition is now a vitest spec, not a bash gate.**
  Previously, each phase emitted `phases/<id>/tests/gate.sh` (a bash
  script asserting the doc page was written). Saifctl's per-phase test
  contract is a **test-profile-shaped spec file** (vitest by default,
  matched by `**/*.{test,spec}.?(c|m)[jt]s?(x)`); a bash script was
  never picked up, which caused `saifctl feat run` to abort every
  phase with `No test files found, exiting with code 1`.

  Saifdocs now emits `phases/<id>/tests/public/output.spec.ts` — a
  self-contained vitest spec that reaches the staging container via
  saifctl's HTTP sidecar (`SAIFCTL_SIDECAR_URL`) and verifies file
  existence, non-emptiness, and body content beyond any YAML
  frontmatter (same three checks the gate script performed). The
  template export `renderGateScript` is replaced by `renderOutputSpec`;
  both `compileManifestToFeatureTree` and `compileReviewToFeatureTree`
  now write to `tests/public/output.spec.ts`.

### Migration

Already-emitted feature dirs from saifdocs ≤0.2 still contain
`tests/gate.sh`; re-emit with `saifdocs gen --feature-id <id>` to
regenerate them in place, or convert by hand — the new spec is at
`phases/<id>/tests/public/output.spec.ts` and follows the renderer
output exactly.

## [0.2.0] — 2026-05-05

### Changed (BREAKING)

- **`saifdocs clear` now only deletes files listed in the manifest.** Previously it ran
  `rm -rf $outputDir` indiscriminately. Now it reads `<docspec>/.manifest.json`
  and deletes only the files declared in `entries[].output` that fall under
  `--output-dir`. Empty parent directories are pruned up to (but not
  including) `--output-dir`. Behaviour: missing manifest → no-op; manifest
  entries pointing outside `--output-dir` → ignored; stale entries (file
  already absent) → tolerated. This lets handwritten files (e.g.
  `docs/contributing/`) co-exist alongside generated content without being
  wiped on `clear`. New `--docspec-dir` flag (defaults to `docspec/`).

## [0.1.0] — 2026-05-04

### Changed (BREAKING)

- **`saifdocs gen` now emits a saifctl feature tree** (one timestamped
  feature dir under `<project>/saifctl/features/saifdocs-<timestamp>/`,
  with one phase per file-to-generate) instead of running the LLM itself.
  Run `saifctl feat run --feature <id>` afterwards to generate the docs.
- **`saifdocs review`** emits a single-phase review feature (`critics: []`).
- **`saifdocs update`** emits a feature tree containing only stale phases
  (same staleness rules as `validate`). Run `saifctl feat run` afterwards.
- **`update-core.ts` result shape**: `invalid-gate-retries` and
  `generate-failed` replaced by `compile-failed`. The success variant
  returns the compiled feature result.

### Added

- `--saifctl-features-dir` flag (default `<project-dir>/saifctl/features`).
- `--feature-id` flag — override the default timestamped id, e.g. for
  in-place regeneration.
- Documentation-review `audit` critic prompt — runs in fresh LLM context
  after each generated page; tuned for omissions, false claims, drift
  from source, Diátaxis adherence, tone.
- New modules `src/features/{compiler,timestamp,templates,howto-hints}.ts`.

### Removed

- CLI flags: `--gate-retries`, `--saifctl-config`, `--saifctl-dir`,
  `--cedar`, `--strict-network`, and the entire sandbox-passthrough
  block (model, base-url, agent, agent-script, agent-install-script,
  profile, startup-script, coder-image, engine, dangerous-no-leash,
  sandbox-base-dir, agent-env*, agent-secret*, verbose).
- Runtime dependency on `@safe-ai-factory/saifctl` (moved to
  `devDependencies` for tests).
- `review.cedar` and `review-strict.cedar` shipped policies.
- `src/generation/{generate,run-sandbox,reference-gate}.ts` and
  `src/cli/sandbox.ts`.
- `getDefaultReviewCedarPath` / `getDefaultReviewStrictCedarPath` /
  `REVIEW_CEDAR_FILENAME` / `REVIEW_STRICT_CEDAR_FILENAME` /
  `DEFAULT_GATE_RETRIES` constants.
- `RunSandboxPassthroughFields` type (and the cedar / saifctl /
  gate-retries fields on `GenSettings`).
