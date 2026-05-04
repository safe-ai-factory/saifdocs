# Staleness tracking

When your source files change — a docspec intent file is updated, a persona rule is revised, a product description is rewritten — any generated documentation that depended on those files is potentially out of date. saifdocs calls such pages **stale**, and it has a built-in mechanism to detect and fix staleness without regenerating everything from scratch.

## How saifdocs knows a page is stale

Every entry in the manifest (`.manifest.json`) records two pieces of information relevant to staleness:

- **`read`** — the list of source files that were fed to the AI agent when the page was generated (docspec intent files, persona files, rules, and so on).
- **`generatedAt`** — the timestamp when the page was last generated.

A page is considered **stale** when any file in its `read` list has a modification time (`mtime`) newer than `generatedAt`. If none of those files have changed since the page was written, the page is considered fresh and saifdocs leaves it alone.

This is the same logic that `make` uses for source-to-object dependency tracking: rebuild only the targets whose inputs have changed. For saifdocs, the "inputs" are docspec source files, and the "targets" are generated markdown pages.

## The two commands that use staleness

### `saifdocs validate` — detect without changing anything

`saifdocs validate` reads `.manifest.json`, checks every entry against the timestamps of its `read` inputs, and **reports** which pages are stale. It does not regenerate anything.

- Exits with code `1` if any stale entries are found; `0` if everything is fresh.
- Accepts `--json` for machine-readable output suitable for CI pipelines.
- Accepts `--allow-missing-manifest` to skip gracefully when no manifest has been built yet (useful early in a project's lifecycle).

This makes `saifdocs validate` the right tool to drop into a CI check: it catches documentation that has drifted from its sources and signals the drift without kicking off a potentially expensive regeneration run.

```yaml
# Example GitHub Actions step
- name: Check docs freshness
  run: saifdocs validate --json
```

### `saifdocs update` — regenerate only what's stale

`saifdocs update` does the same staleness check as `validate`, but then **reruns the AI agent** for every stale entry. Fresh pages are untouched.

This is incremental regeneration: if you edit `docspec/products/myapp/personas/developer/persona.md`, only the pages that listed that file in their `read` list will be regenerated. Everything else stays as-is.

## What `update` does not do

`saifdocs update` works from the existing `.manifest.json`. It will not add new pages, remove deleted pages, or change which pages the manifest tracks. The manifest structure is the exclusive responsibility of `saifdocs gen`.

Use `saifdocs gen` when:
- You add a new product, persona, concept, how-to, or tutorial to `docspec/`.
- You remove or rename a page.
- You change the shape of your docspec tree in any way that would alter which entries the manifest should contain.

Use `saifdocs update` when:
- Only the **content** of existing docspec files has changed (intent files, persona descriptions, rules).
- The set of pages to generate is unchanged.

Think of `gen` as the step that decides *what* to build, and `update` as the step that brings already-known pages back up to date.

## How staleness fits into a day-to-day workflow

A typical pattern looks like this:

1. **Once, to bootstrap:** run `saifdocs gen` to build the manifest and generate all pages.
2. **After editing source files:** run `saifdocs update` to regenerate only the affected pages.
3. **In CI:** run `saifdocs validate` to catch any pages that have drifted and haven't been updated yet.

Because `validate` is read-only and fast (it only stats files, it doesn't invoke the AI), it is safe to run on every pull request. A failing `validate` check tells the team that a source file changed but the corresponding generated page was not updated — the same signal a failing compilation gives in an incremental build system.

## Related reference pages

- [`saifdocs validate`](../../reference/commands/saifdocs/validate.md) — full flag reference
- [`saifdocs update`](../../reference/commands/saifdocs/update.md) — full flag reference
- [`saifdocs gen`](../../reference/commands/saifdocs/gen.md) — full generation, including manifest rebuild
