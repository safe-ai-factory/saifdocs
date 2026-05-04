# saifdocs

Saifdocs reads a **docspec** (intent model: products, personas, tasks,
concepts, reference pointers) and emits a saifctl feature tree. Run
`saifctl feat run --feature <id>` to generate the actual docs.

## What is saifdocs, in plain words

Most "AI writes my docs" tools work like this: you give them a prompt,
they spit out prose, you copy-paste it into a markdown file, and a week
later your code has changed and the docs are wrong again. Quality is
random. Updates are manual.

Saifdocs splits the problem into two parts:

1. **You write the *intent* once.** A small folder of markdown files
   that says "we're documenting product X for engineers, here are the
   concepts they need to learn, here are the tasks they want to do, and
   here's where the source code lives." This is your `docspec/`. You
   author it like you'd author any other config — and it changes much
   less often than the actual prose.
2. **Saifdocs + saifctl generate the prose from that intent.** As many
   times as you want. Every time the source code changes, every time
   you add a feature, every time you onboard a new persona. The intent
   file is the source of truth; the generated markdown pages are the
   output.

Why bother splitting it this way?

- **Reference pages stay in sync with code.** A reference file says
  "the source is `src/cli/commands/run.ts`" — saifdocs makes the agent
  read that file fresh on every regen. No manual copy-paste of flag
  lists that drift from reality.
- **The whole doc set stays consistent.** Tone, voice, persona
  targeting, prerequisite-concept ordering — those decisions live in
  the docspec, not in 50 individual pages. Change them once, regen
  everything.
- **Editorial review focuses on truth, not structure.** When a reviewer
  reads a generated page, they're checking "is this true?" — the
  organisation, audience, and topic boundaries were already decided
  upstream.

You don't have to understand AI agents or sandboxes to use saifdocs.
You write structured markdown intent files; the tool handles the rest.

## How it works

You describe **what to document** in a structured `docspec/` tree, run
`saifdocs gen`, and it builds a feature tree that saifctl knows how to
execute. Saifctl then drives an AI agent to write each page, with a
review critic checking the result.

```
  docspec/                       (you write this — the intent tree)
     │
     │  saifdocs gen
     ▼
  saifctl/features/saifdocs-<timestamp>/    (saifdocs emits this)
     │
     │  saifctl feat run --feature <id>     (saifctl drives the agent)
     ▼
  docs/                          (the actual generated markdown pages)
```

Saifdocs itself never invokes an LLM; it's a *compile* step. Saifctl
handles agent invocation, sandboxing, and per-page review.

## Requirements

- Node.js 22+
- pnpm 9+
- [saifctl](https://github.com/safe-ai-factory/saifctl) installed in
  the project where you'll generate docs (you'll run
  `saifctl feat run` after each `saifdocs gen`)

## Quick start

### 1. Install

In the project where you want to generate docs:

```bash
pnpm add -D @safe-ai-factory/saifdocs
# or, globally
pnpm add -g @safe-ai-factory/saifdocs
```

After install, the `saifdocs` CLI is available (or via `npx saifdocs`).

### 2. Author your docspec

