# CI docs pipeline: validate freshness and update on change

This is stage 4 of 4 in the saifdocs tutorial series. By the end of this page you will have:

- A CI step that catches stale documentation on every pull request.
- A local workflow for regenerating only the pages that are out of date.
- An understanding of when to run `saifdocs gen` vs `saifdocs update` vs `saifdocs validate`.

You will also understand two concepts that make this possible: **staleness tracking** (how saifdocs knows a page is out of date) and the **manifest as a build plan** (why `update` and `validate` can work without re-parsing your entire `docspec/` tree).

---

## Prerequisites

- You have completed stages 1–3 of this series. In particular, you have a `docspec/` tree and a `.manifest.json` produced by `saifdocs gen`.
- `SAIFCTL_API_KEY` is set in your environment.
- You have a CI system (GitHub Actions examples are used below; the commands are identical on any platform).

---

## What you are building

You will wire up two things:

1. **A CI check** — `saifdocs validate` runs on every pull request and exits non-zero if any generated page is out of date with respect to its docspec source files.
2. **A local update loop** — `saifdocs update` regenerates only stale pages, so you are never rerunning the full pipeline when only a persona description or concept intent changed.

The CI check does not generate anything; it is read-only and fast. The update command does the actual regeneration, but only for the pages that need it.

---

## How staleness tracking works

Before adding commands to your CI, it helps to understand what "stale" means to saifdocs.

Every entry in `.manifest.json` records:

- **`read`** — the exact list of source files the AI agent read when generating that page (docspec intent files, persona files, rules, and so on).
- **`generatedAt`** — the timestamp when the page was last generated.

A page is **stale** when any file in its `read` list has been modified more recently than `generatedAt`. If no `read` input has changed, the page is fresh and saifdocs leaves it alone.

This is the same logic `make` uses: rebuild a target only when one of its inputs is newer. For saifdocs, the "inputs" are your `docspec/` files, and the "targets" are generated markdown pages.

Open your `.manifest.json` and find any entry — you will see `generatedAt` set to the timestamp from your last `saifdocs gen` run:

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
  "generatedAt": "2024-04-01T10:23:45.000Z"
}
```

Now simulate a source change — touch one of the read files:

```bash
touch docspec/products/myapp/personas/developer/persona.md
```

The file's modification time is now newer than `generatedAt`. Any manifest entry that lists that file in its `read` list is now stale.

---

## Step 1: Check for staleness locally

Run `saifdocs validate` to see which pages are stale without regenerating anything:

```bash
saifdocs validate
```

You will see output listing each stale entry — the output path and which `read` input triggered the staleness. The command exits with code `1` if any stale entries exist, `0` if everything is fresh.

`validate` is read-only: it stats files and checks timestamps, but never invokes the AI. This makes it safe and fast to run on every commit.

---

## Step 2: Regenerate only stale pages

To bring the stale pages back up to date, run:

```bash
saifdocs update
```

`saifdocs update` performs the same staleness check as `validate`, then reruns the AI agent for every stale entry. Pages that are already fresh are untouched — the sandbox only receives the entries that actually need work.

After `update` completes, run `validate` again to confirm everything is fresh:

```bash
saifdocs validate
echo "Exit code: $?"
```

You should see exit code `0` and no stale entries reported.

### When to use `update` vs `gen`

`saifdocs update` works from the existing `.manifest.json`. It will not add new pages, remove deleted pages, or change what the manifest tracks. That is exclusively the job of `saifdocs gen`.

| Situation | Command |
|---|---|
| Content of an existing docspec file changed (persona, concept intent, rules) | `saifdocs update` |
| Added a new product, persona, concept, how-to, or tutorial | `saifdocs gen` |
| Removed or renamed a page in `docspec/` | `saifdocs gen` |
| Changed the shape of the `docspec/` tree | `saifdocs gen` |

Think of `gen` as the step that decides *what* to build, and `update` as the step that keeps already-known pages current.

---

## Step 3: Add `saifdocs validate` to CI

Add the following step to your CI pipeline. This example uses GitHub Actions; the command is identical in any other CI system.

```yaml
# .github/workflows/docs.yml
name: Docs

