---
prereq_concepts:
  - docspec
  - manifest-build-plan
arrival_context: readme
search_terms:
  - saifdocs gen
  - ai documentation generator
  - generate docs from docspec
user_stage: getting-started
---

# Task: generate docs for the first time

The reader wants to run `saifdocs gen` on their project for the first time. They have a `docspec/` directory with at least one product defined and want to see markdown output land in `docs/`.

Success: they can write a minimal docspec tree, run `saifdocs gen --dry-run` to verify the manifest, then run `saifdocs gen` for real and find generated markdown files under `docs/`.
