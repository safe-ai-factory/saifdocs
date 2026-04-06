---
id: manifest-build-plan
explains: what the .manifest.json file is, why it exists, and how it connects inputs to outputs
learning_outcomes:
  - The manifest is a build plan — one entry per output file, each listing which source files must be read to generate it.
  - saifdocs gen writes the manifest first, then hands it to the sandbox for generation.
  - saifdocs update and validate both read the existing manifest rather than re-parsing docspec/.
  - generatedAt on each entry enables staleness detection without re-running the full pipeline.
analogies:
  - a Makefile target with its dependencies
  - a lockfile that records exactly what was used to produce each output
---

Intent-only body; generated docs will expand this for the saifdocs product lens.
