# Generation pipeline

Saifdocs generates pages in a **fixed phase order** so downstream pages can safely depend on upstream outputs (for example, how-tos cite reference pages that already exist).

## Phase order

1. **References** — CLI / API / config schema pages.
2. **Concepts** — explanatory pages per product.
3. **How-tos** — task-oriented pages (may cite references and concepts).
4. **Tutorials** — multi-step narratives (may cite how-tos and concepts).
5. **Landing pages** — product `index.md` summaries.

Each phase is backed by manifest entries of the matching `type`. The orchestrator schedules sandbox work according to these phases.

## Outputs

Generated Markdown lives under the configured output directory (often repo `docs/`), with paths reflected in `.manifest.json` `output` fields.

## See also

- [Docspec](docspec.md)
- [Generate your first docs](../tutorials/generate-first-docs.md)
- [`saifdocs gen`](../../../references/commands/gen.md)