Saifdocs reads its instructions from a `docspec/` directory at your
project root. The layout follows the [Diátaxis](https://diataxis.fr/)
four-quadrant model: **references** (the ground truth — CLI flags,
config keys, API surfaces), **concepts** (explanations: "what is X
and why does it matter?"), **how-tos** (task recipes: "how do I do
Y?"), and **tutorials** (end-to-end walkthroughs for newcomers).

A minimal layout looks like this:

```
docspec/
  products/
    my-product/
      product.md             ← what the product is, who it's for
      rules.md               ← (optional) tone, voice, banned phrases
      personas/
        engineer/
          persona.md         ← who this reader is, what they care about
          tasks/
            install.md       ← one specific thing they want to do
      concepts/
        auth.md              ← intent for one concept page
      how-tos/
        get-started.md       ← intent for one how-to page
      tutorials/
        installation.md      ← intent for one tutorial step
        index.yaml           ← order of the tutorial track
  reference/
    commands/
      my-product/
        run.md               ← frontmatter `source:` points at the code
```

#### What each file is for, in plain words

Every file is an **intent file** — it tells saifdocs *what page to
generate*, *who it's for*, and *what the agent should read when
writing it*. Each file has structured **frontmatter** (the `---` block
at the top: declarative fields saifdocs uses to plan the docs) and a
freeform **body** (prose notes the agent reads when writing the
page).

- **`product.md`** — describes the product itself. "What is it? Who
  uses it? What's the elevator pitch?" The agent reads this on
  *every* generated page to keep tone consistent across the doc set.
- **`rules.md`** *(optional, per-product)* — tone, voice, formatting,
  banned phrases. Lives next to `product.md`. The agent must follow
  these rules on every generated page. Per-persona `rules.md` is also
  supported (under `personas/<persona>/`).
- **`personas/<persona>/persona.md`** — describes one *kind of reader*.
  "The engineer is a senior backend dev with 10 years of TypeScript
  experience…" The agent uses this to calibrate vocabulary, examples,
  and assumed prior knowledge. Every persona is its own audience.
- **`personas/<persona>/tasks/<task>.md`** — one specific thing this
  persona wants to do. ("Install the CLI", "Configure custom auth
  rules"). Frontmatter declares prereq concepts, search terms (so the
  generated docs are findable), and an *arrival context* — how did
  the reader get here? (Search? README link? Error message?). How-to
  and tutorial pages are then generated *for* these tasks.
- **`concepts/<concept>.md`** — intent for an explanation page. "What
  is sandboxing and why does it matter?" Frontmatter lists prereq
  concepts, learning outcomes, and analogies. The body is freeform
  notes the agent expands into prose. Concepts are reusable: how-tos
  and tutorials cite them.
- **`how-tos/<how-to>.md`** — intent for a task recipe. "How do I
  publish to npm?" Frontmatter says which task this addresses and
  which concepts it depends on. The agent generates a focused
  step-by-step guide.
- **`tutorials/<tutorial>.md`** — one step in an end-to-end
  walkthrough. Tutorials are *ordered* (via `index.yaml`) and each
  builds on the previous one. Different from how-tos: tutorials teach
  through an example, how-tos solve a known problem.
- **`reference/commands/<product>/<cmd>.md`** — *the only file with
  almost no body content.* Frontmatter has a `source:` field pointing
  at actual code (e.g. `src/cli/commands/run.ts`). The agent reads
  that source file on every regen and produces the reference page
  directly from it. **This is how reference pages stay accurate as
  code changes.**

The pattern across every file: **structured frontmatter + freeform
body**. Frontmatter is what saifdocs needs to *plan* the docs (which
pages to generate, in what order, depending on what); the body is
context the agent reads when *writing* each page.

> Tip: there's no `saifdocs init` scaffolder yet. Fastest bootstrap is
> to copy saifdocs's own `docspec/` from
> [github.com/safe-ai-factory/saifdocs](https://github.com/safe-ai-factory/saifdocs)
> and rename `my-product` throughout.

### 3. Compile to a saifctl feature tree

From your project root:

```bash
saifdocs gen --project-dir .
```

Saifdocs reads `docspec/`, builds a manifest of every page that needs
to be written, and emits a timestamped feature dir under
`<project>/saifctl/features/saifdocs-<timestamp>/`:

```
saifctl/features/saifdocs-2026-05-04T10-30-45-123Z/
  feature.yml          # declares the audit critic
  plan.md              # run summary (when, what, how)
  critics/
    audit.md           # review prompt: omissions, false claims, …
  phases/
    01-ref-cli-flags/  # one phase per file-to-generate
      spec.md          # the writing prompt for this page
      tests/
        gate.sh        # checks the page exists and is non-empty
    02-ref-config/
    …
```

Phase numbering width is computed from the run's total file count
(50 pages → `01..50`; 1023 pages → `0001..1023`) so lex ordering matches
emission order. The dependency chain is preserved: references →
concepts → how-tos → tutorials → landing-pages.

### 4. Run it via saifctl

```bash
saifctl feat run --feature saifdocs-<timestamp>
```

Saifctl drives the agent through every phase, with the audit critic
reviewing each page after writing in fresh LLM context.

### 5. Read the docs

When the run finishes, your generated pages land at the paths declared
in the docspec — typically under `docs/`:

```
docs/
  products/my-product/
    concepts/auth.md
    how-tos/get-started.md
    …
  reference/commands/my-product/
    run.md
```

## Daily workflows

| Command | What it does |
| --- | --- |
| `saifdocs gen` | Full compile from scratch — fresh feature dir, every page. |
| `saifdocs update` | Emit a feature dir containing only stale phases (per `validate`'s rules: any `read` path newer than `generatedAt`). |
| `saifdocs validate` | Check staleness in CI — no LLM, fast. Exits non-zero if any page is out of date. |
| `saifdocs audit` | Gap report: expected outputs (per docspec) vs files on disk. Run after `saifctl feat run` to confirm coverage. |
| `saifdocs review` | Emit a single-phase feature for a persona-simulation review. |
| `saifdocs clear` | Delete the output directory (default `docs/`). |

The typical loop:

```
1. edit docspec/                        ← author intent
2. saifdocs gen --project-dir .         ← emit feature
3. saifctl feat run --feature <id>      ← generate pages
4. saifdocs audit                       ← confirm coverage
5. saifdocs validate                    ← in CI on every PR
6. saifdocs update --project-dir .      ← regen only stale pages
```

## Configuration

### Filter what gets compiled

```bash
saifdocs gen --project-dir . --types references,concepts
```

Only phases for the named types end up in the emitted feature.

### Override the feature id (in-place regeneration)

By default each `saifdocs gen` emits a fresh timestamped feature dir,
so multiple runs accumulate side-by-side (good for monthly recurring
documentation refresh, before/after refactor snapshots, audit trails).
For in-place regen:

```bash
saifdocs gen --project-dir . --feature-id saifdocs-monthly
```

### Override the saifctl features dir

```bash
saifdocs gen --project-dir . --saifctl-features-dir custom/path
```

### Manifest-only (skip feature emission)

```bash
saifdocs gen --project-dir . --dry-run
```

Writes `docspec/.manifest.json` for staleness tracking; doesn't emit a
feature tree.

### Export the manifest

```bash
# to stdout
saifdocs gen --project-dir . --export-manifest

# to a file
saifdocs gen --project-dir . --export-manifest-out ./manifest.json

# stdout via the same flag
saifdocs gen --project-dir . --export-manifest-out stdout
```

### Force-regen one specific page

```bash
saifdocs update --project-dir . --entry concept--my-product--auth
# or by output-path suffix
saifdocs update --project-dir . --entry docs/concepts/auth.md
```

### Persona-simulation review

Emits a single-phase feature whose deliverable is a markdown review
report under `docs/review/<product>/<persona>/`:

```bash
saifdocs review \
  --product my-product \
  --persona engineer \
  --task install \
  --project-dir .
```

Then `saifctl feat run --feature <id>` to execute the review.

## Development

Working on saifdocs itself (not just using it)?

```bash
git clone https://github.com/safe-ai-factory/saifdocs.git
cd saifdocs
pnpm install
pnpm run check    # lint + typecheck + knip + build + test
```

Saifctl is a `devDependency` for the integration tests; saifdocs has
no runtime dependency on it.

## License

MIT
