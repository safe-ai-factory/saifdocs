# Generate your first docs with saifdocs

If you landed here from the saifdocs README or searched for `saifdocs gen` or "AI documentation generator", this is the right page. By the end you will have run `saifdocs gen` on a real `docspec/` directory and found generated markdown files under `docs/`.

## Prerequisites

- saifdocs is installed and `saifdocs gen` is on your PATH.
- You have a `docspec/` directory at the root of your project with at least one product defined (e.g. `docspec/products/myapp/product.md`). If you have not set one up yet, see [Understanding the docspec tree](../concepts/docspec.md) — in short, `docspec/` is the blueprint that tells saifdocs *what* to generate; it is not the docs themselves.
- saifctl is configured with credentials so saifdocs can dispatch AI generation tasks. [saifctl docs →](../../saifctl/index.md)

## Steps

### 1. Verify your docspec tree is readable

From your project root, confirm the directory structure exists:

```
docspec/
└── products/
    └── myapp/
        ├── product.md
        └── personas/
            └── ...
```

At minimum you need one `product.md`. How-tos, tutorials, and concepts are optional for a first run but any declared in YAML manifests (`how-tos.yaml`, `tutorials.yaml`) will be included in the build.

### 2. Do a dry run to inspect the manifest

```bash
saifdocs gen --dry-run
```

`--dry-run` writes `.manifest.json` to your project root and exits without generating any files. The manifest is a build plan — one entry per output file, each listing the exact source files the AI will read. Review it to confirm every page you expect is present before committing generation time.

Open `.manifest.json` and check that:

- Every product you defined appears.
- The `read` arrays for each entry reference the right docspec source files.
- Output paths land under `docs/` where you expect them.

If entries are missing, check your docspec structure against [Understanding the docspec tree](../concepts/docspec.md).

### 3. Run the generator

```bash
saifdocs gen
```

saifdocs reads `.manifest.json`, then dispatches AI agent tasks via [saifctl](../../saifctl/index.md) to write each file. Pages are generated in dependency order — references first, then concepts, then how-tos, tutorials, and landing pages — so each page can build on the ones before it.

Watch the output for any errors. When the command finishes, your generated files are under `docs/`.

### 4. Check the output

```bash
ls docs/products/myapp/
```

You should see generated markdown files matching the structure declared in your docspec. Open a few to confirm they look correct.

## Troubleshooting

**No files generated, manifest is empty** — Your `docspec/` tree may not have any products or personas declared. Add at least a `product.md` and re-run `--dry-run`.

**saifctl authentication error** — saifdocs dispatches generation tasks through saifctl. Ensure saifctl is authenticated before running `saifdocs gen`.

**Output files are in the wrong location** — Check the `output` fields in your YAML manifests and the `product.md` for your product. The manifest dry run shows the resolved output paths before any files are written.

## Next steps

- **Regenerate only stale pages**: once you have a baseline, use `saifdocs update` to regenerate only pages whose docspec sources changed since the last run.
- **Detect staleness in CI**: `saifdocs validate` reads the existing manifest and flags pages that are out of date — useful as a CI gate.
- **Understand how the manifest works**: [The manifest and build plan](../concepts/manifest-build-plan.md)
- **Understand the docspec structure**: [Understanding the docspec tree](../concepts/docspec.md)
