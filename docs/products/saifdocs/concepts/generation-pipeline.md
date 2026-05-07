# The generation pipeline

`saifdocs gen` does not write your documentation directly. Instead, it reads your `docspec/` tree and emits a plan — a `saifctl` feature tree — that describes every page to generate and the order to generate them. A second step, `saifctl feat run`, executes that plan with AI agents to produce the actual markdown files.

This separation is similar to a build tool that writes a Makefile: the tool's job is to figure out *what* needs to happen and in *what order*; running the build is a distinct, explicit step.

## Overview

```
docspec/
  (intent files)
      │
      ▼
saifdocs gen
      │
      ▼
saifctl/features/saifdocs-<timestamp>/
  (one phase per page + audit critic)
      │
      ▼
saifctl feat run --feature <id>
      │
      ▼
docs/
  (generated markdown pages)
```

## What `saifdocs gen` produces

Running `saifdocs gen` creates a single timestamped directory under `saifctl/features/`:

```
saifctl/features/saifdocs-2026-05-07T09-40-56-214Z/
├── plan.md
└── phases/
    ├── 01-ref-cli-commands/
    │   └── spec.md
    ├── 02-con-overview/
    │   └── spec.md
    ├── 03-how-deploy/
    │   └── spec.md
    └── ...
```

Each phase corresponds to exactly one output file. The `plan.md` at the root summarises the run: how many phases, how many pages of each type, and the command to execute it.

Multiple runs of `saifdocs gen` accumulate side-by-side — each gets its own timestamp, so earlier runs are never overwritten. This makes it straightforward to compare runs, roll back to a previous plan, or keep before/after snapshots across a documentation refresh.

## Phase ordering

Pages are generated in dependency order so that later pages can reference earlier ones without linking to files that do not exist yet:

```
references  →  concepts  →  how-tos  →  tutorials  →  landing-pages
```

This order is encoded directly in the phase directory names as a lexicographic number prefix. Because lexicographic sort must stay stable regardless of how large the run is, the prefix width scales with the total phase count:

| Pages in run | Phase number format | Example        |
|:---:|:---:|---|
| 1 – 9        | `1` digit           | `phases/1-con-…` |
| 10 – 99      | `2` digits          | `phases/01-con-…` |
| 100 – 999    | `3` digits          | `phases/001-con-…` |
| 1 000 – 9 999 | `4` digits         | `phases/0001-con-…` |

A 50-page run uses `01`–`50`; a 1 023-page run uses `0001`–`1023`. This means `saifctl` can sort phases correctly with a plain directory listing at any scale.

## Running the feature tree

Once `saifdocs gen` has emitted the feature tree, `saifctl feat run` executes the plan. `saifctl` processes each phase in numbered order, invoking a dedicated AI agent per phase. Each agent reads its `spec.md` — which lists the intent file, product description, persona files, and rules — and writes the output markdown page to the path declared in that spec.

The separation of planning (`saifdocs gen`) from execution (`saifctl feat run`) means the generated plan can be inspected, version-controlled, or edited before any AI work begins. A partial run can also be resumed: phases that already produced output are skipped, and only unfinished phases are re-executed.

## The audit critic

After the phases that generate content, the feature tree includes a built-in `audit` critic phase. The critic receives each generated page in a fresh LLM context — separate from the agent that wrote it — and reviews it for:

- **Omissions** — learning outcomes declared in the intent file but missing from the page
- **False claims** — statements contradicted by the source files
- **Diátaxis adherence** — for example, a concept page that drifted into step-by-step instructions

Running the audit is part of the same `saifctl feat run` command; no separate invocation is needed.

## Beyond the primary pipeline

The same `saifdocs` → `saifctl feat run` pattern extends to secondary workflows:

- `saifdocs update` emits a feature tree containing only stale pages, so regeneration touches the minimum set of files.
- `saifdocs validate` detects staleness in CI without invoking any LLM — useful as a gate that flags when the docs are out of date.
- `saifdocs audit` checks for missing output files across the whole docs tree.
- `saifdocs review` emits a single-phase feature that runs a persona-simulation review against existing pages.

Each command produces its own `saifctl` feature tree and is executed with `saifctl feat run` in the same way as the primary `saifdocs gen` workflow.

## Next steps

- To run `saifdocs gen` for the first time, see Generate your first docs (how-to).
- To regenerate only stale pages, see Keep docs fresh (how-to).
- To understand the intent files that feed this pipeline, see [The docspec directory](./docspec.md).
