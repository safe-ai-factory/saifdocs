---
source: vendor/saifdocs/src/cli/commands/validate.ts
type: cli-command
---

Staleness check: reads `.manifest.json` and reports any entry whose `read` inputs have been modified after `generatedAt`. Exits 1 if stale entries exist, 0 if all are up to date.

Use `--json` for machine-readable output (CI pipelines). Use `--allow-missing-manifest` to skip gracefully when no manifest exists yet (useful early in a project lifecycle).
