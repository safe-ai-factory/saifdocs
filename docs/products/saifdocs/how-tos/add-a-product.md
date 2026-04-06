# Add a product

This guide outlines how to add a **new product** to the Saifdocs docspec so Saifdocs can emit `products/<id>/` pages alongside existing SaifCTL and Saifbox documentation.

## Prerequisites

- You understand the [docspec](../concepts/docspec.md) layout.
- You can run [`saifdocs gen`](../../../references/commands/gen.md) from the repository root.

## Steps (summary)

1. Create `docspec/products/<product-id>/` with `product.md`, personas, and concepts as needed.
2. Register reference pointers if the product shares CLI commands with an existing tool or add new reference stubs.
3. Rebuild the manifest (`gen` or manifest-only flow, depending on your workflow).
4. Run generation for the new product’s types and verify outputs under `docs/products/<product-id>/`.

## See also

- [Generation pipeline](../concepts/generation-pipeline.md)
- [Generate your first docs](../tutorials/generate-first-docs.md)
