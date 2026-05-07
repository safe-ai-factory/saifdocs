# Staleness tracking

When a source file changes, `saifdocs` needs to know which generated pages are now out of date. Staleness tracking is the mechanism that answers that question — efficiently, without re-running any LLM.

## How staleness is determined

Every entry in `docspec/.manifest.json` records a `generatedAt` timestamp and a `read` array — the exact list of files the AI agent opened when it produced that page:

```json
{
  "id": "saifdocs/concepts/staleness-tracking",
  "output": "/workspace/docs/products/saifdocs/concepts/staleness-tracking.md",
  "read": [
    "/workspace/docspec/products/saifdocs/concepts/staleness-tracking.md",
    "/workspace/docspec/products/saifdocs/product.md",
    "/workspace/docspec/products/saifdocs/personas/docs-author/persona.md",
    "/workspace/docspec/products/saifdocs/personas/docs-author/rules.md",
    "/workspace/docspec/products/saifdocs/rules.md"
  ],
  "generatedAt": "2026-05-07T09:40:56.214Z"
}
```

An entry is **stale** when any file in its `read` array has a modification time (`mtime`) newer than `generatedAt`. If `generatedAt` is `null`, the page has never been generated and is always considered stale.

This is the same principle underlying `make`'s rebuild-if-newer rule: instead of re-executing every target, only the targets whose inputs changed since the last successful build are re-run. `saifdocs` applies that same logic to documentation pages — compare recorded timestamps against current file mtimes, and only regenerate what drifted.

## The two staleness-aware commands

```
saifdocs validate   # report which entries are stale — no LLM calls
saifdocs update     # regenerate only stale entries
```

`saifdocs validate` reads `docspec/.manifest.json`, compares each `generatedAt` against the mtimes of its `read` files, and reports any stale entries. It does not touch the output files or invoke any AI. This makes it safe to run in CI as a pure check.

`saifdocs update` performs the same staleness check, then emits a [`saifctl` feature tree](./generation-pipeline.md) containing only the stale phases. Running `saifctl feat run` on that tree regenerates only the pages that need it — equivalent to an incremental compilation pass where unchanged translation units are skipped.

```
docspec/ (source files modified)
        │
        ▼
saifdocs validate
  └─ reads docspec/.manifest.json
  └─ compares generatedAt vs mtime of each read[] file
  └─ prints stale entries (exit code 1 if any found)

        OR

saifdocs update
  └─ same staleness check
  └─ emits feature tree (stale phases only)
        │
        ▼
saifctl feat run --feature <id>
  └─ regenerates only stale pages
        │
        ▼
docs/ (updated pages)
```

## What `update` does not do

`saifdocs update` only regenerates output files. It does **not** rebuild the manifest. The manifest records the dependency graph — which intent files, product descriptions, personas, and rules feed into each page. That graph is only rebuilt by `saifdocs gen`.

If you add a new concept file, rename a persona, or restructure your `docspec/` directory, run `saifdocs gen` to produce a fresh manifest. Use `saifdocs update` only when the `docspec/` structure is stable and you want to refresh pages whose source content has changed.

A useful mental model: `saifdocs gen` is like a full build that recompiles everything and rewrites the dependency file. `saifdocs update` is like an incremental build that reuses the existing dependency file and only recompiles what changed.

## Using `validate` in CI

Because `saifdocs validate` makes no LLM calls and produces a non-zero exit code when stale entries exist, it fits cleanly into a CI pipeline:

```yaml
# Example: GitHub Actions step
- name: Check docs freshness
  run: saifdocs validate
```

This catches documentation that has drifted from its source — for example, a rules file was updated but the pages that depend on it were never regenerated — without blocking the full generation pipeline or incurring AI costs on every commit.

A non-zero exit code signals that stale pages exist; `saifdocs update` is the companion command that regenerates them without requiring a full re-run of `saifdocs gen`.

## Related pages

- [The manifest build plan](./manifest-build-plan.md) — how `generatedAt` and `read` arrays are written
- Keep docs fresh (how-to) — step-by-step guide to running `update` after source changes _(page forthcoming)_
