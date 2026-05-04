# From docspec to docs: write your first intent tree and generate pages

This is stage 3 of 4 in the saifdocs tutorial series. By the end of this page you will have:

- A working `docspec/` intent tree for a small sample product.
- A `.manifest.json` you have inspected and understood.
- Real generated markdown pages on disk, produced by `saifdocs gen`.

You will also understand the three key ideas that underpin every saifdocs run: the docspec tree, the manifest, and the generation pipeline.

---

## Prerequisites

- You have completed stages 1 and 2 of this series. In particular, `saifdocs` is installed and `SAIFCTL_API_KEY` is set.
- You have a terminal open in the root of a project directory where you want to generate docs (it can be a scratch directory created just for this tutorial).

---

## What you are building

A `docspec/` tree for a fictional product called **myapp** — a CLI tool that has one command and two audiences. Small enough to understand at a glance; complete enough to illustrate everything saifdocs needs.

When you are done, `saifdocs gen` will have written three pages:

- A concept page explaining how myapp processes files.
- A how-to page for the `run` command, written for a developer.
- A tutorial page that walks a new user through a first run.

---

## Step 1: Create the directory skeleton

From your project root, create the `docspec/` tree:

```bash
mkdir -p docspec/products/myapp/concepts
mkdir -p docspec/products/myapp/personas/developer
```

You now have the two required subdirectories — `concepts/` and `personas/` — under your product. The tree will look like this when you are done with the next steps:

```
docspec/
└── products/
    └── myapp/
        ├── product.md
        ├── how-tos.yaml
        ├── tutorials.yaml
        ├── concepts/
        │   └── file-processing.md
        └── personas/
            └── developer/
                ├── persona.md
                └── rules.md
```

---

## Step 2: Write `product.md`

`product.md` is the narrative that grounds every page saifdocs generates. It describes what the product does and what its primary outcome is.

Create `docspec/products/myapp/product.md`:

```markdown
# myapp

myapp is a CLI tool that processes files in batch.

Primary outcome: `myapp run <input-dir> <output-dir>` reads every file in
`<input-dir>`, applies a configurable transform pipeline, and writes results
to `<output-dir>`.

Secondary workflows: `myapp validate` checks that input files conform to the
expected schema; `myapp status` reports progress for long-running batches.
```

Keep this concise. saifdocs reads it for every page it generates — it sets the framing for all of them.

---

## Step 3: Write the persona

A persona tells saifdocs who the reader is. It is not a marketing persona — it is a short description of what the reader already knows and what they care about.

Create `docspec/products/myapp/personas/developer/persona.md`:

```markdown
# Developer

A backend developer integrating myapp into their data pipeline. Comfortable
with the command line and JSON config. Cares about correctness and
predictability — they need to know exactly what the tool does to files before
running it on production data.

Arrives via the README or via search after hitting an error.
```

Optionally, add writing rules for this persona. Create `docspec/products/myapp/personas/developer/rules.md`:

```markdown
# Developer writing rules

- Show exact CLI flags and their defaults.
- Lead with the minimal working example before explaining options.
- Use concrete file paths in examples.
```

These rules make the generated output tighter. saifdocs applies them to every page written for this persona.

---

## Step 4: Write a concept intent

A concept file is an **intent declaration** — it states what the generated page must explain, not the explanation itself. saifdocs writes the explanation.

Create `docspec/products/myapp/concepts/file-processing.md`:

```markdown
---
id: file-processing
explains: how myapp reads, transforms, and writes files in a batch run
learning_outcomes:
  - myapp processes files one at a time within a single `run` invocation.
  - The transform pipeline is defined in `myapp.config.json` at the project root.
  - Files that fail validation are written to a `_errors/` subdirectory, not dropped silently.
analogies:
  - a Unix pipe where each stage receives the output of the previous one
---
```

The `learning_outcomes` list is the most important field. It tells the agent exactly what the reader must be able to say after reading the generated page. Everything else is supporting context.

---

## Step 5: Write how-to and tutorial YAML manifests

How-to and tutorial page intents live in YAML files, not individual markdown files. Each entry is one page.

Create `docspec/products/myapp/how-tos.yaml`:

```yaml
how-tos:
  - id: run-myapp
    persona: developer
    title: "Run myapp on a directory of files"
    concepts:
      - file-processing
    intent: >
      Show a developer how to run `myapp run <input-dir> <output-dir>`,
      verify the output, and handle validation errors found in `_errors/`.
```

