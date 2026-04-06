---
source: vendor/saifdocs/src/cli/commands/update.ts
type: cli-command
---

Incremental regeneration: reads the existing `.manifest.json`, checks which entries have any `read` input newer than `generatedAt`, and reruns the sandbox only for those stale entries.

Does not rebuild the manifest structure. Run `saifdocs gen` when you add new products, personas, concepts, or change which pages the manifest should contain. Run `saifdocs update` when only the source content has changed.
