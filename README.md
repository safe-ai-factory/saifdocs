# saifdocs

Saifdocs is a **compiler**. It reads a **docspec** (intent model: products,
personas, tasks, concepts, reference pointers) and emits a saifctl
phases-and-critics feature tree. The user (or CI) then runs
`saifctl feat run --feature <id>` to actually generate the docs.

Saifdocs has **no runtime dependency on saifctl** — it only writes files.
saifctl is a dev-dep, used in tests. Cedar policy, agent profile, model
selection, etc. are decided by the consumer repo, not by saifdocs.

## Requirements

- Node.js 20+
- pnpm 9+
- saifctl installed in the consumer repo (only at *run* time, when the
  user invokes `saifctl feat run`; saifdocs itself doesn't need it).

## Usage

From this directory:

```bash
pnpm install
pnpm build
```

Resolve `docspec/`, write `docspec/.manifest.json`, and emit a
timestamped feature tree under `<project>/saifctl/features/`:

```bash
node dist/cli.js gen --project-dir ../..
```

Output:

```
saifctl/features/saifdocs-2026-05-04T10-30-45-123Z/
  feature.yml
  plan.md
  critics/
    audit.md            # documentation-review critic prompt
  phases/
    01-ref-cli-flags/   # one phase per file-to-generate
      spec.md
      tests/
        gate.sh
    02-ref-config/
    ...
```

Phase numbering width is computed from the run's total file count
(50 pages → `01..50`; 1023 pages → `0001..1023`) so lex ordering matches
emission order.

Then have the consumer repo run:

```bash
saifctl feat run --feature saifdocs-<timestamp>
```

Saifctl drives generation of every doc page, with the audit critic
reviewing each page after writing. Cedar policy, agent profile, etc.
come from the consumer repo's saifctl config or CLI flags.

### Manifest-only (no feature tree)

```bash
node dist/cli.js gen --project-dir ../.. --dry-run
```

Writes `docspec/.manifest.json` for staleness tracking; skips the
feature emission step.

### Override the feature id (in-place regeneration)

By default each saifdocs run produces a fresh timestamped feature dir,
so multiple runs accumulate side-by-side (good for monthly recurring
documentation refresh, before/after refactor snapshots, audit trails).
For in-place regeneration:

```bash
node dist/cli.js gen --project-dir ../.. --feature-id saifdocs-monthly
```

### Filter by output type

```bash
node dist/cli.js gen --project-dir ../.. --types references
```

### Override the saifctl features dir

```bash
node dist/cli.js gen --project-dir ../.. --saifctl-features-dir custom/path
```

### Export the manifest

Print to stdout:

```bash
node dist/cli.js gen --project-dir ../.. --export-manifest
```

Or write to a file:

```bash
node dist/cli.js gen --project-dir ../.. --export-manifest-out ./manifest.json
node dist/cli.js gen --project-dir ../.. --export-manifest-out stdout
```

### Incremental update — emit only stale phases

```bash
node dist/cli.js update --project-dir ../..
```

Reads the manifest, finds entries whose `read` paths are newer than the
last `generatedAt`, and emits a feature tree containing only those
phases. Use `--entry <id-or-output-suffix>` to force one specific page.

### Persona-simulation review

Emits a single-phase feature whose deliverable is a markdown review
report:

```bash
node dist/cli.js review \
  --product cli \
  --persona engineer \
  --task understand-safety-guarantees \
  --project-dir ../..
```

### Clear generated docs

```bash
node dist/cli.js clear
```

### Validate / audit

- `validate` — manifest staleness check (no LLM, no saifctl).
- `audit` — gap report: expected outputs vs files on disk (no LLM, no
  saifctl). Run *after* `saifctl feat run` to confirm coverage.

## Layout

- `docspec/` — source of truth (you edit this).
- `docs/` — default target directory for generated documentation (safe
  to delete with `clear`).

### Dogfooding in the SaifCTL repo

```bash
node dist/cli.js gen \
  --docspec-dir docspec \
  --output-dir ../../docs \
  --project-dir ../..
saifctl feat run --feature saifdocs-<timestamp>
```

See `../../docs/README.md` for audit, validate, and review examples.

## Commands

| Command | Description |
| --- | --- |
| `gen` / `generate` | Resolve docspec → write `docspec/.manifest.json` → emit a saifctl feature tree (run `saifctl feat run --feature <id>` afterwards). Use `--dry-run` to skip the emit step. |
| `update` | Emit a feature tree containing only stale phases (per validate). Use `--entry` to force a specific page. |
| `validate` | Check manifest staleness vs docspec (no LLM). |
| `audit` | Gap report: expected outputs vs files on disk (no LLM). |
| `review` | Emit a single-phase review feature (`--product`, `--persona`, `--task`). |
| `clear` | Remove `--output-dir` (default `docs/`). |

## License

MIT
