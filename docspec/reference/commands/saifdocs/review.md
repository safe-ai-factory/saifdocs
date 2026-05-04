---
source: vendor/saifdocs/src/cli/commands/review.ts
type: cli-command
---

Persona-simulation quality review: emits a single-phase saifctl feature whose deliverable is a markdown report. The phase prompt instructs the agent to roleplay the named persona attempting the named task using only the generated docs; the report is written under `docs/review/<product>/<persona>/<task>-<timestamp>.md` when you run `saifctl feat run --feature <id>` afterwards.

Requires `--product`, `--persona`, and `--task` (all three are mandatory). Use `--feature-id <stable-id>` to override the default timestamp-based feature id. Use `--saifctl-features-dir <path>` to override the default output location.
