# Changelog

All notable changes to saifdocs are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); saifdocs follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-05-05

### Changed (BREAKING)

- **`saifdocs clear` is now manifest-aware.** Previously it ran
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
