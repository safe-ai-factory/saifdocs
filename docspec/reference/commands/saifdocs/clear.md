---
source: vendor/saifdocs/src/cli/commands/clear.ts
type: cli-command
---

Delete the generated documentation output directory (`docs/` by default). Useful before a full regeneration or to clean up in CI.

Does not touch `docspec/` or `.manifest.json`. After clearing, run `saifdocs gen` to regenerate from scratch.
