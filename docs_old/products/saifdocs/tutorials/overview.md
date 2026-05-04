# saifdocs overview: what it does and how you'll use it

This is stage 1 of 4 in the saifdocs tutorial series. By the end of this page you will understand the problem saifdocs solves, the two artifacts it works with, and the four commands you'll use day-to-day — enough to decide whether saifdocs fits your project before you touch the CLI.

---

## The problem: docs that are separate from the work that generates them

When your team ships a new CLI flag, renames a config key, or adds a command, your documentation falls behind. The work happens in code; the docs live somewhere else; keeping them in sync is nobody's full-time job.

saifdocs is an **AI-driven documentation generator**. Instead of writing every page by hand, you write a small structured description of what documentation should exist — who it's for, what tasks it covers, which concepts it should explain. Then you run a command and AI agents write the pages.

The key shift: **you control the specification; saifdocs does the writing.**

---

## The two artifacts

saifdocs works with exactly two directories. Understanding what each one is — and what it is not — is the most important thing to take from this tutorial.

### `docspec/` — the blueprint

The `docspec/` directory is your **intent tree**: a structured description of the documentation that should exist. It is not documentation. It is a plan.

A minimal `docspec/` tree looks like this:

```
docspec/
└── products/
    └── myapp/
        ├── product.md          ← what the product does
        ├── how-tos.yaml        ← how-to page intents
        ├── tutorials.yaml      ← tutorial page intents
        ├── concepts/           ← things to explain
        └── personas/           ← who the readers are
            └── api-user/
                ├── persona.md
                └── tasks/
```

Every file in `docspec/` is an **intent declaration**, not a draft. A concept file declares *what* a generated page must explain; saifdocs writes the actual explanation. A persona file describes who the reader is; saifdocs uses that to calibrate tone and depth on every page it writes for them.

This is the part you version-control carefully and review in pull requests. It is small, human-readable, and stable.

### `docs/` — the output

The `docs/` directory (or wherever you point the generator) is the result. It contains the markdown pages saifdocs wrote.

These files can be discarded and regenerated at any time from `docspec/`, just as compiled artifacts can be rebuilt from source. You do not hand-edit them — you change the intent in `docspec/` and let saifdocs regenerate.

**Recipe card vs. finished dish.** `docspec/` is the recipe; `docs/` is the meal. If the recipe changes, you cook again.

---

## The four commands

saifdocs gives you four commands you'll return to repeatedly. Here they are in the order you'll first encounter them:

| Command | What it does |
|---|---|
| `saifdocs gen` | Reads `docspec/`, builds a manifest of every page to generate, then writes them all via AI agents |
| `saifdocs validate` | Checks which pages are stale (source changed after the page was generated); exits non-zero if any are |
| `saifdocs update` | Regenerates only the stale pages — no full rebuild needed |
| `saifdocs audit` | Reports pages declared in `docspec/` that do not exist on disk yet |

You will use `gen` the first time and whenever the structure of your `docspec/` tree changes. After that, `validate` and `update` handle the day-to-day cycle of keeping docs in sync with source changes. `audit` catches gaps — useful before publishing or after a partial run.

There is a fifth command, `saifdocs review`, that runs a persona-simulation quality pass. You will meet it later in the series; it is not needed to get started.

---

## How `saifdocs gen` works under the hood

When you run `saifdocs gen`, two things happen in sequence:

1. **Manifest phase.** saifdocs reads your `docspec/` tree, resolves which pages to generate and in what order, and writes `.manifest.json`. This file is the build plan: one entry per output page, each listing exactly which source files the agent must read to write it.

2. **Generation phase.** saifdocs sends the manifest to a [saifctl](https://docs.saif.ai/saifctl) sandbox, which runs one AI agent per page. Pages are generated in dependency order — reference pages first, then concepts, then how-tos, then tutorials, then landing pages — so that by the time an agent writes a how-to, the concept pages it links to already exist.

You can inspect the plan before spending any compute:

```bash
saifdocs gen --dry-run
```

`--dry-run` writes `.manifest.json` but does not invoke any agents. Open it and confirm that the output paths and `read` lists look right before running for real.

---

## Does this fit your project?

saifdocs is a good fit if:

- You have a codebase with a CLI, API, or SDK that changes regularly.
- You want structured, audience-aware docs — how-tos for different personas, concept explanations, tutorials — without writing every page by hand.
- You care about docs accuracy (pages must reflect the actual CLI/API) and freshness (pages should update when source changes).

It is less suited for purely narrative content (marketing pages, blog posts) or single-page projects where the overhead of a `docspec/` tree is more than the writing itself.

---

## What you'll do in this tutorial series

This series has four stages:

1. **Overview** ← you are here
2. **Installation** — install saifdocs, verify the CLI, confirm saifctl is available
3. **From docspec to docs** — write a minimal `docspec/` tree, run `saifdocs gen`, verify the output
4. **CI docs pipeline** — add `saifdocs validate` to CI and use `saifdocs update` for incremental regeneration

Each stage builds on the previous one. You do not need to read ahead; just follow in order.

---

## Next step

Continue to [Installation](./installation.md) to install saifdocs and verify your environment is ready.
