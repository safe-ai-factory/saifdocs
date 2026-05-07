import { mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import { populateGeneratedAtFromOutputs } from './freshness.js';
import type { ManifestDocument, ManifestEntry } from './types.js';

function entry(overrides: Partial<ManifestEntry> & { id: string; output: string }): ManifestEntry {
  return {
    type: 'concepts',
    read: [],
    productId: null,
    personaId: null,
    taskIds: [],
    conceptId: null,
    tutorialPosition: null,
    tutorialThreadLength: null,
    generatedAt: null,
    ...overrides,
  };
}

function manifest(entries: ManifestEntry[]): ManifestDocument {
  return {
    version: MANIFEST_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    docspecDir: '/d',
    outputDir: '/o',
    projectDir: '/p',
    entries,
  };
}

describe('populateGeneratedAtFromOutputs', () => {
  it('sets generatedAt to the output mtime when the output file exists', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const outPath = join(base, 'page.md');
      await writeFile(outPath, '# page\n', 'utf8');
      const fixedMtime = new Date('2026-04-01T12:00:00.000Z');
      await utimes(outPath, fixedMtime, fixedMtime);

      const m = manifest([entry({ id: 'a', output: outPath })]);
      const result = await populateGeneratedAtFromOutputs(m);

      expect(result.entries[0]!.generatedAt).toBe(fixedMtime.toISOString());
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('sets generatedAt to null when the output file is missing', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-missing-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const m = manifest([
        entry({
          id: 'a',
          output: join(base, 'never-existed.md'),
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ]);

      const result = await populateGeneratedAtFromOutputs(m);

      expect(result.entries[0]!.generatedAt).toBeNull();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('refreshes a stale generatedAt when the output is newer than the recorded value', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-refresh-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const outPath = join(base, 'page.md');
      await writeFile(outPath, '# page\n', 'utf8');
      const newMtime = new Date('2026-05-08T10:00:00.000Z');
      await utimes(outPath, newMtime, newMtime);

      const m = manifest([
        entry({ id: 'a', output: outPath, generatedAt: '2025-01-01T00:00:00.000Z' }),
      ]);
      const result = await populateGeneratedAtFromOutputs(m);

      expect(result.entries[0]!.generatedAt).toBe(newMtime.toISOString());
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('does not mutate the input manifest', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-pure-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const outPath = join(base, 'page.md');
      await writeFile(outPath, 'x', 'utf8');

      const original = manifest([entry({ id: 'a', output: outPath })]);
      const before = JSON.stringify(original);

      await populateGeneratedAtFromOutputs(original);

      expect(JSON.stringify(original)).toBe(before);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('preserves manifest-level fields (createdAt, version, dirs)', async () => {
    const m = manifest([]);
    const result = await populateGeneratedAtFromOutputs(m);
    expect(result.version).toBe(m.version);
    expect(result.createdAt).toBe(m.createdAt);
    expect(result.docspecDir).toBe(m.docspecDir);
    expect(result.outputDir).toBe(m.outputDir);
    expect(result.projectDir).toBe(m.projectDir);
  });

  it('handles a mix of present and missing outputs', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-mixed-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const present = join(base, 'present.md');
      await writeFile(present, 'x', 'utf8');
      const fixedMtime = new Date('2026-03-15T08:00:00.000Z');
      await utimes(present, fixedMtime, fixedMtime);

      const m = manifest([
        entry({ id: 'present', output: present }),
        entry({ id: 'missing', output: join(base, 'missing.md') }),
      ]);
      const result = await populateGeneratedAtFromOutputs(m);

      expect(result.entries[0]!.generatedAt).toBe(fixedMtime.toISOString());
      expect(result.entries[1]!.generatedAt).toBeNull();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
