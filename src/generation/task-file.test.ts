import { resolve } from 'node:path';

import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import type { ManifestEntry } from '../manifest/types.js';
import {
  renderConceptTaskFile,
  renderHowToTaskFile,
  renderLandingPageTaskFile,
  renderReferenceTaskFile,
  renderTutorialTaskFile,
} from './task-file.js';

describe('renderReferenceTaskFile', () => {
  const projectDir = resolve('/repo/proj');

  it('translates host-absolute paths to /workspace/-relative paths in body and frontmatter', () => {
    const entry: ManifestEntry = {
      id: 'reference--commands--test-cmd',
      type: 'references',
      output: resolve('/repo/proj/docs/references/commands/test-cmd.md'),
      read: [
        resolve('/repo/proj/docspec/references/commands/test-cmd.md'),
        resolve('/repo/proj/src/cli.ts'),
      ],
      productId: null,
      personaId: null,
      taskIds: [],
      conceptId: null,
      tutorialPosition: null,
      tutorialThreadLength: null,
      generatedAt: null,
      outputHash: null,
      inputHashes: null,
    };

    const raw = renderReferenceTaskFile(entry, projectDir);
    const parsed = matter(raw);

    expect(parsed.data).toMatchObject({
      type: 'references',
      output: '/workspace/docs/references/commands/test-cmd.md',
    });
    expect(parsed.data.read).toEqual([
      '/workspace/docspec/references/commands/test-cmd.md',
      '/workspace/src/cli.ts',
    ]);
    expect(parsed.data.workspace_relative_output).toBe('docs/references/commands/test-cmd.md');

    expect(parsed.content).toContain('docs/references/commands/test-cmd.md');
    expect(parsed.content).toContain('/workspace/docspec/references/commands/test-cmd.md');
    expect(parsed.content).toContain('/workspace/src/cli.ts');
  });
});

describe('renderConceptTaskFile', () => {
  const projectDir = resolve('/repo/proj');

  it('frames Diátaxis explanation and embeds read list', () => {
    const entry: ManifestEntry = {
      id: 'concept--p1--c1',
      type: 'concepts',
      output: resolve('/repo/proj/docs/products/p1/concepts/c1.md'),
      read: [resolve('/repo/proj/docspec/products/p1/concepts/c1.md')],
      productId: 'p1',
      personaId: null,
      taskIds: [],
      conceptId: 'c1',
      tutorialPosition: null,
      tutorialThreadLength: null,
      generatedAt: null,
      outputHash: null,
      inputHashes: null,
    };

    const raw = renderConceptTaskFile(entry, projectDir);
    const parsed = matter(raw);

    expect(parsed.data.type).toBe('concepts');
    expect(parsed.data.output).toBe('/workspace/docs/products/p1/concepts/c1.md');
    expect(parsed.data.read).toEqual(['/workspace/docspec/products/p1/concepts/c1.md']);
    expect(parsed.content).toContain('concept / explanation');
    expect(parsed.content).toContain('Diátaxis');
    expect(parsed.content).toContain('learning_outcomes');
    expect(parsed.content).toContain('Do not write numbered step-by-step');
    expect(parsed.content).toContain('docs/products/p1/concepts/c1.md');
    expect(parsed.content).toContain('/workspace/docspec/products/p1/concepts/c1.md');
  });
});

