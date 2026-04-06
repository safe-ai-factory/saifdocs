---
source: vendor/saifdocs/src/cli/commands/review.ts
type: cli-command
---

Persona-simulation quality review: runs an AI agent via saifctl sandbox that roleplays the named persona attempting the named task using only the generated docs. Produces a report under `docs/review/`.

Requires `--product`, `--persona`, and `--task` (all three are mandatory). Use `--strict-network` to apply the packaged `review-strict.cedar` policy (allowlists common LLM API hosts and package registries). Use `--cedar` to supply a custom Leash policy.
