# CI docs pipeline

By the end of this stage you will have edited a `docspec/` source file, detected the downstream staleness with `saifdocs validate`, regenerated only the affected pages with `saifdocs update`, and wired a freshness gate into a CI pipeline — all without invoking any AI on the check step.

---

## Before you begin

- `saifdocs` and [`saifctl`](../concepts/generation-pipeline.md) installed and responding on your `PATH`
- The `myapp` `docspec/` tree from the previous stage, with at least one generated page under `docs/`
- `docspec/.manifest.json` written by a prior `saifdocs gen` run (check that it exists)

---

## What you will do

You will simulate a common workflow: a rules file changes, making some generated pages stale. You will detect the drift without re-running generation, then regenerate only the affected pages. Finally, you will add a CI step that catches this drift automatically on every commit.

```
edit docspec/  ──►  saifdocs validate  ──►  saifdocs update  ──►  saifctl feat run  ──►  docs/ (updated)
(source change)      (detect staleness,       (emit stale-only       (regenerate)
                      no AI, exit 1)           feature tree)
```

---

## 1. Simulate a source change

Edit the product-level rules file to add a new constraint:

**`docspec/products/myapp/rules.md`**

```markdown
- Use second-person ("you") throughout.
- Keep code examples short and runnable.
- Always include the expected output after each command.
```

Save the file. Its modification time is now newer than the `generatedAt` on every page that lists it in `read`.

---

## 2. Detect stale pages

Run the staleness check:

```bash
saifdocs validate
```

`saifdocs validate` (no flags required) reads `docspec/.manifest.json`, walks each entry's `read` array, and compares file modification times against `generatedAt`. It makes no LLM calls.

You will see output like:

```
[stale] docs/products/myapp/concepts/overview.md
  reason: docspec/products/myapp/rules.md modified after generatedAt
1 stale page(s). Exit code: 1.
```

The command exits with code `1` when any pages are stale, and `0` when everything is current. That exit-code contract is what makes it useful as a CI gate — no custom parsing required.

**How staleness works:** Every entry in `docspec/.manifest.json` carries a `generatedAt` timestamp — the moment the AI agent wrote that page. The manifest also records the exact `read` list for each entry: every source file (intent, product, persona, rules) that fed into the output. `saifdocs validate` compares the modification time of each file in `read` against `generatedAt`. If any input file is newer than `generatedAt`, the entry is **stale**. No AI is involved — it is purely a file-system comparison.

```
docspec/.manifest.json
  └─ entry: docs/products/myapp/concepts/overview.md
       ├─ generatedAt: "2026-04-10T12:00:00Z"
       └─ read:
            ├─ docspec/products/myapp/concepts/overview.md   ← mtime 2026-04-10T11:00:00Z  ✓ fresh
            ├─ docspec/products/myapp/product.md             ← mtime 2026-04-10T11:00:00Z  ✓ fresh
            ├─ docspec/products/myapp/rules.md               ← mtime 2026-04-15T09:00:00Z  ✗ STALE
            └─ docspec/products/myapp/personas/developer/…
```

For the full set of options, see [Keep docs fresh](../how-tos/keep-docs-fresh.md).

---

## 3. Regenerate only stale pages

Instead of re-running `saifdocs gen` (which rebuilds the entire manifest and re-queues every page), use `saifdocs update`:

```bash
saifdocs update
```

`saifdocs update` runs the same staleness check as `validate`, then emits a `saifctl` feature tree that contains **only the phases for stale pages**. Check `saifctl/features/` for the directory name, then hand it to `saifctl`:

```bash
saifctl feat run --feature saifdocs-<timestamp>
```

Only the stale pages are regenerated. Unchanged pages are skipped entirely.

```
saifdocs update
  └─ stale entries only  ──►  saifctl/features/saifdocs-<timestamp>/
                                └─ phases/
                                    └─ 01-con-myapp-overview/   ← stale phase
                                        └─ spec.md

saifctl feat run --feature saifdocs-<timestamp>
  └─ regenerates docs/products/myapp/concepts/overview.md
  └─ skips all fresh pages
```

When the run finishes, `generatedAt` in `docspec/.manifest.json` is updated for the regenerated entries. Run `saifdocs validate` to confirm the pipeline is now clean:

```bash
saifdocs validate
```

```
0 stale page(s). Exit code: 0.
```

> **When to use `gen` instead of `update`:** `saifdocs update` reuses the existing manifest — it does not rebuild the dependency graph. If you added a new concept file, renamed a persona, or made any structural change to `docspec/`, run `saifdocs gen` first to re-plan, then `saifctl feat run`. See [Keep docs fresh](../how-tos/keep-docs-fresh.md) for the full decision table.

---

## 4. Add `validate` to CI

Because `saifdocs validate` makes no LLM calls and exits with `1` on stale pages, it drops cleanly into any CI pipeline. Add it as a step in your workflow:

```yaml
# GitHub Actions example
- name: Check docs freshness
  run: saifdocs validate
```

This catches documentation that has drifted from its source — for example, a rules file was updated but the affected pages were never regenerated — without incurring any AI cost on every commit.

The full CI pattern that keeps docs always current:

```
commit pushed
    │
    ▼
saifdocs validate   (CI — no AI, fast)
    │  exit 1 → CI fails; developer runs saifdocs update locally, commits regenerated pages
    │  exit 0 → CI passes
    ▼
saifdocs audit      (optional: also check structural coverage)
    │  exit 1 → missing pages; run saifdocs gen + saifctl feat run locally
    │  exit 0 → all declared pages present
    ▼
pipeline continues
```

For details on adding `saifdocs audit` alongside `validate`, see [Verify doc coverage](../how-tos/verify-doc-coverage.md).

---

## Checkpoint

You have:

- Edited a `docspec/` source file and observed how it marks downstream pages stale
- Run `saifdocs validate` to detect staleness without invoking any AI
- Run `saifdocs update` to emit a feature tree containing only the stale phases
- Run `saifctl feat run` to regenerate only the affected pages
- Added `saifdocs validate` to a CI pipeline as a zero-cost freshness gate

---

## Next step

You have completed the tutorial series. Your `docspec/` tree is set up, your docs are generated, and you have a CI gate that catches drift automatically.

From here you can:

- **Check quality** — run a persona-simulation review to find gaps and confusing passages: [Review doc quality](../how-tos/review-doc-quality.md)
- **Expand coverage** — add how-to and tutorial intents to `docspec/`, then run `saifdocs gen` to include them in the next generation run
- **Explore the staleness model** — understand exactly how `generatedAt` and `mtime` comparisons work: [Staleness tracking](../concepts/staleness-tracking.md)
