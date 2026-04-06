import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { MANIFEST_FILENAME, MANIFEST_VERSION } from '../constants.js';
import { readManifestFromDocspec } from './reader.js';

describe('readManifestFromDocspec', () => {
  const base = join(tmpdir(), `saifdocs-reader-${process.pid}`);

  afterEach(async () => {
    await rm(base, { recursive: true, force: true }).catch(() => {});
  });

  it('returns null when manifest file is missing', async () => {
    const dir = join(base, 'no-manifest');
    await mkdir(dir, { recursive: true });
    const m = await readManifestFromDocspec(dir);
    expect(m).toBeNull();
  });

  it('parses a valid manifest', async () => {
    const dir = join(base, 'ok');
    await mkdir(dir, { recursive: true });
    const doc = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        {
          id: 'reference--commands--foo',
          type: 'references',
          output: join(dir, 'docs', 'references', 'commands', 'foo.md'),
          read: [join(dir, 'docspec', 'references', 'commands', 'foo.md')],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };
    await writeFile(join(dir, MANIFEST_FILENAME), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    const m = await readManifestFromDocspec(dir);
    expect(m).not.toBeNull();
    expect(m!.version).toBe(MANIFEST_VERSION);
    expect(m!.entries).toHaveLength(1);
    expect(m!.entries[0]!.id).toBe('reference--commands--foo');
  });

  it('throws on invalid JSON', async () => {
    const dir = join(base, 'bad-json');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, MANIFEST_FILENAME), '{', 'utf8');
    await expect(readManifestFromDocspec(dir)).rejects.toThrow();
  });

  it('throws on wrong manifest version', async () => {
    const dir = join(base, 'bad-version');
    await mkdir(dir, { recursive: true });
    const doc = {
      version: 999,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [],
    };
    await writeFile(join(dir, MANIFEST_FILENAME), `${JSON.stringify(doc)}\n`, 'utf8');
    await expect(readManifestFromDocspec(dir)).rejects.toThrow(/Unsupported manifest version/);
  });

  it('throws on schema validation failure (invalid entry type)', async () => {
    const dir = join(base, 'bad-schema-type');
    await mkdir(dir, { recursive: true });
    const doc = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        {
          id: 'x',
          type: 'not-a-valid-type',
          output: join(dir, 'out.md'),
          read: [],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: null,
        },
      ],
    };
    await writeFile(join(dir, MANIFEST_FILENAME), `${JSON.stringify(doc)}\n`, 'utf8');
    await expect(readManifestFromDocspec(dir)).rejects.toThrow(/Invalid manifest at/);
  });

  it('throws on schema validation failure (missing document field)', async () => {
    const dir = join(base, 'bad-schema-missing');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, MANIFEST_FILENAME),
      `${JSON.stringify({ version: MANIFEST_VERSION, entries: [] })}\n`,
      'utf8',
    );
    await expect(readManifestFromDocspec(dir)).rejects.toThrow(/Invalid manifest at/);
  });
});
