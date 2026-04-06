---
id: generation-pipeline
explains: how saifdocs generates docs in phases via saifctl sandbox subtasks
learning_outcomes:
  - Generation runs in five ordered phases — references, concepts, how-tos, tutorials, landing-pages — because later pages cite earlier ones.
  - Each entry in the manifest becomes one saifctl sandbox subtask; all subtasks run in a single sandbox session.
  - The generator passes a read list to the sandbox so the agent has exactly the context it needs — no more, no less.
  - A gate script checks that each output file was actually written before the subtask is marked successful.
analogies:
  - a compiler with multiple passes (parse → typecheck → codegen)
  - a CI pipeline where each stage's output feeds the next
---

Intent-only body; generated docs will expand this for the saifdocs product lens.
