---
id: generation-pipeline
explains: how saifdocs turns docspec into a saifctl feature tree, then saifctl drives generation
learning_outcomes:
  - Each `saifdocs gen` produces one timestamped feature dir with N phases — one per file-to-generate. Multiple runs accumulate side-by-side under `saifctl/features/`.
  - 'Phase ordering follows the dependency chain: references → concepts → how-tos → tutorials → landing-pages, encoded as lexicographic phase numbers.'
  - Phase-number width matches the run's total page count — 50 pages → `01..50`, 1023 pages → `0001..1023` — so lex ordering stays stable at any scale.
  - After `saifdocs gen`, run `saifctl feat run --feature <id>` to actually generate the docs.
  - A built-in `audit` critic prompt reviews each generated page in fresh LLM context for omissions, false claims, and Diátaxis adherence.
analogies:
  - a build tool that writes a Makefile — the build itself is `make`'s job
---

Intent-only body; generated docs will expand this for the saifdocs product lens.
