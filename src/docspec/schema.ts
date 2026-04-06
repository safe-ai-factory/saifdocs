import { z } from 'zod';

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

export const HowToIntentSchema = z.object({
  id: z.string(),
  persona: z.string(),
  task: z.string(),
  goal: z.string().optional(),
});

export const TutorialIntentSchema = z.object({
  id: z.string(),
  persona: z.string(),
  /** Generation order within the product (lower first). Same persona’s thread uses this for sorting. */
  order: z.number().int().positive(),
  /** Prior tutorial in the same persona thread; output path is added to the read list. */
  prereq_id: z
    .union([z.string().min(1), z.null()])
    .optional()
    .default(null),
  /** Concept ids the reader is assumed to already know at this stage. */
  prereq_concepts: z.array(z.string()),
  /** Concept ids introduced or reinforced in this stage (build adds these concept files to the read list). */
  learns_concepts: z.array(z.string()),
  goal: z.string().optional(),
});

export type TaskUserStage = z.infer<typeof TaskUserStageSchema>;
export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;
export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;
export type ReferencePointerFrontmatter = z.infer<typeof ReferencePointerFrontmatterSchema>;
export type PageTemplateFrontmatter = z.infer<typeof PageTemplateFrontmatterSchema>;
export type HowToIntent = z.infer<typeof HowToIntentSchema>;
export type TutorialIntent = z.infer<typeof TutorialIntentSchema>;
