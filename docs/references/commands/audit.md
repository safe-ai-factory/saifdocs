# `saifdocs audit`

Run structural completeness checks on the docspec and expected outputs (distinct from `validate`, which compares file mtimes to manifest `read` paths).

## When to use it

Use `audit` in CI or locally when you want a fast pass that does not invoke the full generation sandbox.

## See also

- [`saifdocs gen`](gen.md) — full generation flow
- [`saifdocs validate`](validate.md) — staleness detection
- [Generation pipeline](../../products/saifdocs/concepts/generation-pipeline.md) — phase order and artifacts
