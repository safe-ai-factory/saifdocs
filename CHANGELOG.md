# Changelog

All notable changes to saifdocs are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); saifdocs follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (BREAKING)

- **Saifdocs is now a *compiler*, not an orchestrator.** Each `saifdocs gen`
  invocation writes the manifest and then emits a saifctl phases-and-critics
  feature tree under `<project>/saifctl/features/saifdocs-<timestamp>/`,
  with one phase per file-to-generate. The user (or CI) runs
  `saifctl feat run --feature <id>` afterwards to actually drive
  generation. Saifdocs no longer spawns `saifctl sandbox` itself.
- **Removed runtime dependency on `@safe-ai-factory/saifctl`.** It moved
  to `devDependencies` (used in tests only). Saifdocs is now publishable
  independently of saifctl.
- **`saifdocs review` rewritten** to emit a single-phase review feature
  (`critics: []`, no adversarial pass — the report IS the deliverable).
- **`saifdocs update` rewritten** to emit a feature tree containing only
  stale phases (uses the same staleness rules as `validate`). Run
  `saifctl feat run --feature <id>` afterwards.
- **Dropped saifdocs-shipped Cedar policies** (`review.cedar`,
  `review-strict.cedar`). The consumer repo decides per-feature policy
  via its own saifctl config or `--cedar` flag.
- **Removed CLI flags** that are no longer applicable: `--gate-retries`,
  `--saifctl-config`, `--saifctl-dir`, `--cedar`, `--strict-network`,
  and the entire `sandboxPassthroughArgs` block (model, base-url, agent,
  agent-script, agent-install-script, profile, startup-script,
  coder-image, engine, dangerous-no-leash, sandbox-base-dir, agent-env*,
  agent-secret*, verbose). All of these now live on the saifctl side.
- **New CLI flags:** `--saifctl-features-dir` (default
  `<project-dir>/saifctl/features`) and `--feature-id` (override the
  default timestamped id for in-place regeneration).
- **`update-core.ts` result shape changed**: `invalid-gate-retries` and
  `generate-failed` removed; `compile-failed` added. The success
  variant now returns the compiled feature result instead of a generate
  summary.

### Removed

- `src/generation/generate.ts`, `src/generation/run-sandbox.ts`,
  `src/generation/reference-gate.ts` (replaced by the compiler).
- `src/cli/sandbox.ts` (`sandboxPassthroughArgs` adapter, no longer
  needed).
- `review.cedar` and `review-strict.cedar` (dropped per the
  consumer-decides-policy design).
- `getDefaultReviewCedarPath` / `getDefaultReviewStrictCedarPath` /
  `REVIEW_CEDAR_FILENAME` / `REVIEW_STRICT_CEDAR_FILENAME` /
  `DEFAULT_GATE_RETRIES` constants.
- `RunSandboxPassthroughFields` type (and the cedar/saifctl/gate-retries
  fields on `GenSettings`).

### Added

- New module `src/features/compiler.ts` exporting
  `compileManifestToFeatureTree()` and `compileReviewToFeatureTree()`.
- New module `src/features/timestamp.ts` exporting
  `generateTimestampFeatureId()` and `validateFeatureId()`.
- New module `src/features/templates.ts` (feature.yml, plan.md,
  critics/audit.md, gate.sh templates).
- New module `src/features/howto-hints.ts` (extracted from the deleted
  generate.ts).
- Saifdocs's `audit` critic prompt
  (`features/templates.ts:renderAuditCriticMd()`) — uses saifctl
  phases-and-critics mustache vocabulary; tuned for documentation review
  (omissions, false claims, diátaxis adherence, tone).
