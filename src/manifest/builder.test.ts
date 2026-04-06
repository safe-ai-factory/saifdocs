/**
 * Tests for `buildManifest` (`builder.ts`) and docspec parsing used by the manifest pipeline.
 * Named `builder.test.ts` to match the module under test (there is no `manifest.ts` entrypoint).
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DocspecError } from '../docspec/errors.js';
import { readDocspec } from '../docspec/reader.js';
import { buildManifest } from './builder.js';
import type { GenSettings } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const minimalRoot = join(__dirname, '__fixtures__', 'minimal');
const minimalDocspec = join(minimalRoot, 'docspec');
const minimalProject = join(minimalRoot, 'project');
const minimalOut = join(minimalRoot, 'out');

function baseSettings(overrides: Partial<GenSettings> = {}): GenSettings {
  return {
    docspecDir: minimalDocspec,
    outputDir: minimalOut,
    projectDir: minimalProject,
    types: 'all',
    ...overrides,
  };
}

describe('buildManifest', () => {
  it('builds expected entries for minimal docspec', async () => {
    const parsed = await readDocspec(minimalDocspec);
    const manifest = buildManifest(parsed, baseSettings());

    const types = manifest.entries.map((e) => e.type).sort();
    expect(types).toEqual(['concepts', 'how-tos', 'landing-pages', 'references']);

    const howTo = manifest.entries.find((e) => e.type === 'how-tos');
    expect(howTo?.id).toBe('how-to--p1--u1--t1');
    expect(howTo?.read.some((p) => p.includes('personas/u1/rules.md'))).toBe(true);
    expect(howTo?.read.some((p) => p.includes('concepts/c1.md'))).toBe(true);
  });

  it('orders persona rules before persona file in how-to read list', async () => {
    const parsed = await readDocspec(minimalDocspec);
    const manifest = buildManifest(parsed, baseSettings());
    const howTo = manifest.entries.find((e) => e.type === 'how-tos');
    expect(howTo).toBeDefined();
    const rulesIdx = howTo!.read.findIndex((p) => p.endsWith('personas/u1/rules.md'));
    const personaIdx = howTo!.read.findIndex((p) => p.endsWith('personas/u1/persona.md'));
    expect(rulesIdx).toBeGreaterThanOrEqual(0);
    expect(personaIdx).toBeGreaterThanOrEqual(0);
    expect(rulesIdx).toBeLessThan(personaIdx);
  });

  it('filters by types=references only', async () => {
    const parsed = await readDocspec(minimalDocspec);
    const manifest = buildManifest(parsed, baseSettings({ types: ['references'] }));
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]?.type).toBe('references');
  });

  it('omits global rules from read list when rules.md is absent', async () => {
    const root = join(__dirname, '__fixtures__', 'no-global');
    const parsed = await readDocspec(join(root, 'docspec'));
    const manifest = buildManifest(
      parsed,
      baseSettings({
        docspecDir: join(root, 'docspec'),
        projectDir: join(root, 'project'),
        types: ['references'],
      }),
    );
    const ref = manifest.entries[0];
    expect(ref?.read.filter((p) => p.endsWith('rules.md'))).toHaveLength(0);
  });

  it('produces stable entry ids across runs', async () => {
    const parsed = await readDocspec(minimalDocspec);
    const a = buildManifest(parsed, baseSettings())
      .entries.map((e) => e.id)
      .sort();
    const b = buildManifest(parsed, baseSettings())
      .entries.map((e) => e.id)
      .sort();
    expect(a).toEqual(b);
  });

  it('builds tutorial entries with prereq_id, order, and thread position metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saifdocs-tut-manifest-'));
    try {
      const docs = join(root, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      await writeFile(
        join(docs, 'products', 'p1', 'tutorials.yaml'),
        `- id: first
  persona: u1
  order: 1
  prereq_id: null
  prereq_concepts: []
  learns_concepts: []
- id: second
  persona: u1
  order: 2
  prereq_id: first
  prereq_concepts: []
  learns_concepts: []
`,
        'utf8',
      );
      const parsed = await readDocspec(docs);
      const manifest = buildManifest(
        parsed,
        baseSettings({
          docspecDir: docs,
          projectDir: minimalProject,
          outputDir: join(root, 'out'),
          types: ['tutorials'],
        }),
      );
      const tuts = manifest.entries.filter((e) => e.type === 'tutorials');
      expect(tuts).toHaveLength(2);
      const first = tuts.find((e) => e.id === 'tutorial--p1--first');
      const second = tuts.find((e) => e.id === 'tutorial--p1--second');
      expect(first?.tutorialPosition).toBe(1);
      expect(first?.tutorialThreadLength).toBe(2);
      expect(second?.tutorialPosition).toBe(2);
      expect(second?.tutorialThreadLength).toBe(2);
      expect(second?.read.some((p) => p.replace(/\\/g, '/').endsWith('tutorials/first.md'))).toBe(
        true,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('readDocspec validation', () => {
  it('accepts how-tos.yml as well as how-tos.yaml', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saifdocs-yml-howto-'));
    try {
      const docs = join(root, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      await rm(join(docs, 'products', 'p1', 'how-tos.yaml'));
      await writeFile(
        join(docs, 'products', 'p1', 'how-tos.yml'),
        await readFile(join(minimalDocspec, 'products', 'p1', 'how-tos.yaml'), 'utf8'),
        'utf8',
      );
      const parsed = await readDocspec(docs);
      const manifest = buildManifest(
        parsed,
        baseSettings({
          docspecDir: docs,
          projectDir: minimalProject,
          outputDir: join(root, 'out'),
        }),
      );
      expect(parsed.products[0]?.howTosManifestPath?.endsWith('how-tos.yml')).toBe(true);
      expect(manifest.entries.some((e) => e.type === 'how-tos')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('throws DocspecError when both how-tos.yaml and how-tos.yml exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saifdocs-dup-howto-'));
    try {
      const docs = join(root, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      const yamlContent = await readFile(join(docs, 'products', 'p1', 'how-tos.yaml'), 'utf8');
      await writeFile(join(docs, 'products', 'p1', 'how-tos.yml'), yamlContent, 'utf8');
      await expect(readDocspec(docs)).rejects.toMatchObject({ name: 'DocspecError' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('throws DocspecError for invalid task frontmatter', async () => {
    const root = join(__dirname, '__fixtures__', 'invalid-task');
    const badTaskPath = join(
      root,
      'docspec',
      'products',
      'p1',
      'personas',
      'u1',
      'tasks',
      'bad.md',
    );
    await expect(readDocspec(join(root, 'docspec'))).rejects.toMatchObject({
      name: 'DocspecError',
      filePath: badTaskPath,
    });
  });
});

describe('buildManifest errors', () => {
  it('throws DocspecError when how-to references a missing task file', async () => {
    const root = join(__dirname, '__fixtures__', 'missing-howto-task');
    const docspecPath = join(root, 'docspec');
    const howTosPath = join(docspecPath, 'products', 'p1', 'how-tos.yaml');
    const parsed = await readDocspec(docspecPath);
    const settings = baseSettings({
      docspecDir: docspecPath,
      projectDir: join(root, 'project'),
      types: ['how-tos'],
    });
    let err: unknown;
    try {
      buildManifest(parsed, settings);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DocspecError);
    expect((err as DocspecError).filePath).toBe(howTosPath);
    expect((err as DocspecError).message).toContain('missing-task-id');
  });

  it('throws DocspecError pointing at the task file when prereq_concepts names unknown concept', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saifdocs-bad-prereq-'));
    try {
      const docs = join(root, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      const taskPath = join(docs, 'products', 'p1', 'personas', 'u1', 'tasks', 't1.md');
      await writeFile(
        taskPath,
        `---
prereq_concepts:
  - not-a-real-concept
arrival_context: search
search_terms: []
user_stage: evaluating
---

Task body.
`,
        'utf8',
      );
      const parsed = await readDocspec(docs);
      const settings = baseSettings({
        docspecDir: docs,
        projectDir: minimalProject,
        outputDir: join(root, 'out'),
        types: ['how-tos'],
      });
      let err: unknown;
      try {
        buildManifest(parsed, settings);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(DocspecError);
      expect((err as DocspecError).filePath).toBe(taskPath);
      expect((err as DocspecError).message).toContain('not-a-real-concept');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('throws DocspecError when reference pointer source file is missing on disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'saifdocs-missing-ref-src-'));
    try {
      const docs = join(root, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      await writeFile(
        join(docs, 'references', 'commands', 'test-cmd.md'),
        `---
source: this-file-does-not-exist.ts
type: cli-command
---

Body.
`,
        'utf8',
      );
      const parsed = await readDocspec(docs);
      const settings = baseSettings({
        docspecDir: docs,
        projectDir: minimalProject,
        outputDir: join(root, 'out'),
        types: ['references'],
      });
      expect(() => buildManifest(parsed, settings)).toThrow(DocspecError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
