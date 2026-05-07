# Verify doc coverage

If you're seeing a gap report or want to confirm that every page declared in your `docspec/` actually exists on disk, `saifdocs audit` is the command to run. It checks for missing pages — `saifdocs audit missing pages`, `audit gaps`, and `check docs coverage` — without regenerating anything.

## Quick start

```bash
saifdocs audit
```

No LLM calls are made. If every declared page exists, you see:

```
[audit] No gaps (N check(s)).
```

If pages are missing, the command lists each one and exits with code `1`.

---

## What `audit` checks

`saifdocs audit` reads your `docspec/` directory, builds the expected output paths for every declared intent, and checks whether each file exists on disk under `docs/` (or the directory you pass via `--output-dir`). It covers:

| Docspec declaration | Expected output location |
|---|---|
| `docspec/references/**` | `docs/references/…` |
| `docspec/products/<id>/concepts/` | `docs/products/<id>/concepts/<id>.md` |
| `docspec/products/<id>/how-tos/` | `docs/products/<id>/how-tos/<id>.md` |
| `docspec/products/<id>/tutorials/` | `docs/products/<id>/tutorials/<id>.md` |
| Product landing page | `docs/products/<id>/index.md` |
| Task `prereq_concepts` | concept page on disk + declared in docspec |

It also catches `unknown-prereq-concept` errors — when a task's frontmatter names a concept that doesn't exist anywhere in `docspec/` — which indicates a docspec authoring mistake.

---

## Interpreting the output

When gaps are found, the console lists each one:

```
[missing-how-to] verify-doc-coverage → expected docs/products/saifdocs/how-tos/verify-doc-coverage.md
```

An `audit.md` report is also written to `docs/audit.md` by default. It groups findings by type (missing concepts, missing how-tos, etc.) and shows both the expected output path and the `docspec/` file that declared it — so you know exactly where to look.

### Gap types and what to do

| Gap type | Meaning | Fix |
|---|---|---|
| `missing-concept` / `missing-how-to` / `missing-tutorial` / `missing-landing` | Page was declared but never generated | Run `saifdocs gen` or `saifdocs update` then [`saifctl`](../../../saifctl/concepts/overview.md) `feat run` |
| `missing-reference` | Reference page declared but never generated | Run `saifdocs gen` then `saifctl feat run` |
| `missing-prereq-concept` | Concept is in docspec but its output page is missing | Generate the concept page first (concepts are prerequisites) |
| `unknown-prereq-concept` | Task `prereq_concepts` names an id not declared in docspec | Fix the task frontmatter in `docspec/` |

---

## Options

```
saifdocs audit [--docspec-dir <path>] [--output-dir <path>] [--write-report <bool>]
```

| Flag | Default | Description |
|---|---|---|
| `--docspec-dir` | `docspec` | Path to your docspec input directory |
| `--output-dir` | `docs` | Directory where generated pages should exist |
| `--write-report` | `true` | Write `audit.md` under `--output-dir` |

To suppress the report file:

```bash
saifdocs audit --no-write-report
```

---

## Add `audit` to CI

`saifdocs audit` exits with code `1` when gaps are found and makes no LLM calls, so it works cleanly as a CI gate:

```yaml
# GitHub Actions example
- name: Check doc coverage
  run: saifdocs audit
```

When the check fails, run `saifdocs gen` (or `saifdocs update` if you only edited existing files) locally, commit the generated pages, and push.

> **Note:** `audit` checks structural completeness — whether pages exist. It is distinct from `saifdocs validate`, which checks whether existing pages are *stale* relative to their source inputs. Run both if you want full coverage confidence.

---

## See also

- [Keep docs fresh](./keep-docs-fresh.md) — detect and regenerate stale pages with `saifdocs validate` and `saifdocs update`
- [Generate your first docs](./generate-first-docs.md) — initial setup and first generation run
- [The docspec directory](../concepts/docspec.md) — how `docspec/` declares what documentation to generate
- [The manifest build plan](../concepts/manifest-build-plan.md) — what the manifest contains and how pages are tracked
