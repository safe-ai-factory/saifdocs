# From docspec to docs

By the end of this stage you will have built a minimal `docspec/` intent tree from scratch, inspected the build plan `saifdocs` produces, run the full generation pipeline, and confirmed the output page exists on disk. Along the way you will see how the three core concepts — the `docspec/` structure, the manifest, and the generation pipeline — fit together in practice.

---

## Before you begin

- `saifdocs` and [`saifctl`](../concepts/generation-pipeline.md) installed and responding on your `PATH` (see [Install saifdocs](./installation.md))
- A project directory to work in (a fresh directory is fine)

---

## What you will build

You will create a minimal `docspec/` tree for a fictional product called `myapp`, generate a single concept page, and verify the result. The full picture:

```
docspec/                        docs/
└── products/                   └── products/
    └── myapp/          ──►         └── myapp/
        ├── product.md                  └── concepts/
        ├── rules.md                        └── overview.md
        ├── personas/
        │   └── developer/
        │       ├── persona.md
        │       └── rules.md
        └── concepts/
            └── overview.md
```

---

## 1. Create the docspec tree

`docspec/` is the blueprint for your documentation — it declares what pages should exist, who they are for, and what each page should teach. Nothing in `docspec/` is published directly; it is input to the generator.

Create the following files (copy each block exactly):

**`docspec/products/myapp/product.md`**

```markdown
# myapp

myapp is a command-line tool that processes JSON files and emits
structured reports. It is used by backend developers to audit
pipeline output in CI.
```

**`docspec/products/myapp/rules.md`**

```markdown
- Use second-person ("you") throughout.
- Keep code examples short and runnable.
```

**`docspec/products/myapp/personas/developer/persona.md`**

```markdown
# Developer

A backend developer integrating myapp into their build pipeline.
Knows the command line; unfamiliar with myapp's internals.
```

**`docspec/products/myapp/personas/developer/rules.md`**

```markdown
- Assume familiarity with shell and JSON.
- Lead every page with the minimal working example.
```

**`docspec/products/myapp/concepts/overview.md`**

```markdown
---
id: overview
explains: what myapp is and the problem it solves
learning_outcomes:
  - Understand what myapp does in one sentence.
  - Know when to reach for myapp versus alternatives.
---

Introduce myapp, its core purpose, and where it fits in a CI pipeline.
```

Your directory should now look like this:

```
docspec/
└── products/
    └── myapp/
        ├── product.md
        ├── rules.md
        ├── personas/
        │   └── developer/
        │       ├── persona.md
        │       └── rules.md
        └── concepts/
            └── overview.md
```

---

## 2. Inspect the build plan

Before any AI runs, `saifdocs` reads `docspec/` and writes a **manifest** — a build plan that lists every output file along with the exact source files that feed into it. Run a dry-run to produce the manifest without emitting a feature tree:

```bash
saifdocs gen --dry-run
```

`--dry-run` (default: `false`) — writes `docspec/.manifest.json`; no feature tree is emitted and no AI is invoked.

Open the manifest to see what was planned:

```bash
cat docspec/.manifest.json
```

You will see one entry for `myapp/concepts/overview`. It lists:

- **`output`** — the path where the page will be written under `docs/`
- **`read`** — the exact set of source files (intent, product, persona, rules) that the AI agent will receive
- **`generatedAt`** — set to `null` until the page is actually generated; used later for staleness detection

```
docspec/  ──►  saifdocs gen --dry-run  ──►  docspec/.manifest.json
(intents)                                    (build plan — no AI yet)
```

The manifest is both a blueprint and a ledger. When you later edit a source file, `saifdocs validate` compares that file's modification time against `generatedAt` to decide whether the downstream page is stale. See [Keep docs fresh](../how-tos/keep-docs-fresh.md) for how that loop works.

If any file is missing from `read`, check that your `docspec/` paths match the structure above.

---

## 3. Emit the feature tree

Once the manifest looks correct, run generation without `--dry-run`:

```bash
saifdocs gen
```

This writes an updated `docspec/.manifest.json` and emits a timestamped **feature tree** under `saifctl/features/`:

```
saifctl/features/saifdocs-<timestamp>/
├── phases/
│   └── 01-con-myapp-overview/
│       └── spec.md      ← instructions for the AI agent that writes this page
└── critics/
    └── audit.md         ← instructions for the built-in review critic
```

Each subdirectory is one **phase** — one page to generate. Phases are numbered so they run in dependency order: references first, then concepts, then how-tos, then tutorials, then landing pages. The number width scales with the total page count so lexicographic ordering stays stable.

`saifdocs gen` does not invoke any AI. It is a planner, not an executor — think of it as writing a Makefile. The actual generation happens in the next step.

---

## 4. Run the agents

Hand the feature tree to `saifctl`, the agent runner:

```bash
saifctl feat run --feature saifdocs-<timestamp>
```

Replace `saifdocs-<timestamp>` with the directory name that appeared under `saifctl/features/` in the previous step. `saifctl` runs one AI agent per phase, in order:

```
docspec/          saifdocs gen         saifctl feat run          docs/
(intent files) ──► (feature tree) ──► (AI agents, one/phase) ──► (markdown)
```

For a single concept page the run is fast. For larger doc sets with dozens of phases, agents run sequentially within a dependency tier and the run may take several minutes.

---

## 5. Verify the output

When the run finishes, confirm the page exists:

```bash
ls docs/products/myapp/concepts/overview.md
```

Open it and read the first few lines. The page should reflect the `explains` and `learning_outcomes` you declared in the intent file, written from the `developer` persona's perspective.

To confirm that every declared page was produced and none were missed:

```bash
saifdocs audit
```

If all pages are present you will see:

```
[audit] No gaps (1 check(s)).
```

If any page is missing, `saifdocs audit` lists the expected path and exits with code `1`. See [Verify doc coverage](../how-tos/verify-doc-coverage.md) for the full options and gap types.

---

## Checkpoint

You have:

- Written a `docspec/` intent tree with a product, persona, and concept
- Used `saifdocs gen --dry-run` to inspect the build plan in `docspec/.manifest.json`
- Run `saifdocs gen` to emit a feature tree
- Run `saifctl feat run` to generate the concept page
- Confirmed coverage with `saifdocs audit`

---

## Next step

You have one generated page. Continue to the next stage to learn how to keep docs in sync as your `docspec/` evolves — detecting stale pages, regenerating only what changed, and adding a freshness gate to CI: [CI docs pipeline](./ci-docs-pipeline.md).
