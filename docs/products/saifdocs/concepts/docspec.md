# The docspec directory

`saifdocs` generates documentation from a structured intent tree called `docspec/`. Think of it as the blueprint: `docspec/` declares _what_ should exist and _for whom_; `saifdocs gen` turns that declaration into the actual markdown pages under `docs/`.

Just as a recipe card is not the finished dish, `docspec/` is not your documentation — it is the description of it.

## Minimal example

The smallest valid `docspec/` for a single product looks like this:

```
docspec/
└── products/
    └── myapp/
        ├── product.md
        └── concepts/
            └── overview.md
```

Running `saifdocs gen` against this tree emits a saifctl feature tree that, when executed with `saifctl feat run`, generates `docs/products/myapp/concepts/overview.md`.

## What docspec/ contains

A `docspec/` tree is organized by product. Just as a sitemap describes the pages of a website without containing their content, a `docspec/` tree declares the shape of your documentation without being the documentation itself. Each product directory holds the materials that describe one area of your documentation:

```
docspec/
└── products/
    └── myapp/
        ├── product.md              # Product overview and framing
        ├── rules.md                # Writing rules for this product
        ├── personas/
        │   └── developer/
        │       ├── persona.md      # Who the reader is
        │       └── rules.md        # Writing rules for this persona
        ├── concepts/
        │   └── architecture.md     # Concept intent files
        ├── how-tos/
        │   └── deploy.md           # How-to intent files
        └── tutorials/
            ├── index.yaml          # Optional ordering
            └── quickstart.md       # Tutorial intent files
```

Each file is an _intent file_: it carries frontmatter metadata (id, learning outcomes, analogies, links to source references) plus a short body describing what the page should cover. The intent file is not the generated page — it is the instruction that produces the page.

## The four building blocks

### Personas

A persona file (`personas/<name>/persona.md`) describes a specific type of reader: their background, goals, and what they already know. Persona rules (`rules.md` in the same directory) refine tone and style for that audience. When `saifdocs` generates a page, it reads the relevant persona files to frame the output for the right reader.

Personas describe the audience; tasks describe what that audience wants to accomplish. How-to and tutorial intent files are effectively task declarations — they name what the reader is trying to do and frame the generated page around that goal.

### Concepts

Concept files live under `concepts/`. Each one declares a single idea that the reader should understand after reading — an explanation-oriented page in the [Diátaxis](https://diataxis.fr/) sense. Concept pages build understanding of _why_ and _how things fit together_; they are not step-by-step guides.

How-to and tutorial pages can link to concepts rather than re-explaining the same idea.

### How-tos and tutorials

Both live as intent files under `how-tos/` and `tutorials/`, but they serve different purposes:

| | How-to | Tutorial |
|---|---|---|
| **Purpose** | Guide for a specific task | Onboarding and exploration |
| **Assumed state** | Reader has a goal | Reader is new to the product |
| **Structure** | Task-oriented steps | Narrative, builds progressively |

An optional `tutorials/index.yaml` controls the order tutorials appear in generated output.

### References

Reference entries point to source files — CLI command definitions, config schemas — that `saifdocs` reads directly when generating reference pages. This keeps reference docs in sync with the actual source of truth rather than a manually maintained copy.

## How saifdocs uses docspec/

When you run `saifdocs gen`, it walks the `docspec/` tree and builds a manifest of every page to generate:

```
docspec/ ──► saifdocs gen ──► saifctl feature tree ──► saifctl feat run ──► docs/
 (intent)                      (one phase per page)      (AI agents)         (markdown)
```

The feature tree emitted by `saifdocs gen` lives under `saifctl/features/saifdocs-<timestamp>/` — one phase per file to generate, plus a review critic. [`saifctl`](../../../saifctl/concepts/overview.md) then runs those phases in dependency order: references first, then concepts, then how-tos, then tutorials, then landing pages.

This separation means you control the intent (what to write, for whom, in what order), and the AI handles the prose.

## Rule precedence

Multiple `rules.md` files can exist at different levels. When generating a page, rules are applied in this order — later rules take precedence:

```
Global rules  <  Product rules  <  Persona rules
```

For example, a product rule that says "use formal tone" is overridden by a persona rule that says "be conversational" for that specific audience.

## Next steps

- To create your first `docspec/` structure and run generation, see the [generate your first docs how-to](../how-tos/generate-first-docs.md).
- To understand how `saifdocs update` emits a feature tree for only stale pages, see [Keep docs fresh](../how-tos/keep-docs-fresh.md).
- To validate that all declared pages exist without invoking the AI, use `saifdocs validate`.
