# The docspec/ directory: your documentation blueprint

The `docspec/` directory is not documentation. It is the structured description of documentation that *should exist* — the intent tree that saifdocs reads to figure out what pages to generate, for whom, and in what order.

Think of it as the difference between a recipe card and the finished dish, or a sitemap and the actual website. The `docspec/` tree is the plan; the `docs/` directory is the result.

## Why the separation matters

When you write documentation by hand, the intent and the output are the same artifact. When saifdocs generates docs with AI agents, you need two things:

- **A stable, human-controlled specification** of what to generate — audiences, tasks, concepts, references.
- **A generated output** that can be discarded, recreated, or updated without touching that spec.

The `docspec/` directory is what you version-control carefully and review in pull requests. The generated `docs/` output can be regenerated at any time from it, just as compiled artifacts can be rebuilt from source.

## How the tree is organized

A `docspec/` tree is organized around **products**. Each product gets a subdirectory that groups everything saifdocs needs to generate docs for that product:

```
docspec/
└── products/
    └── myapp/
        ├── product.md          # product description and primary outcome
        ├── how-tos.yaml        # how-to page intents
        ├── tutorials.yaml      # tutorial page intents
        ├── concepts/           # explanatory concept intents
        │   └── some-concept.md
        ├── personas/           # audience descriptions
        │   └── api-user/
        │       ├── persona.md
        │       └── tasks/
        │           └── some-task.md
        └── reference/          # pointers to source files
```

Each piece has a distinct role:

**`product.md`** — the narrative that frames everything else. It describes what the product does, its primary outcome (usually a `gen` or `run` command), and secondary workflows. The generator uses this to ground every page in the right framing.

**`personas/`** — descriptions of the people who will read the docs. A persona is not a marketing persona; it is a concise characterization of what the reader knows coming in, what they care about, and how they arrived. Tasks live under a persona directory and describe specific things that persona wants to accomplish.

**`concepts/`** — reusable explanatory units. A concept file declares what the page should explain (via `learning_outcomes`) and sometimes suggests analogies. It is *not* the explanation itself — saifdocs writes that. Concepts are generated before how-tos and tutorials, so those pages can build on them.

**`how-tos.yaml` / `tutorials.yaml`** — YAML manifests listing page intents. Each entry names a page, links it to a persona and optionally to concepts it can reference, and provides just enough context for saifdocs to write the full page.

**`reference/`** — pointers to source files (CLI help text, config schemas, OpenAPI specs) that the generator reads directly to produce accurate reference pages. These are generated first, before any other page type, because everything else cites them.

## The generation order matters

saifdocs uses the structure of the tree to determine a dependency order when building the manifest:

1. **References** — generated from source files; no dependencies.
2. **Concepts** — explanatory pages; may depend on references.
3. **How-tos** — task-oriented pages; may depend on concepts and references.
4. **Tutorials** — end-to-end learning paths; may depend on all of the above.
5. **Landing pages** — product entry points generated last.

This order means that by the time saifdocs writes a how-to page, the concept pages it links to already exist. A how-to for "configuring retries" can link to the "retry semantics" concept without the generator having to invent or inline that explanation.

## What the files contain (and what they don't)

A key thing to internalize: the files in `docspec/` are **intent declarations**, not drafts.

A concept file like `docspec/products/myapp/concepts/retry-semantics.md` does not contain an explanation of retry semantics. It contains metadata — `learning_outcomes`, optional `analogies`, a brief intent description — that tells the AI agent what the generated page must achieve. The agent writes the actual explanation.

Similarly, a persona file does not contain audience research slides. It contains a short paragraph about what the reader knows and cares about, so every generated page can be calibrated to that reader.

This keeps the `docspec/` tree small, human-readable, and reviewable. A pull request that adds a new persona and three new how-to intents is easy to review. The generated output — potentially many pages of prose — is reviewed separately, using `saifdocs review`.

## What this means when you author a docspec

When you add documentation coverage for a new feature, you are not writing the docs. You are writing the *intent*:

- Add or update `product.md` if the primary outcome changed.
- Add a concept file under `concepts/` if there is something new to explain.
- Add entries to `how-tos.yaml` for task-oriented pages the new feature enables.
- If the feature introduces a new audience, add a persona under `personas/`.

Once the intent is in place, `saifdocs gen` (or `saifdocs update` for incremental regeneration) handles the writing. See [Generating your first docs](../how-tos/generate-first-docs.md) for the workflow, and [Keeping docs fresh](../how-tos/keep-docs-fresh.md) for how staleness tracking connects the `docspec/` tree to your source code.
