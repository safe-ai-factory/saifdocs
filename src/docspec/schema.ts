import { z } from 'zod';

/** Lowercase kebab-case slug for docspec `id` fields. */
export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: 'must be lowercase kebab-case (e.g. "my-how-to")',
});

/** Task audience maturity for how-to framing (was `day_n` 0/1/2). */
export const TaskUserStageSchema = z.enum(['evaluating', 'getting-started', 'established']);

export const TaskFrontmatterSchema = z.object({
  prereq_concepts: z.array(z.string()).default([]),
  arrival_context: z.enum(['search', 'readme', 'docs-link', 'error-message']),
  search_terms: z.array(z.string()).default([]),
  user_stage: TaskUserStageSchema,
});

export const ConceptFrontmatterSchema = z.object({
  id: z.string(),
  explains: z.string(),
  learning_outcomes: z.array(z.string()),
  analogies: z.array(z.string()),
});

export const ReferencePointerFrontmatterSchema = z.object({
  source: z.string(),
  type: z.enum(['cli-command', 'api-method', 'config-schema']),
});

export const PageTemplateFrontmatterSchema = z.object({
  intent: z.string().optional(),
});

/** Frontmatter for `products/<id>/how-tos/*.md`. `id` defaults to slugified filename stem. */
export const HowToFileFrontmatterSchema = z.object({
  id: SlugSchema.optional(),
  persona: z.string(),
  tasks: z.array(z.string().min(1)).min(1),
  goal: z.string().optional(),
});

/** Frontmatter for `products/<id>/tutorials/*.md` (ordering lives in optional `index.yaml`). */
export const TutorialFileFrontmatterSchema = z.object({
  id: SlugSchema.optional(),
  persona: z.string(),
  prereq_concepts: z.array(z.string()).default([]),
  learns_concepts: z.array(z.string()).default([]),
  goal: z.string().optional(),
});

/** One row in `tutorials/index.yaml` (or `index.yml`). */
export const TutorialIndexEntrySchema = z.object({
  id: SlugSchema,
  order: z.number().int().positive(),
  /** Prior tutorial in the same persona thread; output path is added to the read list. */
  prereq_id: z
    .union([z.string().min(1), z.null()])
    .optional()
    .default(null),
});

export type TaskUserStage = z.infer<typeof TaskUserStageSchema>;
export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;
export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;
export type ReferencePointerFrontmatter = z.infer<typeof ReferencePointerFrontmatterSchema>;
export type PageTemplateFrontmatter = z.infer<typeof PageTemplateFrontmatterSchema>;
export type HowToFileFrontmatter = z.infer<typeof HowToFileFrontmatterSchema>;
export type TutorialFileFrontmatter = z.infer<typeof TutorialFileFrontmatterSchema>;
export type TutorialIndexEntry = z.infer<typeof TutorialIndexEntrySchema>;
