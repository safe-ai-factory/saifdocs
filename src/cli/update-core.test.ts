import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import {
  compileManifestToFeatureTree,
  type CompileToFeatureTreeResult,
} from '../features/compiler.js';
import type { ManifestDocument } from '../manifest/types.js';
import { resolveUpdateEntrySelector, runUpdateCore } from './update-core.js';

describe('resolveUpdateEntrySelector', () => {
  const manifest: ManifestDocument = {
    version: MANIFEST_VERSION,
    createdAt: 't',
    docspecDir: 'd',
    outputDir: 'o',
    projectDir: 'p',
    entries: [
      {
        id: 'reference--cli',
        type: 'references',
        output: '/tmp/docs/references/cli.md',
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
      },
      {
        id: 'concept--auth',
        type: 'concepts',
        output: '/tmp/docs/concepts/auth.md',
        read: [],
        productId: null,
        personaId: null,
        taskIds: [],
        conceptId: 'auth',
        tutorialPosition: null,
        tutorialThreadLength: null,
        generatedAt: null,
        outputHash: null,
        inputHashes: null,
      },
    ],
  };

  it('matches manifest id exactly', () => {
    expect(resolveUpdateEntrySelector(manifest, 'reference--cli')).toEqual({
      kind: 'ok',
      id: 'reference--cli',
    });
  });

  it('matches unique output path suffix', () => {
    expect(resolveUpdateEntrySelector(manifest, 'docs/references/cli.md')).toEqual({
      kind: 'ok',
      id: 'reference--cli',
    });
    expect(resolveUpdateEntrySelector(manifest, 'cli.md')).toEqual({
      kind: 'ok',
      id: 'reference--cli',
    });
  });

  it('returns not-found when no match', () => {
    expect(resolveUpdateEntrySelector(manifest, 'no-such')).toEqual({ kind: 'not-found' });
  });

  it('returns ambiguous when suffix matches multiple outputs', () => {
    const ambiguousManifest: ManifestDocument = {
      ...manifest,
      entries: [
        ...manifest.entries,
        {
          id: 'reference--other',
          type: 'references',
          output: '/somewhere/else/cli.md',
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
        },
      ],
    };
    expect(resolveUpdateEntrySelector(ambiguousManifest, 'cli.md')).toMatchObject({
      kind: 'ambiguous',
    });
  });
});

