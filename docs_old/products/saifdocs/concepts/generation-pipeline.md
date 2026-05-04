# The Generation Pipeline

When you run `saifdocs gen`, more happens than a single call to an AI model. saifdocs orchestrates a multi-phase pipeline that reads your intent tree, builds a plan, and then executes that plan one page at a time — in a specific order, for a specific reason.

This page explains the structure of that pipeline: what the phases are, why they run in that order, and how the pieces connect.

## Why a pipeline at all?

Documentation pages refer to each other. A how-to guide for running `saifdocs gen` will naturally link to the reference page for that command. A concept page explaining the manifest will be cited by tutorials. If those downstream pages are generated before the pages they cite exist, the agent has nothing concrete to link to.

saifdocs solves this the same way a compiler does: it runs multiple ordered passes, where each pass can depend on the outputs of the previous one. Think of it like `parse → typecheck → codegen` — each stage builds on a stable foundation.

The pipeline phases run in this fixed order:

1. **references** — CLI commands, API entries, configuration keys
2. **concepts** — explanatory pages (like this one)
3. **how-tos** — task-oriented guides
4. **tutorials** — end-to-end walkthroughs
5. **landing-pages** — product overview and navigation pages

References come first because they are cited most widely. Landing pages come last because they link to everything else.

## The manifest: the pipeline's build plan

Before any agent writes a single page, `saifdocs gen` reads your entire `docspec/` directory and writes a file called `.manifest.json`.

The manifest is a build plan: one entry per output file, each listing the exact set of source files the agent needs to read in order to generate that page. No guessing; no scanning the whole repo at generation time. Each entry in the manifest is self-contained.

This is similar to a `Makefile` target with its listed dependencies, or a lockfile that records exactly what inputs produced each output. The manifest also records `generatedAt` for each entry, which is what `saifdocs update` and `saifdocs validate` use later to detect staleness — without re-running the full pipeline.

You can inspect or write the manifest without triggering generation by using the `--dry-run` flag:

```
saifdocs gen --dry-run
```

This builds and writes `.manifest.json` but does not invoke any sandbox.

## Subtasks and the sandbox

Once the manifest exists, saifdocs hands the work to [saifctl](../../saifctl/concepts/what-is-saifctl.md), a sandboxed AI agent runner. Each manifest entry becomes one **saifctl sandbox subtask** — a self-contained agent invocation that receives:

- the page type and output path
- the precise read list from the manifest (persona files, product context, concept intent, any related pages already written)
- the writing instructions for that page type

All subtasks for a given run execute within a single sandbox session. Phases run sequentially; within a phase, subtasks may run in parallel depending on the saifctl configuration.

The agent writes one markdown file per subtask — exactly the output path specified in the manifest.

## The gate: verifying outputs

After each subtask completes, a gate script checks that the output file actually exists at the expected path and is non-empty. If the file is missing, the subtask is marked as failed — not silently skipped. This means a broken or hallucinating agent cannot cause the pipeline to proceed as if everything succeeded.

The gate is what makes the CI workflow (`saifdocs validate`) trustworthy: it knows that anything recorded as generated was actually checked.

## Limiting scope with `--types`

You do not have to generate all five page types every time. Use `--types` to run only the phases you need:

```
saifdocs gen --types references,concepts
```

Phases still run in their fixed order within the selected set. If you select `concepts` without `references`, the concept agents will not have reference pages to link to — so select upstream types when downstream pages depend on them.

## How this connects to other workflows

`saifdocs gen` runs the full pipeline from scratch. The other commands are narrower:

- `saifdocs update` — re-runs only the subtasks whose source files have changed since `generatedAt` in the manifest. It reads the existing manifest rather than re-parsing `docspec/`.
- `saifdocs validate` — checks staleness in CI without writing anything; exits non-zero if any page is out of date.
- `saifdocs audit` — checks for manifest entries whose output files are missing entirely.
- `saifdocs review` — runs a persona-simulation pass over already-generated pages to verify quality, without regenerating them.

See the [manifest and build plan concept](./manifest-build-plan.md) for a deeper look at what the manifest contains and how staleness is tracked.