describe('renderHowToTaskFile', () => {
  const projectDir = resolve('/repo/proj');

  it('frames goal-oriented how-to and rules precedence', () => {
    const entry: ManifestEntry = {
      id: 'how-to--p1--u1--t1',
      type: 'how-tos',
      output: resolve('/repo/proj/docs/products/p1/how-tos/h1.md'),
      read: [resolve('/repo/proj/docspec/products/p1/personas/u1/tasks/t1.md')],
      productId: 'p1',
      personaId: 'u1',
      taskIds: ['t1'],
      conceptId: null,
      tutorialPosition: null,
      tutorialThreadLength: null,
      generatedAt: null,
      outputHash: null,
      inputHashes: null,
    };

    const raw = renderHowToTaskFile(entry, projectDir);
    const parsed = matter(raw);

    expect(parsed.data.type).toBe('how-tos');
    expect(parsed.content).toContain('how-to guide');
    expect(parsed.content).toContain('goal-oriented');
    expect(parsed.content).toContain('persona rules win over product rules');
  });

  it('embeds search terms and arrival context when hints are provided', () => {
    const entry: ManifestEntry = {
      id: 'how-to--p1--u1--t1',
      type: 'how-tos',
      output: resolve('/repo/proj/docs/products/p1/how-tos/h1.md'),
      read: [],
      productId: 'p1',
      personaId: 'u1',
      taskIds: ['t1'],
      conceptId: null,
      tutorialPosition: null,
      tutorialThreadLength: null,
      generatedAt: null,
      outputHash: null,
      inputHashes: null,
    };

    const raw = renderHowToTaskFile(entry, projectDir, {
      arrival_context: 'search',
      search_terms: ['run example safely'],
      user_stage: 'evaluating',
    });

    expect(raw).toContain('run example safely');
    expect(raw).toContain('search');
    expect(raw).toContain('user_stage: evaluating');
    expect(raw).toContain('pre-commitment');
  });
});

describe('renderTutorialTaskFile', () => {
  const projectDir = resolve('/repo/proj');

  it('includes tutorial position, thread length, persona, product in frontmatter and body', () => {
    const entry: ManifestEntry = {
      id: 'tutorial--p1--intro',
      type: 'tutorials',
      output: resolve('/repo/proj/docs/products/p1/tutorials/intro.md'),
      read: [resolve('/repo/proj/docspec/products/p1/concepts/c1.md')],
      productId: 'p1',
      personaId: 'example_user',
      taskIds: [],
      conceptId: null,
      tutorialPosition: 2,
      tutorialThreadLength: 5,
      generatedAt: null,
      outputHash: null,
      inputHashes: null,
    };

    const raw = renderTutorialTaskFile(entry, projectDir);
    const parsed = matter(raw);

    expect(parsed.data.type).toBe('tutorials');
    expect(parsed.data.tutorial_position).toBe(2);
    expect(parsed.data.tutorial_thread_length).toBe(5);
    expect(parsed.data.persona_id).toBe('example_user');
    expect(parsed.data.product_id).toBe('p1');
    expect(parsed.content).toContain('**tutorial stage**');
    expect(parsed.content).toContain('**Stage**: 2 of 5');
    expect(parsed.content).toContain('`example_user`');
    expect(parsed.content).toContain('docs/products/p1/tutorials/intro.md');
  });
});

describe('renderLandingPageTaskFile', () => {
  const projectDir = resolve('/repo/proj');

  it('includes product landing framing and output path; no persona in stage context', () => {
    const entry: ManifestEntry = {
      id: 'landing--p1',
      type: 'landing-pages',
      output: resolve('/repo/proj/docs/products/p1/index.md'),
      read: [resolve('/repo/proj/docspec/products/p1/product.md')],
      productId: 'p1',
      personaId: null,
      taskIds: [],
      conceptId: null,
      tutorialPosition: null,
      tutorialThreadLength: null,
      generatedAt: null,
      outputHash: null,
      inputHashes: null,
    };

    const raw = renderLandingPageTaskFile(entry, projectDir);
    const parsed = matter(raw);

    expect(parsed.data.type).toBe('landing-pages');
    expect(parsed.data.product_id).toBe('p1');
    expect(parsed.content).toContain('**product landing / index page**');
    expect(parsed.content).toContain('docs/products/p1/index.md');
    expect(parsed.content).toContain('product rules win over global rules');
    expect(parsed.content).not.toContain('## Stage context');
  });
});
