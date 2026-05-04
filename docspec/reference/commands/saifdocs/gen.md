---
source: vendor/saifdocs/src/cli/commands/gen.ts
type: cli-command
---

Full compile: read `docspec/`, write `docspec/.manifest.json`, then emit a saifctl phases-and-critics feature tree under `<project>/saifctl/features/saifdocs-<timestamp>/` with one phase per file-to-generate. Phases are ordered: references → concepts → how-to's → tutorials → landing-pages.

Saifdocs does not invoke any AI model itself. Run `saifctl feat run --feature <id>` afterwards to actually generate the docs.

Use `--dry-run` to build and write the manifest without emitting a feature tree. Use `--types` to limit which page categories are included. Use `--feature-id <stable-id>` to override the default timestamp-based feature id (e.g. for in-place regeneration). Use `--saifctl-features-dir <path>` to override the default output location (defaults to `<project-dir>/saifctl/features`).
