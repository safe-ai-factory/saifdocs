import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { RunSubtaskInput } from '@safe-ai-factory/saifctl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import type { GenSettings, ManifestDocument, ManifestEntry } from '../manifest/types.js';
import * as writer from '../manifest/writer.js';
import { generateEntries, type RunSaifctlSandboxFn } from './generate.js';

async function readSubtasksFromOpts(opts: { subtasksFile?: string }): Promise<RunSubtaskInput[]> {
  const path = opts.subtasksFile;
  if (!path) throw new Error('expected subtasksFile');
  return JSON.parse(await readFile(path, 'utf8')) as RunSubtaskInput[];
}

describe('generateEntries', () => {
  const projectDir = resolve('/repo/proj');
  const docspecDir = resolve('/repo/proj/docspec');
  const outputDir = resolve('/repo/proj/docs');

  const baseSettings = (): GenSettings => ({
    docspecDir,
    outputDir,
    projectDir,
    types: ['references'],
    gateRetries: 2,
    dryRun: false,
    saifctlDir: 'saifctl',
  });

  const refEntry: ManifestEntry = {
    id: 'reference--commands--foo',
    type: 'references',
    output: resolve('/repo/proj/docs/references/commands/foo.md'),
    read: [resolve('/repo/proj/docspec/references/commands/foo.md')],
    productId: null,
    personaId: null,
    taskId: null,
    conceptId: null,
    tutorialPosition: null,
    tutorialThreadLength: null,
    generatedAt: null,
  };

  const conceptEntry: ManifestEntry = {
    id: 'concept--p1--c1',
    type: 'concepts',
    output: resolve('/repo/proj/docs/products/p1/concepts/c1.md'),
    read: [resolve('/repo/proj/docspec/products/p1/concepts/c1.md')],
    productId: 'p1',
    personaId: null,
    taskId: null,
    conceptId: 'c1',
    tutorialPosition: null,
    tutorialThreadLength: null,
    generatedAt: null,
  };

  const howToEntry: ManifestEntry = {
    id: 'how-to--p1--u1--t1',
    type: 'how-tos',
    output: resolve('/repo/proj/docs/products/p1/how-tos/h1.md'),
    read: [resolve('/repo/proj/docspec/products/p1/personas/u1/tasks/t1.md')],
    productId: 'p1',
    personaId: 'u1',
    taskId: 't1',
    conceptId: null,
    tutorialPosition: null,
    tutorialThreadLength: null,
    generatedAt: null,
  };

  const tutorialEntry: ManifestEntry = {
    id: 'tutorial--p1--intro-stage-1',
    type: 'tutorials',
    output: resolve('/repo/proj/docs/products/p1/tutorials/intro-stage-1.md'),
    read: [resolve('/repo/proj/docspec/products/p1/concepts/c1.md')],
    productId: 'p1',
    personaId: 'u1',
    taskId: null,
    conceptId: null,
    tutorialPosition: 1,
    tutorialThreadLength: 3,
    generatedAt: null,
  };

  const landingEntry: ManifestEntry = {
    id: 'landing--p1',
    type: 'landing-pages',
    output: resolve('/repo/proj/docs/products/p1/index.md'),
    read: [resolve('/repo/proj/docspec/products/p1/product.md')],
    productId: 'p1',
    personaId: null,
    taskId: null,
    conceptId: null,
    tutorialPosition: null,
    tutorialThreadLength: null,
    generatedAt: null,
  };

  const makeManifest = (entries: ManifestEntry[] = [refEntry]): ManifestDocument => ({
    version: MANIFEST_VERSION,
    createdAt: '2020-01-01T00:00:00.000Z',
    docspecDir,
    outputDir,
    projectDir,
    entries,
  });

  beforeEach(() => {
    vi.spyOn(writer, 'writeManifestToDocspec').mockResolvedValue('/fake/.manifest.json');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips sandbox when selected types have no matching entries', async () => {
    const runSandbox = vi.fn() as RunSaifctlSandboxFn;
    const { summary } = await generateEntries(
      makeManifest([refEntry]),
      { ...baseSettings(), types: ['concepts'] },
      { runSandbox },
    );
    expect(runSandbox).not.toHaveBeenCalled();
    expect(summary.attempted).toBe(0);
  });

  it('dry run increments skipped and does not call sandbox', async () => {
    const runSandbox = vi.fn() as RunSaifctlSandboxFn;
    const { summary } = await generateEntries(
      makeManifest([refEntry]),
      { ...baseSettings(), dryRun: true },
      { runSandbox },
    );
    expect(runSandbox).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });

  it('dry run skips all selected phase entries when types is all', async () => {
    const runSandbox = vi.fn() as RunSaifctlSandboxFn;
    const { summary } = await generateEntries(
      makeManifest([howToEntry, refEntry, conceptEntry, tutorialEntry, landingEntry]),
      { ...baseSettings(), types: 'all', dryRun: true },
      { runSandbox },
    );
    expect(runSandbox).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(5);
  });

  it('passes saifctlConfig through to runSandbox', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([refEntry]),
      { ...baseSettings(), saifctlConfig: '/cfg/saif.yaml' },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );
    expect(runSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        saifctlConfig: '/cfg/saif.yaml',
        subtasksFile: expect.any(String),
      }),
    );
  });

  it('passes cedarPolicyPath through to runSandbox when set', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([refEntry]),
      { ...baseSettings(), cedarPolicyPath: '/policies/review.cedar' },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );
    expect(runSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        cedarPolicyPath: '/policies/review.cedar',
      }),
    );
  });

  it('sets generatedAt and writes manifest once after successful sandbox', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    const { manifest: out } = await generateEntries(makeManifest([refEntry]), baseSettings(), {
      runSandbox: runSandbox as RunSaifctlSandboxFn,
    });
    const e = out.entries.find((x) => x.id === refEntry.id);
    expect(e?.generatedAt).toBeTruthy();
    expect(writer.writeManifestToDocspec).toHaveBeenCalledTimes(1);
  });

  it('generates concept entries when types includes concepts', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([conceptEntry]),
      { ...baseSettings(), types: ['concepts'] },
      {
        runSandbox: runSandbox as RunSaifctlSandboxFn,
      },
    );
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks[0]!.content).toContain('concept / explanation');
  });

  it('generates how-to entries when types includes how-tos', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([howToEntry]),
      { ...baseSettings(), types: ['how-tos'] },
      {
        runSandbox: runSandbox as RunSaifctlSandboxFn,
      },
    );
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks[0]!.content).toContain('how-to guide');
  });

  it('generates tutorial entries when types includes tutorials', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([tutorialEntry]),
      { ...baseSettings(), types: ['tutorials'] },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks[0]!.content).toContain('**tutorial stage**');
  });

  it('generates landing-page entries when types includes landing-pages', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([landingEntry]),
      { ...baseSettings(), types: ['landing-pages'] },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks[0]!.content).toContain('**product landing / index page**');
  });

  it('runs reference then concept then how-to then tutorial then landing in one sandbox when types is all', async () => {
    const order: string[] = [];
    const runSandbox = vi.fn().mockImplementation(async (opts) => {
      const subtasks = await readSubtasksFromOpts(opts as { subtasksFile: string });
      for (const st of subtasks) {
        const c = st.content;
        if (c.includes('**reference** documentation page')) order.push('references');
        else if (c.includes('concept / explanation')) order.push('concepts');
        else if (c.includes('**how-to guide**')) order.push('how-tos');
        else if (c.includes('**tutorial stage**')) order.push('tutorials');
        else if (c.includes('**product landing / index page**')) order.push('landing-pages');
      }
      return { code: 0 };
    });

    await generateEntries(
      makeManifest([howToEntry, refEntry, conceptEntry, tutorialEntry, landingEntry]),
      { ...baseSettings(), types: 'all' },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );

    expect(order).toEqual(['references', 'concepts', 'how-tos', 'tutorials', 'landing-pages']);
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks).toHaveLength(5);
  });

  it('only generates references when types is references-only', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(
      makeManifest([conceptEntry, refEntry]),
      { ...baseSettings(), types: ['references'] },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks[0]!.content).toContain('**reference** documentation page');
  });

  it('onlyEntryIds limits which entries run (full manifest preserved on disk writes)', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    const { manifest: out } = await generateEntries(
      makeManifest([refEntry, conceptEntry]),
      { ...baseSettings(), types: 'all' },
      {
        runSandbox: runSandbox as RunSaifctlSandboxFn,
        onlyEntryIds: new Set([conceptEntry.id]),
      },
    );
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks[0]!.content).toContain('concept / explanation');
    expect(out.entries.find((e) => e.id === refEntry.id)?.generatedAt).toBeNull();
    expect(out.entries.find((e) => e.id === conceptEntry.id)?.generatedAt).toBeTruthy();
  });

  it('leaves generatedAt null and counts failure when sandbox exits non-zero', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 1 });
    const { manifest: out, summary } = await generateEntries(
      makeManifest([refEntry]),
      baseSettings(),
      {
        runSandbox: runSandbox as RunSaifctlSandboxFn,
      },
    );
    // Output paths are under /repo/proj which does not exist on the test host — stat → failure.
    expect(out.entries.find((e) => e.id === refEntry.id)?.generatedAt).toBeNull();
    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(0);
  });

  it('marks entries with existing outputs as succeeded when sandbox exits non-zero', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'saifdocs-gen-test-'));
    const docs = join(tmp, 'docs');
    const docspec = join(tmp, 'docspec');
    await mkdir(join(docs, 'references', 'commands'), { recursive: true });
    await mkdir(join(docspec, 'references', 'commands'), { recursive: true });
    const outFoo = join(docs, 'references', 'commands', 'foo.md');
    const outBar = join(docs, 'references', 'commands', 'bar.md');
    await writeFile(outFoo, 'generated', 'utf8');

    const eFoo: ManifestEntry = {
      ...refEntry,
      output: outFoo,
      read: [join(docspec, 'references', 'commands', 'foo.md')],
    };
    const eBar: ManifestEntry = {
      ...refEntry,
      id: 'reference--commands--bar',
      output: outBar,
      read: [join(docspec, 'references', 'commands', 'bar.md')],
    };

    const settings: GenSettings = {
      ...baseSettings(),
      projectDir: tmp,
      outputDir: docs,
      docspecDir: docspec,
    };

    try {
      const runSandbox = vi.fn().mockResolvedValue({ code: 1 });
      const { summary } = await generateEntries(
        {
          ...makeManifest([eFoo, eBar]),
          projectDir: tmp,
          outputDir: docs,
          docspecDir: docspec,
        },
        settings,
        { runSandbox: runSandbox as RunSaifctlSandboxFn },
      );
      expect(runSandbox).toHaveBeenCalledTimes(1);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.failures.map((f) => f.id)).toContain(eBar.id);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('fails all selected entries when extract-include prefix cannot be computed', async () => {
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    const badOutput = resolve('/outside/docs');
    const { summary } = await generateEntries(
      makeManifest([refEntry, conceptEntry, howToEntry, tutorialEntry, landingEntry]),
      { ...baseSettings(), types: 'all', outputDir: badOutput },
      { runSandbox: runSandbox as RunSaifctlSandboxFn },
    );
    expect(runSandbox).not.toHaveBeenCalled();
    expect(summary.failed).toBe(5);
    expect(summary.failures).toHaveLength(5);
  });

  it('batches multiple references in one sandbox call', async () => {
    const refB: ManifestEntry = {
      ...refEntry,
      id: 'reference--commands--bar',
      output: resolve('/repo/proj/docs/references/commands/bar.md'),
      read: [resolve('/repo/proj/docspec/references/commands/bar.md')],
    };
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    await generateEntries(makeManifest([refEntry, refB]), baseSettings(), {
      runSandbox: runSandbox as RunSaifctlSandboxFn,
    });
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const subtasks = await readSubtasksFromOpts(
      runSandbox.mock.calls[0]![0] as { subtasksFile: string },
    );
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0]!.title).toBe(refEntry.id);
    expect(subtasks[1]!.title).toBe(refB.id);
  });
});
