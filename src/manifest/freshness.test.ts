import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import { populateHashesFromFiles } from './freshness.js';
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
    outputHash: null,
    inputHashes: null,
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

function sha256(content: string): string {
  return createHash('sha256').update(Buffer.from(content)).digest('hex');
}

describe('populateHashesFromFiles', () => {
  it('hashes the output file and stamps generatedAt when output exists', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const outPath = join(base, 'page.md');
      const body = '# page body\n';
      await writeFile(outPath, body, 'utf8');

      const m = manifest([entry({ id: 'a', output: outPath })]);
      const result = await populateHashesFromFiles(m);

      expect(result.entries[0]!.outputHash).toBe(sha256(body));
      expect(result.entries[0]!.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.entries[0]!.inputHashes).toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('leaves outputHash null and generatedAt null when the output is missing', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-missing-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const m = manifest([
        entry({
          id: 'a',
          output: join(base, 'never-existed.md'),
          generatedAt: '2025-01-01T00:00:00.000Z',
          outputHash: 'stale-hash',
        }),
      ]);

      const result = await populateHashesFromFiles(m);

      expect(result.entries[0]!.outputHash).toBeNull();
      expect(result.entries[0]!.generatedAt).toBeNull();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('hashes each `read` path into a parallel inputHashes array', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-reads-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const outPath = join(base, 'page.md');
      const inA = join(base, 'in-a.md');
      const inB = join(base, 'in-b.md');
      await writeFile(outPath, 'out', 'utf8');
      await writeFile(inA, 'aaa', 'utf8');
      await writeFile(inB, 'bbb', 'utf8');

      const m = manifest([entry({ id: 'a', output: outPath, read: [inA, inB] })]);
      const result = await populateHashesFromFiles(m);

      expect(result.entries[0]!.inputHashes).toEqual([sha256('aaa'), sha256('bbb')]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('represents a missing read file as a null slot in inputHashes', async () => {
    const base = join(tmpdir(), `saifdocs-freshness-mixed-${process.pid}-${Date.now()}`);
    try {
      await mkdir(base, { recursive: true });
      const outPath = join(base, 'page.md');
      const present = join(base, 'present.md');
      await writeFile(outPath, 'out', 'utf8');
      await writeFile(present, 'present-body', 'utf8');

      const m = manifest([
        entry({
          id: 'a',
          output: outPath,
          read: [present, join(base, 'missing.md')],
        }),
      ]);
      const result = await populateHashesFromFiles(m);

      expect(result.entries[0]!.inputHashes).toEqual([sha256('present-body'), null]);
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

      await populateHashesFromFiles(original);

      expect(JSON.stringify(original)).toBe(before);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('preserves manifest-level fields (createdAt, version, dirs)', async () => {
    const m = manifest([]);
    const result = await populateHashesFromFiles(m);
    expect(result.version).toBe(m.version);
    expect(result.createdAt).toBe(m.createdAt);
    expect(result.docspecDir).toBe(m.docspecDir);
    expect(result.outputDir).toBe(m.outputDir);
    expect(result.projectDir).toBe(m.projectDir);
  });
});
