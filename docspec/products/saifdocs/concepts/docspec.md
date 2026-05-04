---
id: docspec
explains: the docspec/ directory structure that declares what documentation to generate
learning_outcomes:
  - A docspec/ directory is a structured intent tree, not the docs themselves — it is the blueprint.
  - Products group related personas, concepts, and markdown intents under `how-tos/` and `tutorials/` (optional `tutorials/index.yaml` for ordering); each how-to or tutorial file carries frontmatter plus a body the generator reads.
  - Personas describe the audience; tasks describe what that audience wants to accomplish.
  - Concepts are reusable explanatory units that how-to's and tutorials can build on.
  - References point to source files (CLI commands, config schemas) that the generator reads directly.
analogies:
  - a recipe card vs the finished dish (docspec = recipe, docs/ = dish)
  - a sitemap vs the actual website
---

Intent-only body; generated docs will expand this for the saifdocs product lens.

Describe tutorials and how-to's separately
