# Generate your first docs

This tutorial walks through running Saifdocs end-to-end once your docspec is in place: manifest, sandbox generation, and validating outputs.

## Before you start

Read [Docspec](../concepts/docspec.md) and skim [Generation pipeline](../concepts/generation-pipeline.md).

## Outline

1. From the repo root, ensure `docspec/.manifest.json` matches your docspec (run `saifdocs gen` or your project’s documented manifest build step).
2. Run generation for the types you need (often `all` or a subset such as `references` then `concepts`).
3. Open generated files under the output directory and confirm internal links resolve.
4. Run [`saifdocs validate`](../../../references/commands/validate.md) to confirm nothing is stale, or [`saifdocs audit`](../../../references/commands/audit.md) for a quick structural check.

## Next steps

- [Add a product](../how-tos/add-a-product.md) when you introduce another product line in the docspec.
