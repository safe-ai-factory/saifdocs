---
id: generation-pipeline
explains: how saifdocs compiles docspec into a saifctl feature tree, then saifctl drives generation
learning_outcomes:
  - saifdocs is a compiler, not an orchestrator — it reads docspec and emits a saifctl phases-and-critics feature tree, then exits.
  - Each saifdocs run emits one timestamped feature dir with N phases — one per file-to-generate. Multiple runs accumulate side-by-side under `saifctl/features/`.
  - Phase ordering preserves the historical dependency order: references → concepts → how-tos → tutorials → landing-pages, encoded as lexicographic phase numbers.
  - Phase numbering width matches the run's total page count — 50 pages → `01..50`, 1023 pages → `0001..1023` — so lex ordering stays stable at any scale.
  - The user (or CI) runs `saifctl feat run --feature <id>` after `saifdocs gen` to actually drive generation. Cedar policy, agent profile, etc. are decided by the consumer repo, not saifdocs.
  - A built-in `audit` critic prompt reviews each generated page in fresh LLM context for omissions, false claims, and Diátaxis adherence.
analogies:
  - a compiler producing an executable that gets run separately (no JIT)
  - a build tool that emits a Makefile — the build itself is `make`'s job
---

Intent-only body; generated docs will expand this for the saifdocs product lens.
