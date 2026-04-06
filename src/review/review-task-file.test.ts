import { describe, expect, it } from 'vitest';

import type { TaskFrontmatter } from '../docspec/schema.js';
import { renderReviewTaskFile } from './review-task-file.js';

describe('renderReviewTaskFile', () => {
  it('includes persona body, task body, report path, and verdict section', () => {
    const md = renderReviewTaskFile({
      projectDir: '/proj',
      outputDir: '/proj/docs',
      productId: 'saifbox',
      personaId: 'openclaw_user',
      taskId: 'protect-pc',
      personaBody: 'I am a cautious OpenClaw user.',
      taskFrontmatter: {
        prereq_concepts: [],
        search_terms: ['run openclaw safely'],
        arrival_context: 'search',
        user_stage: 'evaluating',
      },
      taskBody: 'Keep my machine safe.',
      reportWorkspaceRel: 'docs/review/saifbox/openclaw_user/protect-pc-2026.md',
    });

    expect(md).toContain('I am a cautious OpenClaw user.');
    expect(md).toContain('Keep my machine safe.');
    expect(md).toContain('docs/review/saifbox/openclaw_user/protect-pc-2026.md');
    expect(md).toContain('## Verdict');
    expect(md).toContain('PASS | PARTIAL | FAIL');
    expect(md).toContain('run openclaw safely');
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
