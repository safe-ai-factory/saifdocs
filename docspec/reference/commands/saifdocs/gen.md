---
source: vendor/saifdocs/src/cli/commands/gen.ts
type: cli-command
---

Full generation: read `docspec/`, write `.manifest.json`, then generate all selected page types via saifctl sandbox. Runs phases in order: references → concepts → how-tos → tutorials → landing-pages.

Use `--dry-run` to build and write the manifest without invoking the sandbox. Use `--types` to limit which page categories are generated.
