# The manifest build plan

When you run `saifdocs gen`, the first thing it produces is not a feature tree — it is a file called `docspec/.manifest.json`. This manifest is the build plan: a precise, machine-readable record of every documentation page that needs to be generated, and exactly which source files must be read to generate each one.

Think of it the way a compiled build system thinks of targets and dependencies. Each entry in the manifest names one output file and lists the inputs — the intent file, product description, persona files, and rules — that feed into it. Nothing is inferred at generation time; the dependency graph was already resolved when the manifest was written.

## What the manifest contains

The manifest file has a document-level header and a flat list of entries:

```json
{
  "version": 1,
  "createdAt": "2026-05-07T09:40:56.214Z",
  "docspecDir": "/workspace/docspec",
  "outputDir": "/workspace/docs",
  "projectDir": "/workspace",
  "entries": [
    {
      "id": "saifdocs/concepts/manifest-build-plan",
      "type": "concepts",
      "output": "/workspace/docs/products/saifdocs/concepts/manifest-build-plan.md",
      "read": [
        "/workspace/docspec/products/saifdocs/concepts/manifest-build-plan.md",
        "/workspace/docspec/products/saifdocs/product.md",
        "/workspace/docspec/products/saifdocs/personas/docs-author/persona.md",
        "/workspace/docspec/products/saifdocs/personas/docs-author/rules.md",
        "/workspace/docspec/products/saifdocs/rules.md"
      ],
      "generatedAt": null,
      "productId": "saifdocs",
      "personaId": "docs-author",
      "conceptId": "manifest-build-plan",
      "taskIds": [],
      "tutorialPosition": null,
      "tutorialThreadLength": null
    }
  ]
}
```

Each entry's `read` array is the exact set of files the AI agent will open when it generates that page. The `output` field is the path where the result will be written. `generatedAt` starts as `null` and is set to an ISO timestamp once the page has been successfully generated.

## How the manifest fits into the pipeline

```
docspec/
  (intent files)
       │
       ▼
saifdocs gen
  ├─ writes docspec/.manifest.json   ← build plan
  └─ emits saifctl feature tree
       │
       ▼
saifctl feat run --feature <id>
  (one AI agent per phase, reads spec.md → reads manifest entry's files → writes output)
       │
       ▼
docs/
  (generated markdown pages)
```

`saifdocs gen` resolves the full dependency graph from `docspec/` once and encodes it into the manifest. [`saifctl`](../../../saifctl/concepts/overview.md) then runs the feature tree — one AI agent per phase — reading only the files listed in each phase's `spec.md`, derived directly from the manifest entry, without re-parsing `docspec/`.

## Staleness detection via `generatedAt`

The `generatedAt` field on each entry is what makes incremental workflows possible without re-running the full pipeline.

When `saifdocs validate` or `saifdocs update` needs to know whether a page is out of date, it reads the existing `docspec/.manifest.json` and compares each entry's `generatedAt` timestamp against the modification times of the files listed in its `read` array. If any input file was modified after `generatedAt`, the entry is stale. If `generatedAt` is `null`, the page has never been generated and is always considered stale.

This is similar to how a lockfile records the exact state of dependencies at install time: the lockfile is the source of truth for what was used, and checking for drift is a matter of comparing recorded state against current state — no re-computation required.

The result is that `saifdocs validate` can detect staleness in CI without invoking any LLM, and `saifdocs update` emits a feature tree containing only stale pages.

## The `--dry-run` flag

The `--dry-run` flag (default: `false`) lets you resolve and inspect the build plan without committing to generation: `saifdocs gen` writes `docspec/.manifest.json` but does not emit a feature tree. See [Generate your first docs](../how-tos/generate-first-docs.md) for a walkthrough that includes reviewing the manifest before running.

## Next steps

- To run the full generation pipeline, see [Generate your first docs](../how-tos/generate-first-docs.md).
- To regenerate only stale pages after source changes, see [Keep docs fresh](../how-tos/keep-docs-fresh.md).
- To understand the intent files that the manifest is built from, see [The docspec directory](./docspec.md).
