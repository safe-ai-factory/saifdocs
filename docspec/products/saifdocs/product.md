# saifdocs

saifdocs is an **AI-driven documentation generator**: you describe your project's audience, tasks, and concepts in a structured intent tree (`docspec/`), and saifdocs turns that into a saifctl feature tree that the AI agents then run to produce the actual markdown pages.

Primary outcome: `saifdocs gen` reads your `docspec/` directory, builds a manifest of every page that needs to be written, and emits a timestamped feature dir under `<project>/saifctl/features/saifdocs-<timestamp>/` with one phase per file-to-generate plus a documentation-review critic. Run `saifctl feat run --feature <id>` to generate the pages in dependency order: references → concepts → how-to's → tutorials → landing pages.

Secondary workflows: `saifdocs update` emits a feature tree containing only stale pages; `saifdocs validate` detects staleness in CI without invoking any LLM; `saifdocs audit` checks for missing output files; `saifdocs review` emits a single-phase feature for a persona-simulation review.

saifdocs keeps control in the hands of the developer/technical writer, while handing off the repetitive work to the AI.

Tutorials and how-to's are described separately. They serve different purposes:

- Tutorial - almost like onboarding, introduces the product and its features
- How-to - a guide to a specific task or problem
