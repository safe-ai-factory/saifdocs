---
prereq_concepts:
  - docspec
  - generation-pipeline
arrival_context: docs-link
search_terms:
  - saifdocs review persona simulation
  - validate doc quality ai
  - saifdocs review task
user_stage: established
---

# Task: run a persona-simulation quality review

The reader wants to check whether generated docs actually serve their intended audience. They want an AI to roleplay the persona and try to complete a task using only the docs, then report what was unclear or missing.

Success: they can run `saifdocs review --product <id> --persona <id> --task <id>` and find a review report under `docs/review/` that surfaces specific gaps or confusing passages.