Create `docspec/products/myapp/tutorials.yaml`:

```yaml
tutorials:
  - id: first-run
    persona: developer
    title: "Your first myapp run"
    concepts:
      - file-processing
    intent: >
      Walk a developer through installing myapp, creating a minimal
      myapp.config.json, running myapp on a sample directory, and confirming
      the output.
```

Each entry gives saifdocs just enough context to write the full page — the persona, which concepts to build on, and the intent of the page.

---

## Step 6: Inspect the manifest before generating

Before spending any compute, build the manifest and inspect it:

```bash
saifdocs gen --dry-run --docspec docspec/
```

This writes `.manifest.json` but does not call any agents. Open it:

```bash
cat .manifest.json
```

You will see one entry per output page. Each entry looks like this:

```json
{
  "outputPath": "docs/products/myapp/concepts/file-processing.md",
  "type": "concepts",
  "read": [
    "docspec/products/myapp/product.md",
    "docspec/products/myapp/personas/developer/persona.md",
    "docspec/products/myapp/personas/developer/rules.md",
    "docspec/products/myapp/concepts/file-processing.md"
  ],
  "generatedAt": null
}
```

Two things to confirm before continuing:

1. **`outputPath`** — does every page appear, and are the paths going where you expect?
2. **`read`** — does each entry list the right source files? The concept page for `file-processing` should reference both the persona files and the concept intent. The how-to page should also reference the concept intent, because it is allowed to link to it.

If anything looks wrong, fix the `docspec/` file that controls it and re-run `--dry-run`. The manifest is cheap to rebuild.

> **Why the manifest matters.** The manifest is the build plan — analogous to a Makefile or a lockfile. `saifdocs gen` writes it once, then every other command (`update`, `validate`, `audit`) reads it rather than re-parsing `docspec/`. The `generatedAt` field (currently `null`) will be filled in after generation and is what enables staleness detection later.

---

## Step 7: Generate the pages

Run the real generation:

```bash
saifdocs gen --docspec docspec/
```

saifdocs runs the **generation pipeline** in five ordered phases — references, concepts, how-tos, tutorials, landing pages. Your tree has no reference or landing-page intents, so the pipeline will run three phases:

1. **concepts** — `file-processing.md` is written first.
2. **how-tos** — `run-myapp.md` is written next; the agent can now link to the concept page that already exists.
3. **tutorials** — `first-run.md` is written last; the agent can cite both the concept and the how-to.

This ordering is not arbitrary. Because each agent receives only the files listed in its `read` list — nothing more — later pages can only reference earlier ones if those earlier ones already exist on disk. The pipeline order is what makes those links real.

Watch the output. You should see one completion message per page. Each page passes a gate check — saifdocs confirms the output file was actually written before marking the subtask successful.

---

## Step 8: Verify the output

After `saifdocs gen` completes, check that the pages exist:

```bash
ls docs/products/myapp/concepts/
ls docs/products/myapp/how-tos/
ls docs/products/myapp/tutorials/
```

Open one of the generated files and read it. Confirm that:

- It reflects the `learning_outcomes` you declared in the concept intent.
- It is written for the `developer` persona — it leads with a working example, shows exact CLI flags, uses concrete paths.
- The how-to links to the concept page; the tutorial links to both.

If the output does not match your intent, the fix goes in `docspec/` — not in the generated file. Edit the concept's `learning_outcomes`, or add a line to `rules.md`, then re-run:

```bash
saifdocs update --docspec docspec/
```

`saifdocs update` compares `generatedAt` in the manifest against the modification times of each page's `read` list. Pages whose source files have changed since they were last generated are regenerated; others are skipped. You do not have to rebuild everything.

---

## What you just learned

After completing these steps, three concepts should feel concrete rather than abstract:

**The docspec tree is a blueprint, not a draft.** The files in `docspec/` declare *what* to generate — audiences, tasks, learning outcomes. They are small, reviewable, and stable. The AI writes the prose; you write the intent.

**The manifest is the build plan.** `saifdocs gen --dry-run` lets you see the full plan — every page, every `read` list — before any agent runs. This is the right place to catch structural mistakes.

**The generation pipeline runs in dependency order.** Concepts before how-tos; how-tos before tutorials. This is why later pages can link to earlier ones accurately.

---

## Next step

Continue to [CI docs pipeline](./ci-docs-pipeline.md) to add `saifdocs validate` to your CI workflow and use `saifdocs update` to keep pages in sync with source changes automatically.
