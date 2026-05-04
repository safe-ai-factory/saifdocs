import { describe, expect, it } from 'vitest';

import type { TaskFrontmatter } from '../docspec/schema.js';
import { renderReviewTaskFile } from './review-task-file.js';

describe('renderReviewTaskFile', () => {
  it('includes persona body, task body, report path, and verdict section', () => {
    const md = renderReviewTaskFile({
      projectDir: '/proj',
      outputDir: '/proj/docs',
      productId: 'example-product',
      personaId: 'example-user',
      taskId: 'example-task',
      personaBody: 'I am a cautious user.',
      taskFrontmatter: {
        prereq_concepts: [],
        search_terms: ['run example safely'],
        arrival_context: 'search',
        user_stage: 'evaluating',
      },
      taskBody: 'Keep my data safe.',
      reportWorkspaceRel: 'docs/review/example-product/example-user/example-task-2026.md',
    });

    expect(md).toContain('I am a cautious user.');
    expect(md).toContain('Keep my data safe.');
    expect(md).toContain('docs/review/example-product/example-user/example-task-2026.md');
    expect(md).toContain('## Verdict');
    expect(md).toContain('PASS | PARTIAL | FAIL');
    expect(md).toContain('run example safely');
  });

  it('uses unspecified and (none specified) when frontmatter fields are incomplete', () => {
    const md = renderReviewTaskFile({
      projectDir: '/proj',
      outputDir: '/proj/docs',
      productId: 'p',
      personaId: 'u',
      taskId: 't',
      personaBody: '  Persona  ',
      taskFrontmatter: {
        prereq_concepts: [],
        search_terms: [],
      } as unknown as TaskFrontmatter,
      taskBody: '',
      reportWorkspaceRel: 'docs/review/p/u/t.md',
    });

    expect(md).toContain('**Arrival context:** `unspecified`');
    expect(md).toContain('(none specified)');
    expect(md).toContain(
      '**User stage** (`evaluating` | `getting-started` | `established`): `unspecified`',
    );
    expect(md).toContain('(empty task body)');
    expect(md).toContain('Persona');
  });
});
