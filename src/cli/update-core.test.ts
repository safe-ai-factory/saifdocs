import { mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MANIFEST_FILENAME, MANIFEST_VERSION } from '../constants.js';
import { generateEntries } from '../generation/generate.js';
import type { ManifestDocument, ManifestEntry } from '../manifest/types.js';
import { runUpdateCore } from './update-core.js';

describe('runUpdateCore', () => {
  const base = join(tmpdir(), `saifdocs-update-core-${process.pid}`);

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(base, { recursive: true, force: true }).catch(() => {});
  });

  function entry(
    partial: Partial<ManifestEntry> & Pick<ManifestEntry, 'id' | 'type'>,
  ): ManifestEntry {
    return {
      id: partial.id,
      type: partial.type,
      output: partial.output ?? join(base, 'out.md'),
      read: partial.read ?? [],
      productId: partial.productId ?? null,
      personaId: partial.personaId ?? null,
      taskIds: partial.taskIds ?? [],
      conceptId: partial.conceptId ?? null,
      tutorialPosition: partial.tutorialPosition ?? null,
      tutorialThreadLength: partial.tutorialThreadLength ?? null,
      generatedAt: partial.generatedAt ?? null,
    };
  }

  async function writeManifest(dir: string, doc: ManifestDocument): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, MANIFEST_FILENAME), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }

  it('returns missing-manifest-skipped when no manifest and allowMissingManifest', async () => {
    const dir = join(base, 'skip-missing');
    await mkdir(dir, { recursive: true });
    const r = await runUpdateCore({
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      types: 'all',
      dryRun: false,
      allowMissingManifest: true,
      gateRetries: 8,
    });
    expect(r).toEqual({ code: 0, kind: 'missing-manifest-skipped' });
  });

  it('returns missing-manifest-error when no manifest', async () => {
    const dir = join(base, 'err-missing');
    await mkdir(dir, { recursive: true });
    const r = await runUpdateCore({
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      types: 'all',
      dryRun: false,
      allowMissingManifest: false,
      gateRetries: 8,
    });
    expect(r).toEqual({ code: 2, kind: 'missing-manifest-error' });
  });

  it('returns read-manifest-failed when reader throws', async () => {
    const r = await runUpdateCore(
      {
        docspecDir: join(base, 'x'),
        outputDir: join(base, 'docs'),
        projectDir: base,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 8,
      },
      {
        readManifestFromDocspec: async () => {
          throw new Error('boom');
        },
        generateEntries,
      },
    );
    expect(r).toMatchObject({ code: 2, kind: 'read-manifest-failed', message: 'boom' });
  });

  it('returns nothing-to-update when no stale entries', async () => {
    const dir = join(base, 'fresh');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    const old = new Date('2020-01-01T00:00:00.000Z');
    await utimes(inputPath, old, old);
    const outputPath = join(base, 'out.md');
    await writeFile(outputPath, 'generated', 'utf8');

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };
    await writeManifest(dir, manifest);

    const gen = vi.fn();
    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 8,
      },
      {
        readManifestFromDocspec: async (d) => {
          expect(d).toBe(dir);
          return manifest;
        },
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );
    expect(r).toEqual({ code: 0, kind: 'nothing-to-update' });
    expect(gen).not.toHaveBeenCalled();
  });

  it('calls generateEntries when entry has generatedAt null', async () => {
    const dir = join(base, 'null-generated-at');
    await mkdir(dir, { recursive: true });

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [entry({ id: 'ref1', type: 'references', generatedAt: null })],
    };
    await writeManifest(dir, manifest);

    const gen = vi.fn().mockResolvedValue({
      summary: { attempted: 1, succeeded: 1, failed: 0, skipped: 0, failures: [] },
      manifest,
    });

    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 2,
      },
      {
        readManifestFromDocspec: async () => manifest,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r.kind).toBe('success');
    expect(gen).toHaveBeenCalledTimes(1);
    const only = gen.mock.calls[0]![2]?.onlyEntryIds;
    expect(only?.has('ref1')).toBe(true);
  });

  it('returns dry-run with stale list and does not call generateEntries', async () => {
    const dir = join(base, 'dry');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, future, future);

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };
    await writeManifest(dir, manifest);

    const gen = vi.fn();
    const onRegenerating = vi.fn();

    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: true,
        allowMissingManifest: false,
        gateRetries: 8,
        onRegenerating,
      },
      {
        readManifestFromDocspec: async () => manifest,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r.kind).toBe('dry-run');
    if (r.kind !== 'dry-run') throw new Error('expected dry-run');
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.id).toBe('ref1');
    expect(r.stale[0]!.staleInputs).toContain(inputPath);
    expect(gen).not.toHaveBeenCalled();
    expect(onRegenerating).not.toHaveBeenCalled();
  });

  it('returns invalid-gate-retries when gate retries invalid', async () => {
    const dir = join(base, 'bad-gate');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, future, future);

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };

    const gen = vi.fn();
    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: '0',
      },
      {
        readManifestFromDocspec: async () => manifest,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r).toMatchObject({ code: 1, kind: 'invalid-gate-retries', raw: '0' });
    expect(gen).not.toHaveBeenCalled();
  });

  it('calls generateEntries with onlyEntryIds for stale rows', async () => {
    const dir = join(base, 'regen');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, future, future);

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
        entry({
          id: 'ref2',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };

    const gen = vi.fn().mockResolvedValue({
      summary: { attempted: 2, succeeded: 2, failed: 0, skipped: 0, failures: [] },
      manifest,
    });

    const onRegenerating = vi.fn();

    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 2,
        onRegenerating,
      },
      {
        readManifestFromDocspec: async () => manifest,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r.kind).toBe('success');
    expect(onRegenerating).toHaveBeenCalledWith(2);
    expect(gen).toHaveBeenCalledTimes(1);
    const opts = gen.mock.calls[0]![2];
    expect(opts?.onlyEntryIds).toBeInstanceOf(Set);
    expect(opts?.onlyEntryIds?.size).toBe(2);
    expect(opts?.onlyEntryIds?.has('ref1')).toBe(true);
    expect(opts?.onlyEntryIds?.has('ref2')).toBe(true);
  });

  it('respects types filter: only stale entries of selected type are regenerated', async () => {
    const dir = join(base, 'types-filter');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, future, future);

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
        entry({
          id: 'c1',
          type: 'concepts',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };

    const gen = vi.fn().mockResolvedValue({
      summary: { attempted: 1, succeeded: 1, failed: 0, skipped: 0, failures: [] },
      manifest,
    });

    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: ['references'],
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 2,
      },
      {
        readManifestFromDocspec: async () => manifest,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r.kind).toBe('success');
    expect(gen).toHaveBeenCalledTimes(1);
    const only = gen.mock.calls[0]![2]?.onlyEntryIds;
    expect(only?.size).toBe(1);
    expect(only?.has('ref1')).toBe(true);
    expect(only?.has('c1')).toBe(false);
  });

  it('reads manifest from disk when using default deps (integration)', async () => {
    const dir = join(base, 'disk-read');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    await utimes(inputPath, new Date('2030-01-01'), new Date('2030-01-01'));

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };
    await writeManifest(dir, manifest);

    const gen = vi.fn().mockResolvedValue({
      summary: { attempted: 1, succeeded: 1, failed: 0, skipped: 0, failures: [] },
      manifest,
    });

    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 2,
      },
      {
        readManifestFromDocspec: (await import('../manifest/reader.js')).readManifestFromDocspec,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r.kind).toBe('success');
    expect(gen).toHaveBeenCalled();
  });

  it('returns generate-failed when generateEntries reports failures', async () => {
    const dir = join(base, 'fail-gen');
    const inputPath = join(dir, 'input.md');
    await mkdir(dir, { recursive: true });
    await writeFile(inputPath, 'x', 'utf8');
    const future = new Date('2030-01-01T00:00:00.000Z');
    await utimes(inputPath, future, future);

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir: dir,
      outputDir: join(dir, 'docs'),
      projectDir: dir,
      entries: [
        entry({
          id: 'ref1',
          type: 'references',
          read: [inputPath],
          generatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    };

    const summary = {
      attempted: 1,
      succeeded: 0,
      failed: 1,
      skipped: 0,
      failures: [{ id: 'ref1', message: 'sandbox failed' }],
    };

    const gen = vi.fn().mockResolvedValue({ summary, manifest });

    const r = await runUpdateCore(
      {
        docspecDir: dir,
        outputDir: manifest.outputDir,
        projectDir: manifest.projectDir,
        types: 'all',
        dryRun: false,
        allowMissingManifest: false,
        gateRetries: 2,
      },
      {
        readManifestFromDocspec: async () => manifest,
        generateEntries: gen as unknown as typeof generateEntries,
      },
    );

    expect(r).toMatchObject({ code: 1, kind: 'generate-failed', summary });
  });
});
