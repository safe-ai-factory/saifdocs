# saifdocs

saifdocs is an **AI-driven documentation generator**: you describe your project's audience, tasks, and concepts in a structured intent tree (`docspec/`), saifdocs *compiles* that into a saifctl phases-and-critics feature tree, and `saifctl feat run` drives AI agents to write the actual markdown pages.

Primary outcome: `saifdocs gen` reads your `docspec/` directory, builds a manifest of every page that needs to be written, and emits a single timestamped feature dir under `<project>/saifctl/features/saifdocs-<timestamp>/` with **N phases — one per file-to-generate** plus a documentation-review critic. The user (or CI) then runs `saifctl feat run --feature <id>` to drive generation in dependency order (references → concepts → how-to's → tutorials → landing pages).

Saifdocs has **no runtime dependency on saifctl**: it's a pure compiler that emits files and exits. Cedar policy, agent profile, model selection, etc. are decided by the consumer repo's saifctl config or CLI flags, not by saifdocs.

Secondary workflows: `saifdocs update` emits a feature tree containing only stale pages (per validate); `saifdocs validate` detects staleness in CI without invoking any LLM; `saifdocs audit` checks for missing output files; `saifdocs review` emits a single-phase feature for a persona-simulation review.

saifdocs keeps control in the hands of the developer/technical writer, while handing off the repetitive work to the AI.

Tutorials and how-to's are described separately. They serve different purposes:
- Tutorial - almost like onboarding, introduces the product and its features
- How-to - a guide to a specific task or problem