on:
  pull_request:

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install saifdocs
        run: npm install -g saifdocs

      - name: Check docs freshness
        run: saifdocs validate --json
        env:
          SAIFCTL_API_KEY: ${{ secrets.SAIFCTL_API_KEY }}
```

The `--json` flag produces machine-readable output. Most CI platforms parse structured output better than plain text, and the exit code (`1` = stale entries found) is what actually fails the check.

What this gives you: if a developer edits `docspec/products/myapp/concepts/file-processing.md` (for example, to add a new learning outcome) but does not run `saifdocs update` before opening a pull request, the CI check will fail. The generated page has drifted from its declared intent, and the team knows it before the PR merges.

---

## Step 4: Handle the case where no manifest exists yet

Early in a project, a pull request might not have a `.manifest.json` at all — for example, when the `docspec/` tree is brand-new and `saifdocs gen` has not been run yet in that branch.

Use `--allow-missing-manifest` to skip gracefully in that case instead of failing:

```yaml
- name: Check docs freshness
  run: saifdocs validate --json --allow-missing-manifest
```

This exits `0` when no manifest is found, rather than exiting `1`. Useful during onboarding when not every branch has gone through a full `saifdocs gen` yet.

---

## Step 5: Verify coverage with `saifdocs audit`

Staleness and coverage are different problems. `validate` tells you whether generated pages are current with their source files. `saifdocs audit` tells you whether all pages declared in `docspec/` actually exist on disk:

```bash
saifdocs audit
```

`audit` compares every page entry in your `docspec/` against files on disk and reports any that are missing — for example, pages that were declared but whose generation failed, or entries added to `docspec/` after a partial run.

It exits `1` if any gaps exist and writes a report to `docs/audit.md` by default. You can add it to CI alongside `validate`:

```yaml
- name: Check doc coverage
  run: saifdocs audit

- name: Check docs freshness
  run: saifdocs validate --json --allow-missing-manifest
```

`audit` and `validate` complement each other: audit catches structural gaps (missing files), validate catches content drift (stale files).

---

## Step 6: Run a quality review (optional)

Once your docs are fresh and complete, `saifdocs review` runs a persona-simulation pass — an AI agent roleplays the target persona and attempts a task using only the generated docs, then produces a report of what was unclear or missing:

```bash
saifdocs review \
  --product myapp \
  --persona developer \
  --task run-myapp
```

A report lands in `docs/review/`. This is not typically a CI gate — it invokes the AI and costs time — but it is a useful step before a major release or after significant changes to your persona definitions.

All three flags (`--product`, `--persona`, `--task`) are required. The `--task` value must match a task id declared in your `docspec/` for that persona.

---

## What you just learned

**Staleness tracking is mtime-based.** saifdocs compares the `generatedAt` timestamp in `.manifest.json` against the modification times of each page's `read` inputs. A page is stale when any input is newer — exactly like `make` dependency tracking.

**`validate` is the right CI tool.** It is read-only, fast, and exits non-zero on staleness. It catches documentation drift without running the AI. Add it to every pull request.

**`update` regenerates only what's stale.** When you edit a persona description or refine a concept's `learning_outcomes`, `saifdocs update` reruns only the affected pages. The manifest does not change; only `gen` rebuilds the manifest.

**`audit` and `validate` solve different problems.** Audit checks structural completeness — are all declared pages on disk? Validate checks freshness — are the pages that exist still current? Run both in CI for full coverage.

---

## You are ready

You have completed the saifdocs tutorial series. You can now:

- Write a `docspec/` intent tree that describes your product's audiences, tasks, and concepts.
- Run `saifdocs gen` to generate the full documentation set.
- Run `saifdocs update` incrementally after editing source files.
- Run `saifdocs validate` in CI to catch documentation drift before it reaches your main branch.
- Run `saifdocs audit` to confirm that every declared page exists on disk.

From here, explore the how-to pages for individual workflows:

- [Keep docs fresh after source changes](../how-tos/keep-docs-fresh.md) — detailed `update` and `validate` patterns.
- [Verify doc coverage](../how-tos/verify-doc-coverage.md) — `saifdocs audit` in depth.
- [Review doc quality](../how-tos/review-doc-quality.md) — persona-simulation reviews with `saifdocs review`.
