# `saifdocs gen`

Generate documentation from a docspec: build or refresh `.manifest.json` entries and run the configured sandbox pipeline to write Markdown under the output directory.

## When to use it

Use `gen` when you change docspec inputs (products, concepts, reference pointers, how-to intents) and need regenerated pages.

## See also

- [Validate docspec and outputs](../../products/saifdocs/concepts/docspec.md) — how inputs are structured before generation
- [`saifdocs audit`](audit.md) — structural checks without regeneration
- [`saifdocs validate`](validate.md) — staleness vs manifest `read` lists
