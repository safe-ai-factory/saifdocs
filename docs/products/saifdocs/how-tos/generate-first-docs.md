# Generate your first docs

Use `saifdocs gen` — an AI documentation generator — to turn a `docspec/` intent tree into markdown pages under `docs/`. This guide walks you through writing a minimal `docspec/` structure, verifying the build plan, and running generation for the first time.

## Prerequisites

- `saifdocs` installed and on your `PATH`
- `saifctl` (the agent runner that executes the generated feature tree) installed and on your `PATH`
- A project directory with no existing `docspec/` yet (or an empty one)

## Quick start

If you already have a `docspec/` directory, run:

```bash
saifdocs gen --dry-run          # inspect the build plan
saifdocs gen                    # emit the feature tree
saifctl feat run --feature saifdocs-<timestamp>   # generate docs
```

The pages land under `docs/`. New to `docspec/`? Follow the full walkthrough below.

---

## 1. Write a minimal docspec tree

`docspec/` is the blueprint for your documentation — it declares what pages should exist and for whom. Create the following structure:

```
docspec/
└── products/
    └── myapp/
        ├── product.md
        ├── rules.md
        └── personas/
            └── developer/
                ├── persona.md
                └── rules.md
```

**`docspec/products/myapp/product.md`** — describe the product in one paragraph:

```markdown
# myapp

myapp is a command-line tool that …
```

**`docspec/products/myapp/rules.md`** — writing rules that apply to all pages for this product:

```markdown
- Use second-person ("you") throughout.
- Keep code examples short and runnable.
```

**`docspec/products/myapp/personas/developer/persona.md`** — who the reader is:

```markdown
# Developer

A backend developer integrating myapp into their build pipeline. Knows the
command line; unfamiliar with myapp's internals.
```

**`docspec/products/myapp/personas/developer/rules.md`** — persona-level writing rules (override product rules):

```markdown
- Assume familiarity with shell and JSON.
- Lead every page with the minimal working example.
```

Now add a concept intent file so there is something to generate:

```
docspec/
└── products/
    └── myapp/
        └── concepts/
            └── overview.md
```

**`docspec/products/myapp/concepts/overview.md`**:

```markdown
---
id: overview
explains: what myapp is and the problem it solves
learning_outcomes:
  - Understand what myapp does in one sentence.
  - Know when to reach for myapp versus alternatives.
---

Introduce myapp, its core purpose, and where it fits.
```

## 2. Verify the build plan (dry run)

Before committing to generation, inspect the manifest `saifdocs` would produce:

```bash
saifdocs gen --dry-run
```

`--dry-run` (default: `false`) writes `docspec/.manifest.json` — the build plan listing every output file and the exact sources that feed into it — but does not emit a feature tree or invoke any AI. Open the file to confirm the entries look correct:

```bash
cat docspec/.manifest.json
```

You should see an entry for `myapp/concepts/overview` with an `output` path under `docs/` and a `read` array listing your intent file, product, persona, and rules files.

```
docspec/  ──►  saifdocs gen --dry-run  ──►  docspec/.manifest.json
(intents)                                    (build plan, no AI yet)
```

If any file is missing from `read`, check that your `docspec/` paths match the structure above.

## 3. Run generation

Once the manifest looks right, run without `--dry-run`:

```bash
saifdocs gen
```

This writes `docspec/.manifest.json` and emits a timestamped feature tree under `saifctl/features/saifdocs-<timestamp>/`. Then hand it off to `saifctl`:

```bash
saifctl feat run --feature saifdocs-<timestamp>
```

`saifctl` runs one AI agent per phase in dependency order (references → concepts → how-to's → tutorials → landing pages). The full pipeline:

```
docspec/          saifdocs gen        saifctl feat run         docs/
(intent files) ──► (feature tree) ──► (AI agents, one/phase) ──► (markdown)
```

## 4. Check the output

When the run finishes, the generated page lands at:

```
docs/products/myapp/concepts/overview.md
```

Open it and verify the content matches your intent file. If you want to regenerate a stale page after editing `docspec/`, see [Keep docs fresh](./keep-docs-fresh.md) *(forthcoming)*.

## See also

- [The docspec directory](../concepts/docspec.md) — concept overview of `docspec/` structure, personas, concepts, how-tos, and tutorials
- [The manifest build plan](../concepts/manifest-build-plan.md) — what `docspec/.manifest.json` contains and how staleness detection works
- [Keep docs fresh](./keep-docs-fresh.md) *(forthcoming)* — use `saifdocs update` to regenerate only stale pages
