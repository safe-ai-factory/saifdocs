# Docspec

The **docspec** is the declarative description of what Saifdocs should document: products, personas, concepts, reference pointers (e.g. CLI commands), how-to intents, and tutorials. Saifdocs reads these files under `docspec/` and produces a `.manifest.json` that lists every output page, its type, and the input paths that justify regeneration.

## What lives in the docspec

- **Products** — one folder per product (`saifctl`, `saifbox`, future `saifdocs`), with `product.md`, personas, concepts, and task definitions.
- **References** — pointers at source (TypeScript CLI files, APIs) with templates for generated reference pages.
- **Rules** — shared constraints passed into generation (e.g. `rules.md`).

## Relationship to the manifest

The manifest is the **contract** between docspec and outputs: each row has an `output` path, a `type` (references, concepts, how-tos, tutorials, landing-pages), and a `read` array used for staleness and sandbox inputs.

## See also

- [Generation pipeline](generation-pipeline.md) — order phases run
- [Add a product](../how-tos/add-a-product.md) — extend the docspec for a new product
- [`saifdocs validate`](../../../references/commands/validate.md)
