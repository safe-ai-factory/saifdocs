# `saifdocs`

`saifdocs` turns a structured intent tree into a full documentation site — AI agents write every page, while you stay in control of the content spec.

You describe your product's audience, tasks, and concepts in a `docspec/` directory. `saifdocs gen` reads that tree, builds a manifest of every page that needs to exist, and emits a timestamped feature directory under `saifctl/features/`. You then use [`saifctl`](concepts/generation-pipeline.md) — `saifctl feat run --feature <id>` — to execute that feature tree and produce the actual markdown under `docs/`.

**Who this is for:** developers and technical writers who want accurate, audience-aware docs without writing every page by hand.

---

## How it works

```
docspec/  ──►  saifdocs gen  ──►  saifctl/features/<id>/  ──►  saifctl feat run  ──►  docs/
```

---

## Get started

| Step | Command |
|------|---------|
| Preview the manifest without writing any files | `saifdocs gen --dry-run` |
| Emit the feature tree | `saifdocs gen` |
| Generate all pages | `saifctl feat run --feature <id>` |

The [Generate your first docs](tutorials/docspec-to-docs.md) tutorial walks through the full workflow from an empty project.

---

## Common tasks

### Generate docs for the first time

Write a minimal `docspec/` tree, verify the manifest, then produce markdown output under `docs/`.

- [Tutorial: get started with saifdocs](tutorials/overview.md)
- [How-to: generate your first docs](how-tos/generate-first-docs.md)

### Keep docs fresh after source changes

When a CLI flag is renamed or a new command is added, emit a feature tree containing only the stale pages, then run it.

```
saifdocs validate                          # show what is stale
saifdocs update                            # emit a feature tree for stale pages only
saifctl feat run --feature <id>            # regenerate only those pages
```

- [How-to: keep docs fresh](how-tos/keep-docs-fresh.md)
- [Tutorial: set up a CI docs pipeline](tutorials/ci-docs-pipeline.md)

### Check quality with a persona simulation

Have an AI roleplay your target audience and attempt to complete a task using only the docs, then surface what was unclear or missing.

```
saifdocs review --product <id> --persona <id> --task <id>
```

- [How-to: run a quality review](how-tos/review-doc-quality.md)

### Verify all declared pages exist

After a partial run or before publishing, confirm every page declared in `docspec/` is on disk.

```
saifdocs audit
```

- [How-to: verify doc coverage](how-tos/verify-doc-coverage.md)

---

## Concepts

| | |
|---|---|
| [docspec](concepts/docspec.md) | The intent tree that describes your product's audience, tasks, and concepts |
| [Manifest & build plan](concepts/manifest-build-plan.md) | How `saifdocs` decides which pages to generate and in what order |
| [Generation pipeline](concepts/generation-pipeline.md) | The end-to-end flow from `docspec/` to markdown output |
| [Staleness tracking](concepts/staleness-tracking.md) | How `saifdocs` detects which pages need regeneration |

---

## Tutorials

Step-by-step walkthroughs that introduce `saifdocs` and its features.

- [Overview](tutorials/overview.md)
- [Installation](tutorials/installation.md)
- [From docspec to docs](tutorials/docspec-to-docs.md)
- [CI docs pipeline](tutorials/ci-docs-pipeline.md)
