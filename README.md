# saifdocs

[![npm version](https://img.shields.io/npm/v/%40safe-ai-factory%2Fsaifdocs)](https://www.npmjs.com/package/@safe-ai-factory/saifdocs)
[![npm downloads](https://img.shields.io/npm/dm/%40safe-ai-factory%2Fsaifdocs)](https://www.npmjs.com/package/@safe-ai-factory/saifdocs)
[![license](https://img.shields.io/npm/l/%40safe-ai-factory%2Fsaifdocs)](https://github.com/safe-ai-factory/saifdocs/blob/main/LICENSE)
[![Tests](https://github.com/safe-ai-factory/saifdocs/actions/workflows/tests.yml/badge.svg)](https://github.com/safe-ai-factory/saifdocs/actions/workflows/tests.yml)

Project documentation generator. You sketch **what** to document in a
small `docspec/` tree — products, audiences, tasks, concepts, source
files — and saifdocs (via [saifctl](https://github.com/safe-ai-factory/saifctl))
writes the actual markdown for you. Re-run anytime your code or intent
changes; reference pages always stay synced to source, and tone stays
consistent across the whole doc set.

```
  docspec/                              (you write this)
    │  saifdocs gen
    ▼
  saifctl/features/saifdocs-<ts>/       (compiled task list)
    │  saifctl feat run --feature <id>
    ▼
  docs/                                 (your generated docs)
```

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

A `docspec/` folder at your project root. Layout follows the
[Diátaxis](https://diataxis.fr/) quadrants — **references**,
**concepts**, **how-tos**, **tutorials**:

```
docspec/
  products/<product>/
    product.md                        what the product is, who it's for
    rules.md                          (optional) tone, voice, banned phrases
    personas/<persona>/
      persona.md                      who this reader is, what they know
      tasks/<task>.md                 something they want to do
    concepts/<id>.md                  one explainer page
    how-tos/<id>.md                   one task recipe
    tutorials/<id>.md                 one step of a guided walkthrough
    tutorials/index.yaml              order of the tutorial track
  reference/commands/<product>/<cmd>.md   `source:` points at real code
```

Every file has YAML frontmatter (declarative — saifdocs uses it to
plan the docs) and a freeform body (notes the agent reads when
writing). **Reference pages are special:** their body is empty; the
agent reads the `source:` file directly each regen, so reference
pages always match real code.

> Fastest way to start: copy [saifdocs's own `docspec/`](https://github.com/safe-ai-factory/saifdocs)
> as a template and rename `my-product`.

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

| Command             | What it does                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `saifdocs gen`      | Full compile from scratch — fresh feature dir, every page.                                                          |
| `saifdocs update`   | Emit a feature dir containing only stale phases (per `validate`'s rules: any `read` path newer than `generatedAt`). |
| `saifdocs validate` | Check staleness in CI — no LLM, fast. Exits non-zero if any page is out of date.                                    |
| `saifdocs audit`    | Gap report: expected outputs (per docspec) vs files on disk. Run after `saifctl feat run` to confirm coverage.      |
| `saifdocs review`   | Emit a single-phase feature for a persona-simulation review.                                                        |
| `saifdocs clear`    | Delete the output directory (default `docs/`).                                                                      |

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
