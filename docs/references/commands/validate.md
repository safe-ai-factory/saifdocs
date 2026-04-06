# `saifdocs validate`

Check whether manifest entries are stale: compares `generatedAt` and modification times of every path in each entry’s `read` array.

## When to use it

Use `validate` before a release or after editing docspec sources to see which outputs need `saifdocs update` or `gen`.

## See also

- [`saifdocs gen`](gen.md)
- [Docspec concepts](../../products/saifdocs/concepts/docspec.md) — what `read` lists represent
