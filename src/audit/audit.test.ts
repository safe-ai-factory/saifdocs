import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { readDocspec } from '../docspec/reader.js';
import { runAudit } from './audit.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixtureDir = join(__dirname, '../manifest/__fixtures__/minimal/docspec');

describe('runAudit', () => {
  const auditTmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(auditTmpDirs.map((d) => rm(d, { recursive: true, force: true })));
    auditTmpDirs.length = 0;
  });

  it('reports missing outputs when output dir is empty', async () => {
    const parsed = await readDocspec(fixtureDir);
    const out = await mkdtemp(join(tmpdir(), 'saifdocs-audit-empty-'));
    auditTmpDirs.push(out);

    const result = await runAudit(parsed, out);
    const types = new Set(result.findings.map((f) => f.type));
    expect(types.has('missing-reference')).toBe(true);
    expect(types.has('missing-concept')).toBe(true);
    expect(types.has('missing-how-to')).toBe(true);
    expect(types.has('missing-landing')).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('passes when expected files exist', async () => {
    const parsed = await readDocspec(fixtureDir);
    const out = await mkdtemp(join(tmpdir(), 'saifdocs-audit-full-'));
    auditTmpDirs.push(out);
    await mkdir(join(out, 'references', 'commands'), { recursive: true });
    await mkdir(join(out, 'products', 'p1', 'concepts'), { recursive: true });
    await mkdir(join(out, 'products', 'p1', 'how-tos'), { recursive: true });
    await writeFile(join(out, 'references', 'commands', 'test-cmd.md'), '# ref\n', 'utf8');
    await writeFile(join(out, 'products', 'p1', 'concepts', 'c1.md'), '# c\n', 'utf8');
    await writeFile(join(out, 'products', 'p1', 'how-tos', 'how-one.md'), '# h\n', 'utf8');
    await writeFile(join(out, 'products', 'p1', 'index.md'), '# landing\n', 'utf8');

    const result = await runAudit(parsed, out);
    expect(result.findings).toHaveLength(0);
    expect(result.checkedCount).toBeGreaterThan(0);
  });

  it('reports missing-tutorial when tutorials/ declares intents but output is absent', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-audit-tut-'));
    auditTmpDirs.push(base);
    const docs = join(base, 'docspec');
    await cp(fixtureDir, docs, { recursive: true });
    const tutDir = join(docs, 'products', 'p1', 'tutorials');
    await mkdir(tutDir, { recursive: true });
    await writeFile(
      join(tutDir, 'tut-one.md'),
      `---
persona: u1
prereq_concepts: []
learns_concepts: []
---

Tutorial intent.
`,
      'utf8',
    );
    await writeFile(
      join(tutDir, 'index.yaml'),
      `- id: tut-one
  order: 1
  prereq_id: null
`,
      'utf8',
    );

    const parsed = await readDocspec(docs);
    const out = join(base, 'out');
    await mkdir(out, { recursive: true });
    const result = await runAudit(parsed, out);

    expect(result.findings.some((f) => f.type === 'missing-tutorial')).toBe(true);
  });

  it('reports unknown-prereq-concept when task names a concept not in docspec', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-audit-bad-prereq-'));
    auditTmpDirs.push(base);
    const docs = join(base, 'docspec');
    await cp(fixtureDir, docs, { recursive: true });
    const taskPath = join(docs, 'products', 'p1', 'personas', 'u1', 'tasks', 't1.md');
    const raw = await readFile(taskPath, 'utf8');
    const updated = raw.replace(
      /prereq_concepts:\s*\n\s*-\s*c1/,
      'prereq_concepts:\n  - not-a-real-concept',
    );
    await writeFile(taskPath, updated, 'utf8');

    const parsed = await readDocspec(docs);
    const out = await mkdtemp(join(tmpdir(), 'saifdocs-audit-bad-prereq-out-'));
    auditTmpDirs.push(out);

    const result = await runAudit(parsed, out);
    expect(result.findings.some((f) => f.type === 'unknown-prereq-concept')).toBe(true);
  });
});
