# Keep docs fresh

When source files change — a CLI flag is renamed, a new command added, or a rules file updated — some generated pages become stale. Use `saifdocs validate` to see which pages need regenerating, then `saifdocs update` to regenerate only those pages. Both commands are designed to work in CI with no LLM calls required for the check step.

## Quick start

The third step uses `saifctl` (the agent runner that executes the feature tree emitted by `saifdocs update`). See [Generate your first docs](./generate-first-docs.md) for prerequisites and installation.

```bash
saifdocs validate               # see which pages are stale (no AI calls)
saifdocs update                 # emit a feature tree of only the stale pages
saifctl feat run --feature saifdocs-<timestamp>   # regenerate them
```

---

## 1. Detect stale pages

```bash
saifdocs validate
```

`saifdocs validate` reads `docspec/.manifest.json` and compares the `generatedAt` timestamp on each entry against the current modification time of every file in its `read` array. If any input file is newer than `generatedAt`, the page is stale.

Output lists each stale entry and exits with code `1` if any are found, or `0` if everything is current. No LLM calls are made.

> **How staleness works:** the manifest records exactly which source files (intent, product, persona, rules) fed into each output page. Any edit to those files marks the downstream pages as stale. See [Staleness tracking](../concepts/staleness-tracking.md) for the full model.

---

## 2. Regenerate stale pages

```bash
saifdocs update
```

`saifdocs update` runs the same staleness check as `validate`, then emits a `saifctl` feature tree containing only the phases for stale pages. Run that feature tree with:

```bash
saifctl feat run --feature saifdocs-<timestamp>
```

Only the stale pages are regenerated — unchanged pages are skipped entirely.

```
docspec/ (source files modified)
        │
        ▼
saifdocs update
  └─ checks mtime of each read[] file vs generatedAt
  └─ emits feature tree (stale phases only)
        │
        ▼
saifctl feat run --feature <id>
  └─ regenerates only stale pages
        │
        ▼
docs/ (updated pages)
```

---

## 3. When to use `gen` instead of `update`

`saifdocs update` reuses the existing manifest — it does **not** rebuild the dependency graph. If you made structural changes to `docspec/` (added a new concept file, renamed a persona, added a how-to intent), run `saifdocs gen` instead:

```bash
saifdocs gen
saifctl feat run --feature saifdocs-<timestamp>
```

Use this rule of thumb:

| Change type | Command |
|---|---|
| Edited an existing `docspec/` file | `saifdocs update` |
| Added, removed, or renamed files in `docspec/` | `saifdocs gen` |

---

## 4. Add `validate` to CI

Because `saifdocs validate` makes no LLM calls and returns a non-zero exit code when stale pages exist, it drops cleanly into any CI pipeline:

```yaml
# GitHub Actions example
- name: Check docs freshness
  run: saifdocs validate
```

This catches documentation that has drifted from source — for example, a rules file was updated but the pages depending on it were never regenerated — without incurring AI costs on every commit.

When the CI check fails, run `saifdocs update` locally and commit the regenerated pages.

---

## See also

- [Staleness tracking](../concepts/staleness-tracking.md) — how `generatedAt` and `mtime` comparisons work
- [The manifest build plan](../concepts/manifest-build-plan.md) — what `docspec/.manifest.json` contains and how it is built
- [Generate your first docs](./generate-first-docs.md) — initial setup and first generation run
