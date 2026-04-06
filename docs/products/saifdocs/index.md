# Saifdocs

**Saifdocs** is the spec-driven documentation generator for the Safe AI Factory stack. It turns a structured **docspec** (products, concepts, reference pointers, how-tos, tutorials) into consistent Markdown and a machine-readable **manifest** so sites and CI can ingest docs deterministically.

## Who this is for

- Maintainers extending SaifCTL, Saifbox, or Saifdocs documentation.
- Teams wiring generated docs into a static site (e.g. under `/product/saifdocs/`).

## Where to go next

- [Docspec](concepts/docspec.md) — how inputs are organized
- [Generation pipeline](concepts/generation-pipeline.md) — phase order and outputs
- [Generate your first docs](tutorials/generate-first-docs.md) — hands-on path
- CLI reference: [`saifdocs gen`](../../references/commands/gen.md), [`validate`](../../references/commands/validate.md), [`audit`](../../references/commands/audit.md)
