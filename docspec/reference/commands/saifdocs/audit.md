---
source: vendor/saifdocs/src/cli/commands/audit.ts
type: cli-command
---

Gap check: compares every page declared in `docspec/` against files on disk under `output-dir`. Reports missing references, concepts, how-tos, tutorials, landing pages, and unknown prereq concepts. Exits 1 if any gaps exist.

Writes `docs/audit.md` by default (`--no-write-report` to skip). Distinct from `validate`: audit checks structural completeness (does the file exist?), not freshness (is the content current?).
