# Review doc quality

Use `saifdocs review` to run a persona-simulation quality check on your generated docs. The command emits a single-phase feature that instructs an AI agent to roleplay a specific persona, attempt a given task using only your docs, and produce a report of gaps, confusing passages, or missing steps. This is the primary way to validate doc quality with AI before publishing.

## Prerequisites

- `saifdocs` and [`saifctl`](../concepts/generation-pipeline.md) installed and on your `PATH`
- At least one product in `docspec/` with a persona and a task defined
- Docs already generated (run `saifctl feat run` first if you haven't)

## Quick start

```bash
saifdocs review --product saifdocs --persona docs-author --task review-doc-quality
# Check saifctl/features/ for the emitted feature id, then:
saifctl feat run --feature <feature-id>
```

The review report lands under `docs/review/`.

---

## 1. Identify the product, persona, and task

The three required flags map directly to entries in your `docspec/` tree:

| Flag | Maps to |
|---|---|
| `--product <id>` | `docspec/products/<id>/product.md` |
| `--persona <id>` | `docspec/products/<id>/personas/<id>/persona.md` |
| `--task <id>` | `docspec/products/<id>/personas/<id>/tasks/<id>.md` |

For example, with a product `myapp`, a persona `developer`, and a task `install`:

```
docspec/products/myapp/
├── product.md
└── personas/
    └── developer/
        ├── persona.md
        └── tasks/
            └── install.md
```

## 2. Run the review

```bash
saifdocs review --product myapp --persona developer --task install
```

`saifdocs review` emits a single-phase feature tree under `saifctl/features/`. It does not invoke any AI itself — that happens in the next step. Check `saifctl/features/` for the exact directory name emitted, then pass it to `--feature`.

```
docspec/           saifdocs review        saifctl feat run          docs/review/
(intents, docs) ──► (review feature) ──► (persona-simulation) ──► (quality report)
```

## 3. Execute the review agent

Hand the emitted feature to `saifctl`:

```bash
saifctl feat run --feature <feature-id>
```

The agent reads your docs, adopts the persona defined in `persona.md`, and attempts to complete the task described in `tasks/<id>.md` using only what the docs provide. It then writes a report to:

```
docs/review/
```

## 4. Read the report

Open the report file. It surfaces:

- **Gaps** — information the persona needed but couldn't find
- **Confusing passages** — sections where the persona had to guess or re-read
- **Missing steps** — actions that were implied but not explained

Use these findings to edit the relevant `docspec/` intent files and re-run `saifdocs update` + `saifctl feat run` to regenerate only the affected pages.

## Troubleshooting

**`--product` not found** — confirm `docspec/products/<id>/product.md` exists and the id matches exactly (case-sensitive).

**Empty or thin report** — the persona may not have found enough doc content to review. Run `saifdocs audit` to check for missing output files before reviewing.

**Review feature not found after `saifdocs review`** — check `saifctl/features/` for the newly created directory. Pass its exact name to `--feature`.

## See also

- [The docspec directory](../concepts/docspec.md) — how products, personas, tasks, and concepts are structured
- [The generation pipeline](../concepts/generation-pipeline.md) — how `saifdocs gen` and `saifctl feat run` work together
- [Keep docs fresh](./keep-docs-fresh.md) — regenerate only stale pages after editing intents
