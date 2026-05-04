---
source: vendor/saifdocs/src/cli/commands/review.ts
type: cli-command
---

Persona-simulation quality review: emits a single-phase saifctl feature whose deliverable is a markdown report. The phase prompt instructs the agent to roleplay the named persona attempting the named task using only the generated docs; the report is written under `docs/review/<product>/<persona>/<task>-<timestamp>.md` when the consumer runs `saifctl feat run --feature <id>` afterwards.

Saifdocs ships **no Cedar policy** — the consumer repo decides per-feature policy via its own `feature.yml` or `--cedar` flag on `saifctl feat run`.

Requires `--product`, `--persona`, and `--task` (all three are mandatory). Use `--feature-id <stable-id>` to override the default timestamp-based feature id. Use `--saifctl-features-dir <path>` to override the default output location.
