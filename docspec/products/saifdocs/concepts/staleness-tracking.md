---
id: staleness-tracking
explains: how saifdocs decides a generated page is out of date and needs to be regenerated
learning_outcomes:
  - An entry is stale when any file in its read list has a modification time newer than generatedAt.
  - validate reports staleness without regenerating; update regenerates only stale entries.
  - Adding saifdocs validate to CI catches docs that have drifted from their source without blocking the full gen pipeline.
  - update never rebuilds the manifest — only gen does that; use gen when docspec structure changes.
analogies:
  - make rebuild-if-newer (mtime-based dependency tracking)
  - incremental compilation
---

Intent-only body; generated docs will expand this for the saifdocs product lens.
