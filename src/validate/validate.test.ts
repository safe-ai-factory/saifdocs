import { mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import type { ManifestDocument, ManifestEntry } from '../manifest/types.js';
import { validateManifest } from './validate.js';

describe('validateManifest', () => {
  const docspecDir = join(tmpdir(), `saifdocs-validate-${process.pid}`);
  const inputPath = join(docspecDir, 'input.md');

  afterEach(async () => {
    await rm(docspecDir, { recursive: true, force: true }).catch(() => {});
  });

  async function setupInputFile(): Promise<void> {
    await mkdir(docspecDir, { recursive: true });
    await writeFile(inputPath, 'content', 'utf8');
  }

  function makeManifest(
    entry: Partial<ManifestEntry> & Pick<ManifestEntry, 'id' | 'type'>,
  ): ManifestDocument {
    const full: ManifestEntry = {
      id: entry.id,
      type: entry.type,
      output: entry.output ?? join(docspecDir, 'out.md'),
      read: entry.read ?? [inputPath],
      productId: entry.productId ?? null,
      personaId: entry.personaId ?? null,
      taskIds: entry.taskIds ?? [],
      conceptId: entry.conceptId ?? null,
      tutorialPosition: entry.tutorialPosition ?? null,
      tutorialThreadLength: entry.tutorialThreadLength ?? null,
      generatedAt: entry.generatedAt ?? null,
    };
    return {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir,
      outputDir: join(docspecDir, 'docs'),
      projectDir: docspecDir,
      entries: [full],
    };
  }

  it('counts generatedAt null as skipped', async () => {
    await setupInputFile();
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        generatedAt: null,
      }),
    );
    expect(r.skipped).toBe(1);
    expect(r.upToDate).toBe(0);
    expect(r.stale).toHaveLength(0);
  });

  it('marks stale when read file mtime is after generatedAt', async () => {
    await setupInputFile();
    const past = new Date('2020-01-01T00:00:00.000Z');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, past, future);

    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        generatedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.id).toBe('e1');
    expect(r.stale[0]!.staleInputs).toContain(inputPath);
    expect(r.upToDate).toBe(0);
    expect(r.skipped).toBe(0);
  });

  it('marks up-to-date when read file mtime is before generatedAt', async () => {
    await setupInputFile();
    const old = new Date('2020-01-01T00:00:00.000Z');
    await utimes(inputPath, old, old);

    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        generatedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    expect(r.stale).toHaveLength(0);
    expect(r.upToDate).toBe(1);
  });

  it('marks up-to-date when read file mtime equals generatedAt (strict after only)', async () => {
    await setupInputFile();
    const same = new Date('2025-03-10T15:30:00.000Z');
    await utimes(inputPath, same, same);

    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        generatedAt: same.toISOString(),
      }),
    );
    expect(r.stale).toHaveLength(0);
    expect(r.upToDate).toBe(1);
  });

  it('ignores missing read paths (does not mark stale)', async () => {
    const missing = join(docspecDir, 'nope.md');
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        read: [missing],
        generatedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    expect(r.stale).toHaveLength(0);
    expect(r.upToDate).toBe(1);
  });

  it('filters by types', async () => {
    await setupInputFile();
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, future, future);

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir,
      outputDir: join(docspecDir, 'docs'),
      projectDir: docspecDir,
      entries: [
        {
          id: 'ref1',
          type: 'references',
          output: join(docspecDir, 'o1.md'),
          read: [inputPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'c1',
          type: 'concepts',
          output: join(docspecDir, 'o2.md'),
          read: [inputPath],
          productId: 'p',
          personaId: null,
          taskIds: [],
          conceptId: 'c',
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };

    const refsOnly = await validateManifest(manifest, { types: ['references'] });
    expect(refsOnly.stale).toHaveLength(1);
    expect(refsOnly.stale[0]!.id).toBe('ref1');

    const conceptsOnly = await validateManifest(manifest, { types: ['concepts'] });
    expect(conceptsOnly.stale).toHaveLength(1);
    expect(conceptsOnly.stale[0]!.id).toBe('c1');
  });

  it('marks stale when generatedAt is invalid', async () => {
    await setupInputFile();
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        generatedAt: 'not-a-date',
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.staleInputs[0]).toBe('(invalid generatedAt on manifest entry)');
  });
});