describe('runUpdateCore', () => {
  let tmpRoot: string;
  let projectDir: string;
  let docspecDir: string;
  let outputDir: string;
  let saifctlFeaturesDir: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'saifdocs-update-core-'));
    projectDir = join(tmpRoot, 'project');
    docspecDir = join(projectDir, 'docspec');
    outputDir = join(projectDir, 'docs');
    saifctlFeaturesDir = join(projectDir, 'saifctl', 'features');
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  function makeBaseInput(overrides: Partial<Parameters<typeof runUpdateCore>[0]> = {}) {
    return {
      docspecDir,
      outputDir,
      projectDir,
      saifctlFeaturesDir,
      types: 'all' as const,
      dryRun: false,
      allowMissingManifest: false,
      ...overrides,
    };
  }

  function fakeCompileResult(featureId = 'saifdocs-test'): CompileToFeatureTreeResult {
    return {
      featureId,
      featureDir: join(saifctlFeaturesDir, featureId),
      featureDirRel: `saifctl/features/${featureId}`,
      phases: [],
      byType: {},
    };
  }

  async function writeReadFile(path: string, when: Date): Promise<void> {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, 'src', 'utf8');
    await utimes(path, when, when);
  }

  it('returns missing-manifest-skipped when no manifest and allowMissingManifest', async () => {
    const r = await runUpdateCore(makeBaseInput({ allowMissingManifest: true }), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(null),
      compileManifestToFeatureTree:
        compileManifestToFeatureTree as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toEqual({ code: 0, kind: 'missing-manifest-skipped' });
  });

  it('returns missing-manifest-error when no manifest', async () => {
    const r = await runUpdateCore(makeBaseInput(), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(null),
      compileManifestToFeatureTree:
        compileManifestToFeatureTree as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toEqual({ code: 2, kind: 'missing-manifest-error' });
  });

  it('returns read-manifest-failed when reader throws', async () => {
    const r = await runUpdateCore(makeBaseInput(), {
      readManifestFromDocspec: vi.fn().mockRejectedValue(new Error('disk-go-boom')),
      compileManifestToFeatureTree:
        compileManifestToFeatureTree as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 2, kind: 'read-manifest-failed', message: 'disk-go-boom' });
  });

  it('returns nothing-to-update when no stale entries', async () => {
    const refReadPath = join(projectDir, 'src', 'cli.ts');
    await writeReadFile(refReadPath, new Date('2024-01-01T00:00:00.000Z'));
    const outputPath = join(outputDir, 'references', 'cli.md');
    await mkdir(join(outputPath, '..'), { recursive: true });
    await writeFile(outputPath, 'doc', 'utf8');
    await utimes(
      outputPath,
      new Date('2024-06-01T00:00:00.000Z'),
      new Date('2024-06-01T00:00:00.000Z'),
    );

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: outputPath,
          read: [refReadPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2024-06-01T00:00:00.000Z',
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn();
    const r = await runUpdateCore(makeBaseInput(), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toEqual({ code: 0, kind: 'nothing-to-update' });
    expect(compile).not.toHaveBeenCalled();
  });

  it('calls compiler when entry has generatedAt null', async () => {
    const refReadPath = join(projectDir, 'src', 'cli.ts');
    await writeReadFile(refReadPath, new Date('2024-06-01T00:00:00.000Z'));

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: join(outputDir, 'r.md'),
          read: [refReadPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: null, // never generated
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn().mockResolvedValue(fakeCompileResult());
    const r = await runUpdateCore(makeBaseInput(), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 0, kind: 'success' });
    expect(compile).toHaveBeenCalledTimes(1);
    const callArg = compile.mock.calls[0]![0];
    expect(callArg.onlyEntryIds).toBeInstanceOf(Set);
    expect([...(callArg.onlyEntryIds as Set<string>)]).toEqual(['r']);
  });

  it('returns dry-run with stale list and does not call compiler', async () => {
    const refReadPath = join(projectDir, 'src', 'cli.ts');
    await writeReadFile(refReadPath, new Date('2024-06-01T00:00:00.000Z'));

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: join(outputDir, 'r.md'),
          read: [refReadPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: null,
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn();
    const r = await runUpdateCore(makeBaseInput({ dryRun: true }), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 0, kind: 'dry-run' });
    expect(compile).not.toHaveBeenCalled();
  });

  it('calls compiler with onlyEntryIds containing only stale rows', async () => {
    const staleRead = join(projectDir, 'src', 'stale.ts');
    const freshRead = join(projectDir, 'src', 'fresh.ts');
    await writeReadFile(staleRead, new Date('2024-12-01T00:00:00.000Z')); // newer than generatedAt
    await writeReadFile(freshRead, new Date('2024-01-01T00:00:00.000Z')); // older

    const freshOutput = join(outputDir, 'fresh.md');
    await mkdir(join(freshOutput, '..'), { recursive: true });
    await writeFile(freshOutput, 'doc', 'utf8');

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'stale-one',
          type: 'references',
          output: join(outputDir, 'stale.md'),
          read: [staleRead],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2024-06-01T00:00:00.000Z',
          outputHash: null,
          inputHashes: null,
        },
        {
          id: 'fresh-one',
          type: 'references',
          output: freshOutput,
          read: [freshRead],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2024-06-01T00:00:00.000Z',
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn().mockResolvedValue(fakeCompileResult());
    const r = await runUpdateCore(makeBaseInput(), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 0, kind: 'success' });
    expect(compile).toHaveBeenCalledTimes(1);
    const ids = [...(compile.mock.calls[0]![0].onlyEntryIds as Set<string>)];
    expect(ids).toEqual(['stale-one']);
  });

  it('returns compile-failed when compiler throws', async () => {
    const refReadPath = join(projectDir, 'src', 'cli.ts');
    await writeReadFile(refReadPath, new Date('2024-06-01T00:00:00.000Z'));

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: join(outputDir, 'r.md'),
          read: [refReadPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: null,
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn().mockRejectedValue(new Error('compile-go-boom'));
    const r = await runUpdateCore(makeBaseInput(), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 1, kind: 'compile-failed', message: 'compile-go-boom' });
  });

  it('returns entry-not-found when --entry does not match', async () => {
    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: join(outputDir, 'r.md'),
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
        },
      ],
    };

    const r = await runUpdateCore(makeBaseInput({ entry: 'no-such' }), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: vi.fn() as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 1, kind: 'entry-not-found' });
  });

  it('returns entry-excluded-by-types when --entry type not in --types', async () => {
    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'c1',
          type: 'concepts',
          output: join(outputDir, 'c.md'),
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
        },
      ],
    };
    const compile = vi.fn();
    const r = await runUpdateCore(makeBaseInput({ entry: 'c1', types: ['references'] }), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 1, kind: 'entry-excluded-by-types' });
    expect(compile).not.toHaveBeenCalled();
  });

  it('calls compiler for non-stale row when --entry forces it', async () => {
    const refReadPath = join(projectDir, 'src', 'cli.ts');
    await writeReadFile(refReadPath, new Date('2024-01-01T00:00:00.000Z'));

    const outputPath = join(outputDir, 'r.md');
    await mkdir(join(outputPath, '..'), { recursive: true });
    await writeFile(outputPath, 'doc', 'utf8');
    await utimes(
      outputPath,
      new Date('2024-06-01T00:00:00.000Z'),
      new Date('2024-06-01T00:00:00.000Z'),
    );

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: outputPath,
          read: [refReadPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2024-06-01T00:00:00.000Z',
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn().mockResolvedValue(fakeCompileResult());
    const r = await runUpdateCore(makeBaseInput({ entry: 'r' }), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(r).toMatchObject({ code: 0, kind: 'success' });
    expect(compile).toHaveBeenCalledTimes(1);
    const ids = [...(compile.mock.calls[0]![0].onlyEntryIds as Set<string>)];
    expect(ids).toEqual(['r']);
  });

  it('passes featureId override through to the compiler', async () => {
    const refReadPath = join(projectDir, 'src', 'cli.ts');
    await writeReadFile(refReadPath, new Date('2024-12-01T00:00:00.000Z'));

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2024-06-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir,
      entries: [
        {
          id: 'r',
          type: 'references',
          output: join(outputDir, 'r.md'),
          read: [refReadPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2024-06-01T00:00:00.000Z',
          outputHash: null,
          inputHashes: null,
        },
      ],
    };

    const compile = vi.fn().mockResolvedValue(fakeCompileResult('saifdocs-stable'));
    await runUpdateCore(makeBaseInput({ featureId: 'saifdocs-stable' }), {
      readManifestFromDocspec: vi.fn().mockResolvedValue(manifest),
      compileManifestToFeatureTree: compile as unknown as typeof compileManifestToFeatureTree,
    });
    expect(compile.mock.calls[0]![0].featureId).toBe('saifdocs-stable');
  });
});
