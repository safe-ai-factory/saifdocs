# What saifdocs does

`saifdocs` turns a structured intent tree into AI-generated documentation. Instead of writing every page by hand, you describe *what* should be documented and *for whom*, then let `saifdocs` and `saifctl` do the writing.

By the end of this stage you will understand the two artifacts `saifdocs` works with, recognize the four commands you'll use every day, and be able to decide whether the tool fits your project before you write a single intent file.

---

## Try it: inspect an existing manifest

If you have a project with `saifdocs` already set up, run a dry-run to see the build plan without generating anything:

`--dry-run` (default: `false`) — writes `docspec/.manifest.json`, no AI calls.

```bash
saifdocs gen --dry-run          # writes docspec/.manifest.json, no AI calls
cat docspec/.manifest.json      # inspect the output file list and read[] arrays
```

Each entry in the manifest shows the output path and the exact source files that feed into it. If you see an entry whose `read` array is missing a rules file or persona file, that tells you the intent tree has a gap — fix it in `docspec/` and re-run `--dry-run`.

Then confirm coverage:

```bash
saifdocs audit                  # lists any declared pages missing from docs/
```

If you see `[audit] No gaps (N check(s)).`, the declared intent matches what is on disk.

---

## The problem it solves

Technical documentation drifts. A flag is renamed, a step is reordered, a new audience appears — and the docs lag behind. Keeping them current is repetitive work that doesn't scale.

`saifdocs` addresses this by separating *intent* (what a page should cover, who it is for, what the reader should learn) from the generated text. You maintain the intent files; `saifdocs` regenerates the prose whenever the intent changes.

---

## Two artifacts

Everything `saifdocs` does flows between two directory trees:

```
docspec/                        docs/
(your intent files)    ──►     (AI-generated markdown)
```

**`docspec/`** is the blueprint. It declares which products to document, who the readers are (personas), what concepts to explain, and which tasks to walk through. Nothing in `docspec/` is published directly — it is input to the generator.

**`docs/`** is the output. Each file under `docs/` corresponds to one intent declared in `docspec/`. The contents are written by an AI agent; you do not edit them directly. When an intent file changes, the corresponding output page becomes stale and can be regenerated.

A minimal `docspec/` tree looks like this:

```
docspec/
└── products/
    └── myapp/
        ├── product.md              ← one-paragraph product description
        ├── rules.md                ← writing rules for all myapp pages
        └── personas/
            └── developer/
                ├── persona.md      ← who the reader is
                └── rules.md        ← persona-level writing rules (override product rules)
```

Concept, how-to, and tutorial intent files live alongside those files in `concepts/`, `how-tos/`, and `tutorials/` subdirectories. Each intent file produces exactly one output page.

---

## The generation pipeline

Running `saifdocs gen` reads `docspec/`, builds a manifest of every page that needs to exist, and emits a feature tree under `saifctl/features/`. You then run `saifctl feat run` — [`saifctl`](../concepts/generation-pipeline.md) is the agent runner that executes each phase — to produce the actual pages:

```
docspec/          saifdocs gen           saifctl feat run          docs/
(intent files) ──► (feature tree) ──► (AI agents, one per page) ──► (markdown pages)
```

Pages are generated in dependency order: references first, then concepts, then how-tos, then tutorials, then landing pages. A tutorial that references a concept waits for that concept page to exist before its agent runs.

---

## Four commands

| Command | What it does | LLM calls? |
|---|---|---|
| `saifdocs gen` | Build the full manifest and emit a feature tree for all declared pages | No (LLM runs via `saifctl`) |
| `saifdocs update` | Like `gen`, but emits a feature tree for **stale pages only** | No |
| `saifdocs validate` | Report which pages are stale; exits `1` if any are found | No |
| `saifdocs audit` | Report which declared pages are missing from `docs/` on disk | No |

Two secondary commands complete the picture:

- `saifdocs review --product <id> --persona <id> --task <id>` — emits a single-phase feature that runs a persona-simulation quality check on your docs. See [Review doc quality](../how-tos/review-doc-quality.md).
- `saifdocs gen --dry-run` — writes `docspec/.manifest.json` (the build plan) without emitting a feature tree. Useful to inspect what would be generated before committing to a run.

The typical day-to-day loop is:

```
edit docspec/  ──►  saifdocs validate  ──►  saifdocs update  ──►  saifctl feat run
                    (find stale pages)       (emit stale-only       (regenerate them)
                                              feature tree)
```

When you add or remove files in `docspec/` (new concept, renamed persona), use `saifdocs gen` instead of `saifdocs update` — `update` reuses the existing manifest and won't pick up structural changes.

---

## Is saifdocs a fit for your project?

`saifdocs` works best when:

- You have multiple audiences (personas) who need different framings of the same product
- Documentation drifts because source changes are frequent
- You want docs that read like a skilled human wrote them, not a template dump
- You want to gate freshness in CI without paying AI costs per commit (`saifdocs validate` makes no LLM calls)

It is less useful for single-page READMEs, fully auto-generated API references where structure is the only goal, or teams that do not want to maintain a `docspec/` intent tree.

---

## Next step

You are ready to install `saifdocs` and generate your first page.

Continue to [Generate your first docs](../how-tos/generate-first-docs.md).
