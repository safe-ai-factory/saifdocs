---
prereq_concepts:
  - manifest-build-plan
  - staleness-tracking
arrival_context: docs-link
search_terms:
  - saifdocs update stale
  - regenerate docs after source change
  - saifdocs validate ci
user_stage: established
---

# Task: keep docs fresh after source changes

The reader has already generated docs once. Now their source files changed (a CLI flag was renamed, a new command added). They want to know which pages are stale and regenerate only those without re-running everything.

Success: they can run `saifdocs validate` to see what is stale, then `saifdocs update` to regenerate only the affected pages. They can also add `saifdocs validate` to CI to catch staleness automatically.
