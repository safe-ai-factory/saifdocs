# saifdocs

saifdocs is an **AI-driven documentation generator**: you describe your project's audience, tasks, and concepts in a structured intent tree (`docspec/`), and saifdocs runs AI agents via saifctl to write the actual markdown pages.

Primary outcome: `saifdocs gen` reads your `docspec/` directory, builds a manifest of every page that needs to be written, then sends those tasks to a saifctl sandbox that generates each file in dependency order (references → concepts → how-tos → tutorials → landing pages).

Secondary workflows: `saifdocs update` regenerates only stale pages; `saifdocs validate` detects staleness in CI; `saifdocs audit` checks for missing output files; `saifdocs review` runs a persona-simulation pass to verify quality.

saifdocs keeps the control in the hands of the developer/technical writer, while handing off the repetitive work to the AI.
