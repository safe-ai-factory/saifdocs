---
prereq_concepts:
  - docspec
arrival_context: error-message
search_terms:
  - saifdocs audit missing pages
  - check docs coverage
  - saifdocs audit gaps
user_stage: established
---

# Task: verify all declared pages have been generated

The reader wants to confirm that every page declared in their `docspec/` actually exists on disk — useful after a partial run or before publishing. They want to see exactly which files are missing and where they were declared.

Success: they can run `saifdocs audit` and either see "No gaps" or a list of missing files with the docspec source that declared each one.
