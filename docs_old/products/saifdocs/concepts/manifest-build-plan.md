# The manifest: saifdocs' build plan

Before saifdocs sends a single page to an AI agent, it writes a file called `.manifest.json`. That file is the build plan for the entire documentation run — and understanding what it contains, why it exists, and how other commands use it will help you reason about every part of the saifdocs workflow.

## What the manifest is

The manifest is a JSON file, written to `.manifest.json` at the root of your repository, that describes every page saifdocs intends to generate. Each entry in the manifest corresponds to one output file and looks roughly like this:

```json
{
  "outputPath": "docs/products/myapp/concepts/retry-semantics.md",
  "type": "concepts",
  "read": [
    "docspec/products/myapp/product.md",
    "docspec/products/myapp/personas/api-user/persona.md",
    "docspec/products/myapp/personas/api-user/rules.md",
    "docspec/products/myapp/concepts/retry-semantics.md"
  ],
  "generatedAt": null
}
```

Two fields are worth focusing on:

**`read`** — the exact list of files the agent must read before writing this page. This is compiled by `saifdocs gen` from the `docspec/` tree and baked into the manifest. At generation time, the agent receives this list and reads only those files — no broader scanning, no guessing. This is what lets the agent produce accurate, context-aware output without access to your entire repository.

**`generatedAt`** — a timestamp, set to `null` before generation and filled in once a page is successfully written. This single field is what powers staleness detection: `saifdocs update` and `saifdocs validate` compare each entry's `generatedAt` against the modification times of its `read` files to decide whether the page is stale.

## The Makefile analogy

If you have worked with `make`, the mental model maps closely:

- Each manifest entry is like a `Makefile` target.
- The `read` list is the target's dependency list.
- `generatedAt` plays the role of the target's output timestamp.
- `saifdocs update` is like `make`'s default behavior: rebuild only what's out of date.

Or think of the manifest as a lockfile — similar to `package-lock.json` or `Cargo.lock` — that records exactly which input files were used to produce each output. Just as a lockfile lets you reproduce a build reliably, the manifest lets saifdocs regenerate only what has drifted.

## How the manifest is written

`saifdocs gen` is the only command that writes the manifest. It reads your entire `docspec/` directory, resolves which pages need to be generated and in what order, and writes `.manifest.json` before sending any work to the [saifctl](../../saifctl/concepts/what-is-saifctl.md) sandbox.

This separation — write the plan first, then execute it — means that the plan itself can be inspected before anything is generated:

```
saifdocs gen --dry-run
```

`--dry-run` writes `.manifest.json` but does not invoke any sandbox. You can open the file and confirm that every output path is accounted for, every `read` list looks reasonable, and the page types are all correct — before spending any compute.

## How other commands use the manifest

Once the manifest exists, the other saifdocs commands read it rather than re-parsing `docspec/`. This is intentional: re-parsing the `docspec/` tree is something only `saifdocs gen` does. The downstream commands trust the manifest as the source of truth for what was generated and from what inputs.

| Command | What it reads | What it writes |
|---|---|---|
| `saifdocs gen` | `docspec/` | `.manifest.json`, then all output pages |
| `saifdocs update` | `.manifest.json` | Only the stale output pages; updates `generatedAt` |
| `saifdocs validate` | `.manifest.json` | Nothing — exits non-zero if any entry is stale |
| `saifdocs audit` | `.manifest.json` | Nothing — reports entries whose output files are missing |

This means that if you change the structure of your `docspec/` tree — add a new persona, rename a concept file, or add a product — you must re-run `saifdocs gen` to rebuild the manifest. `saifdocs update` will not pick up structural changes; it only checks whether existing entries are stale by modification time.

## Why `generatedAt` matters for staleness

The staleness model in saifdocs is deliberately simple: an entry is stale if any file in its `read` list has been modified more recently than `generatedAt`.

No file hashing, no content diffing. Just modification times, compared against a recorded timestamp.

This design has a practical consequence: if you touch a file in `read` — say, you update a persona description — every page that listed that file in its `read` list will be considered stale on the next `saifdocs validate` run. That is the intended behavior. A persona change affects every page written for that persona, and saifdocs will ask you to regenerate them.

See [Staleness tracking](./staleness-tracking.md) for a deeper look at how `saifdocs update` and `saifdocs validate` use this mechanism, including how to use `saifdocs validate` in CI to catch drift before it reaches production.

## What the manifest is not

The manifest is not a cache of generated content. It does not store page prose, summaries, or embeddings. It is a structural record — a plan and a receipt — kept deliberately lean so it can be committed to version control and inspected at a glance.

It is also not hand-edited. The manifest is owned by saifdocs. If you find yourself wanting to modify `.manifest.json` directly, that is usually a signal that you need to update your `docspec/` tree and re-run `saifdocs gen`.

## Summary

The manifest is how saifdocs separates planning from execution. `saifdocs gen` reads your `docspec/` intent tree once, compiles a complete build plan, and then works from that plan — as do all the downstream commands. The `read` list on each entry gives agents exactly the context they need; `generatedAt` gives staleness detection its timestamp anchor; and `--dry-run` lets you inspect the plan before any pages are written.

For the full picture of how the manifest feeds into the generation pipeline, see [The Generation Pipeline](./generation-pipeline.md).
