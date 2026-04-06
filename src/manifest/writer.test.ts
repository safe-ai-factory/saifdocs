import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MANIFEST_FILENAME, MANIFEST_VERSION } from '../constants.js';
import type { ManifestDocument } from './types.js';
import { serializeManifest, writeManifestToDocspec } from './writer.js';

describe('manifest writer', () => {
  const sample: ManifestDocument = {
    version: MANIFEST_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    docspecDir: '/d',
    outputDir: '/o',
    projectDir: '/p',
    entries: [],
  };

  it('serializeManifest returns pretty JSON with trailing newline', () => {
    const s = serializeManifest(sample);
    expect(s.endsWith('\n')).toBe(true);
    expect(JSON.parse(s)).toEqual(sample);
  });

  it('writeManifestToDocspec creates parent dirs and writes .manifest.json', async () => {
    const base = join(tmpdir(), `saifdocs-writer-${process.pid}`);
    const docspecDir = join(base, 'nested', 'docspec');
    try {
      const path = await writeManifestToDocspec(docspecDir, sample);
      expect(path).toBe(join(docspecDir, MANIFEST_FILENAME));
      const raw = await readFile(path, 'utf8');
      expect(JSON.parse(raw)).toEqual(sample);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('writeManifestToDocspec succeeds when docspec dir already exists', async () => {
    const base = join(tmpdir(), `saifdocs-writer2-${process.pid}`);
    const docspecDir = join(base, 'docspec');
    try {
      await mkdir(docspecDir, { recursive: true });
      const path = await writeManifestToDocspec(docspecDir, sample);
      const raw = await readFile(path, 'utf8');
      expect(JSON.parse(raw).version).toBe(MANIFEST_VERSION);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
