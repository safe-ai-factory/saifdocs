# Changelog

All notable changes to saifdocs are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); saifdocs follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
