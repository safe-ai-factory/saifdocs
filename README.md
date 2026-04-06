# saifdocs

Saifdocs reads a **docspec** (intent model: products, personas, tasks, concepts, reference pointers) and writes **`docspec/.manifest.json`**, a manifest of every documentation output, its input files, and target paths.

## Requirements

- Node.js 20+
- pnpm 9+
- Docker + SaifCTL configured (for `gen` when not using `--dry-run`) — reference pages are generated via `saifctl sandbox` with `--extract` scoped to the output directory.

## Usage

From this directory:

```bash
pnpm install
pnpm build
```

Resolve `docspec/`, write `docspec/.manifest.json`, then generate **reference** pages (one `saifctl sandbox` run per reference entry) unless `--dry-run`:

```bash
node dist/cli.js gen --project-dir ../..
```

Manifest-only / no sandbox:

```bash
node dist/cli.js gen --project-dir ../.. --dry-run
```

Optional: `--saifctl-dir saifctl`, `--gate-retries 8`, `--types references`.

`--project-dir` must point at the **SaifCTL repo root** so `source:` paths in `docspec/references/` resolve (e.g. `src/cli/commands/sandbox.ts`).

Print manifest to stdout (boolean flag, no value):

```bash
node dist/cli.js gen --project-dir ../.. --export-manifest
```

Or write to a file, or use the string `stdout` / `-` via `--export-manifest-out`:

```bash
node dist/cli.js gen --project-dir ../.. --export-manifest-out ./manifest.json
node dist/cli.js gen --project-dir ../.. --export-manifest-out stdout
```

Direct dependencies used for docspec parsing: `gray-matter` (frontmatter), `js-yaml` (how-tos / tutorials manifests).

Only reference entries:

```bash
node dist/cli.js gen --project-dir ../.. --types references
```

Clear generated output directory (default `docs/`):

```bash
node dist/cli.js clear
```

## Layout

- `docspec/` — source of truth (you edit this).
- `docs/` — default target directory for generated documentation (safe to delete with `clear`).

### Dogfooding in the SaifCTL repo

Generated docs live at the monorepo root in `docs/` (legacy material is under `docs_old/`):

```bash
node dist/cli.js gen \
  --docspec-dir docspec \
  --output-dir ../../docs \
  --project-dir ../..
```

See `../../docs/README.md` for audit, validate, and review examples.

## Commands

| Command | Description |
| --- | --- |
| `gen` / `generate` | Resolve docspec → write `docspec/.manifest.json` → generate docs via saifctl sandbox (use `--dry-run` to skip sandbox) |
| `update` | Regenerate only manifest entries affected by docspec file changes |
| `validate` | Check manifest staleness vs docspec (optional `--project-dir`) |
| `audit` | Gap report: expected outputs vs files on disk |
| `review` | Persona simulation via sandbox (`--product`, `--persona`, `--task`) |
| `clear` | Remove `--output-dir` (default `docs/`) |

## License

MIT
