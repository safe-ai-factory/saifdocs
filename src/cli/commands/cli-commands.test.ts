import { cp, mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs } from 'citty';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as auditModule from '../../audit/audit.js';
import { MANIFEST_VERSION } from '../../constants.js';
import { consola } from '../../logger.js';
import type { ManifestDocument } from '../../manifest/types.js';
import { cliBooleanTrue } from '../args.js';
import type { UpdateCoreResult } from '../update-core.js';
import auditCommand from './audit.js';
import clearCommand from './clear.js';
import genCommand from './gen.js';
import reviewCommand from './review.js';
import updateCommand from './update.js';
import validateCommand from './validate.js';

const hoistedMocks = vi.hoisted(() => ({
  runUpdateCore: vi.fn(),
  runReview: vi.fn(),
}));

vi.mock('../update-core.js', () => ({
  runUpdateCore: hoistedMocks.runUpdateCore,
}));

vi.mock('../../review/review.js', () => ({
  runReview: hoistedMocks.runReview,
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalDocspec = join(__dirname, '../../manifest/__fixtures__/minimal/docspec');
const minimalProject = join(__dirname, '../../manifest/__fixtures__/minimal/project');

type CittyRunContext<Cmd extends { run?: (ctx: never) => unknown }> = Cmd extends {
  run?: (ctx: infer Ctx) => unknown;
}
  ? Ctx
  : never;

/** Build citty-shaped context (same as `runCommand` / real argv parsing). */
function ctxArgv<Cmd extends { args?: object; run?: (ctx: never) => unknown }>(
  cmd: Cmd,
  argv: string[],
): CittyRunContext<Cmd> {
  const args = parseArgs(argv, (cmd.args ?? {}) as Parameters<typeof parseArgs>[1]);
  return {
    rawArgs: argv,
    args,
    cmd: {},
  } as CittyRunContext<Cmd>;
}

function installExitMock() {
  const exitCodes: number[] = [];
  const spy = vi.spyOn(process, 'exit').mockImplementation(((
    code?: string | number | null | undefined,
  ) => {
    const c = code == null ? 0 : typeof code === 'number' ? code : Number(code) || 0;
    exitCodes.push(c);
    // Real `process.exit` never returns; returning here would fall through past `exit(0)` in CLI code.
    const err = new Error(`process.exit(${c})`);
    (err as Error & { exitCode: number }).exitCode = c;
    throw err;
  }) as typeof process.exit);
  return { spy, exitCodes };
}

describe('CLI clear (only deletes manifest-tracked files)', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  /** Write a manifest with the given output paths (one entry per path) under `docspecDir`. */
  async function writeManifest(
    docspecDir: string,
    outputDir: string,
    outputs: string[],
  ): Promise<void> {
    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir,
      outputDir,
      projectDir: docspecDir,
      entries: outputs.map((output, i) => ({
        id: `e${i}`,
        type: 'concepts' as const,
        output,
        read: [],
        productId: null,
        personaId: null,
        taskIds: [],
        conceptId: null,
        tutorialPosition: null,
        tutorialThreadLength: null,
        generatedAt: '2025-01-01T00:00:00.000Z',
      })),
    };
    await writeFile(
      join(docspecDir, '.manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  }

  it('is a no-op when no manifest exists (handwritten files survive)', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-no-manifest-'));
    try {
      const docspecDir = join(base, 'docspec');
      const outputDir = join(base, 'docs');
      await mkdir(docspecDir, { recursive: true });
      await mkdir(join(outputDir, 'nested'), { recursive: true });
      await writeFile(join(outputDir, 'nested', 'a.md'), 'x', 'utf8');

      await clearCommand.run!(
        ctxArgv(clearCommand, ['--docspec-dir', docspecDir, '--output-dir', outputDir]),
      );

      // Handwritten file untouched.
      await expect(readFile(join(outputDir, 'nested', 'a.md'), 'utf8')).resolves.toBe('x');
      expect(exitCtx.exitCodes).toHaveLength(0);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('deletes only manifest-tracked files; handwritten co-located files survive', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-coexist-'));
    try {
      const docspecDir = join(base, 'docspec');
      const outputDir = join(base, 'docs');
      const generated = join(outputDir, 'concepts', 'gen.md');
      const handwritten = join(outputDir, 'contributing', 'how-to-contribute.md');
      const handwrittenSibling = join(outputDir, 'index.md');

      await mkdir(docspecDir, { recursive: true });
      await mkdir(dirname(generated), { recursive: true });
      await mkdir(dirname(handwritten), { recursive: true });
      await writeFile(generated, 'generated', 'utf8');
      await writeFile(handwritten, 'handwritten', 'utf8');
      await writeFile(handwrittenSibling, 'index', 'utf8');

      await writeManifest(docspecDir, outputDir, [generated]);

      await clearCommand.run!(
        ctxArgv(clearCommand, ['--docspec-dir', docspecDir, '--output-dir', outputDir]),
      );

      // Generated file gone; handwritten survive.
      await expect(readFile(generated, 'utf8')).rejects.toThrow();
      await expect(readFile(handwritten, 'utf8')).resolves.toBe('handwritten');
      await expect(readFile(handwrittenSibling, 'utf8')).resolves.toBe('index');
      expect(exitCtx.exitCodes).toHaveLength(0);
    } finally {
      // (left for OS tmp cleanup)
    }
  });

  it('tolerates stale manifest entries (file already absent)', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-stale-'));
    try {
      const docspecDir = join(base, 'docspec');
      const outputDir = join(base, 'docs');
      const present = join(outputDir, 'concepts', 'present.md');
      const stale = join(outputDir, 'concepts', 'stale.md');

      await mkdir(docspecDir, { recursive: true });
      await mkdir(dirname(present), { recursive: true });
      await writeFile(present, 'p', 'utf8');
      // `stale` is in the manifest but never created on disk.

      await writeManifest(docspecDir, outputDir, [present, stale]);

      await clearCommand.run!(
        ctxArgv(clearCommand, ['--docspec-dir', docspecDir, '--output-dir', outputDir]),
      );

      await expect(readFile(present, 'utf8')).rejects.toThrow();
      expect(exitCtx.exitCodes).toHaveLength(0);
    } finally {
      // (left for OS tmp cleanup)
    }
  });

  it('ignores manifest entries pointing outside --output-dir', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-outside-'));
    try {
      const docspecDir = join(base, 'docspec');
      const outputDir = join(base, 'docs');
      const inside = join(outputDir, 'concepts', 'in.md');
      const outside = join(base, 'other', 'out.md');

      await mkdir(docspecDir, { recursive: true });
      await mkdir(dirname(inside), { recursive: true });
      await mkdir(dirname(outside), { recursive: true });
      await writeFile(inside, 'in', 'utf8');
      await writeFile(outside, 'out', 'utf8');

      await writeManifest(docspecDir, outputDir, [inside, outside]);

      await clearCommand.run!(
        ctxArgv(clearCommand, ['--docspec-dir', docspecDir, '--output-dir', outputDir]),
      );

      await expect(readFile(inside, 'utf8')).rejects.toThrow();
      // `outside` is outside --output-dir, must be untouched.
      await expect(readFile(outside, 'utf8')).resolves.toBe('out');
      expect(exitCtx.exitCodes).toHaveLength(0);
    } finally {
      // (left for OS tmp cleanup)
    }
  });

  it('prunes empty parent directories up to (but not including) --output-dir', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-prune-'));
    try {
      const docspecDir = join(base, 'docspec');
      const outputDir = join(base, 'docs');
      const deep = join(outputDir, 'a', 'b', 'c', 'page.md');

      await mkdir(docspecDir, { recursive: true });
      await mkdir(dirname(deep), { recursive: true });
      await writeFile(deep, 'p', 'utf8');

      await writeManifest(docspecDir, outputDir, [deep]);

      await clearCommand.run!(
        ctxArgv(clearCommand, ['--docspec-dir', docspecDir, '--output-dir', outputDir]),
      );

      // The chain a/b/c is empty after deletion → all pruned. outputDir itself stays.
      await expect(readFile(deep, 'utf8')).rejects.toThrow();
      await expect(readdir(join(outputDir, 'a'))).rejects.toMatchObject({ code: 'ENOENT' });
      // outputDir survives:
      await expect(readdir(outputDir)).resolves.toEqual([]);
    } finally {
      // (left for OS tmp cleanup)
    }
  });

  it('respects cwd-relative --docspec-dir / --output-dir defaults', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-cwd-'));
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(base);
    try {
      const docspecDir = join(base, 'docspec');
      const outputDir = join(base, 'docs');
      const page = join(outputDir, 'p.md');
      await mkdir(docspecDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(page, 'p', 'utf8');

      await writeManifest(docspecDir, outputDir, [page]);

      await clearCommand.run!(ctxArgv(clearCommand, []));

      await expect(readFile(page, 'utf8')).rejects.toThrow();
      expect(exitCtx.exitCodes).toHaveLength(0);
    } finally {
      cwdSpy.mockRestore();
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe('CLI validate', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  it('ctxArgv parses --allow-missing-manifest as true', () => {
    const ctx = ctxArgv(validateCommand, ['--allow-missing-manifest', '--docspec-dir', '/tmp/x']);
    expect(
      cliBooleanTrue(
        ctx.args as Record<string, unknown>,
        'allow-missing-manifest',
        'allowMissingManifest',
      ),
    ).toBe(true);
  });

  beforeEach(() => {
    exitCtx = installExitMock();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('exits 1 on invalid --types', async () => {
    await expect(
      validateCommand.run!(ctxArgv(validateCommand, ['--types', 'not-a-real-type'])),
    ).rejects.toMatchObject({ exitCode: 1 });
  });

  it('exits 2 when manifest missing and not allowed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saifdocs-val-'));
    try {
      await expect(
        validateCommand.run!(ctxArgv(validateCommand, ['--docspec-dir', dir])),
      ).rejects.toMatchObject({ exitCode: 2 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits 0 when manifest missing with --allow-missing-manifest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saifdocs-val2-'));
    try {
      await expect(
        validateCommand.run!(
          ctxArgv(validateCommand, ['--allow-missing-manifest', '--docspec-dir', dir]),
        ),
      ).rejects.toMatchObject({ exitCode: 0 });
      expect(exitCtx.exitCodes).toEqual([0]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits 0 when manifest valid and entries out of scope for --types', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saifdocs-val3-'));
    try {
      const manifest: ManifestDocument = {
        version: MANIFEST_VERSION,
        createdAt: '2020-01-01T00:00:00.000Z',
        docspecDir: dir,
        outputDir: join(dir, 'docs'),
        projectDir: dir,
        entries: [
          {
            id: 'e1',
            type: 'references',
            output: join(dir, 'o.md'),
            read: [],
            productId: null,
            personaId: null,
            taskIds: [],
            conceptId: null,
            tutorialPosition: null,
            tutorialThreadLength: null,
            generatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'e2',
            type: 'concepts',
            output: join(dir, 'o2.md'),
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
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'o.md'), 'ok', 'utf8');
      await writeFile(
        join(dir, '.manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await expect(
        validateCommand.run!(
          ctxArgv(validateCommand, ['--docspec-dir', dir, '--json', '--types', 'references']),
        ),
      ).rejects.toMatchObject({ exitCode: 0 });

      expect(exitCtx.exitCodes).toEqual([0]);
      expect(stdoutSpy.mock.calls.some((c) => String(c[0]).includes('"stale"'))).toBe(true);
      stdoutSpy.mockRestore();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits 1 with --json when an entry is stale', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saifdocs-val-stale-json-'));
    try {
      const staleInput = join(dir, 'input.md');
      await writeFile(staleInput, 'v1', 'utf8');
      const manifest: ManifestDocument = {
        version: MANIFEST_VERSION,
        createdAt: '2020-01-01T00:00:00.000Z',
        docspecDir: dir,
        outputDir: join(dir, 'docs'),
        projectDir: dir,
        entries: [
          {
            id: 'stale-ref',
            type: 'references',
            output: join(dir, 'out.md'),
            read: [staleInput],
            productId: null,
            personaId: null,
            taskIds: [],
            conceptId: null,
            tutorialPosition: null,
            tutorialThreadLength: null,
            generatedAt: '2000-01-01T00:00:00.000Z',
          },
        ],
      };
      await writeFile(
        join(dir, '.manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      const newer = new Date('2025-01-15T12:00:00.000Z');
      await utimes(staleInput, newer, newer);

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await expect(
        validateCommand.run!(ctxArgv(validateCommand, ['--docspec-dir', dir, '--json'])),
      ).rejects.toMatchObject({ exitCode: 1 });

      expect(exitCtx.exitCodes).toEqual([1]);
      const out = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(JSON.parse(out).stale).toHaveLength(1);
      expect(JSON.parse(out).stale[0].id).toBe('stale-ref');
      stdoutSpy.mockRestore();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits 1 without --json and prints stale details', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saifdocs-val-stale-text-'));
    try {
      const staleInput = join(dir, 'input2.md');
      await writeFile(staleInput, 'v1', 'utf8');
      const manifest: ManifestDocument = {
        version: MANIFEST_VERSION,
        createdAt: '2020-01-01T00:00:00.000Z',
        docspecDir: dir,
        outputDir: join(dir, 'docs'),
        projectDir: dir,
        entries: [
          {
            id: 'stale-ref-2',
            type: 'references',
            output: join(dir, 'out2.md'),
            read: [staleInput],
            productId: null,
            personaId: null,
            taskIds: [],
            conceptId: null,
            tutorialPosition: null,
            tutorialThreadLength: null,
            generatedAt: '2000-01-01T00:00:00.000Z',
          },
        ],
      };
      await writeFile(
        join(dir, '.manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      const newer = new Date('2025-02-15T12:00:00.000Z');
      await utimes(staleInput, newer, newer);

      const warnSpy = vi.spyOn(consola, 'warn').mockImplementation(() => undefined);

      await expect(
        validateCommand.run!(ctxArgv(validateCommand, ['--docspec-dir', dir])),
      ).rejects.toMatchObject({ exitCode: 1 });

      expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('STALE'))).toBe(true);
      warnSpy.mockRestore();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('CLI gen', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('exits 1 on invalid --types', async () => {
    await expect(genCommand.run!(ctxArgv(genCommand, ['--types', 'bogus']))).rejects.toMatchObject({
      exitCode: 1,
    });
  });

  it('dry-run completes without non-zero process.exit (manifest written, no feature dir emitted)', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen2-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      const featuresDir = join(base, 'saifctl', 'features');
      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(base, 'out'),
          '--project-dir',
          minimalProject,
          '--saifctl-features-dir',
          featuresDir,
          '--dry-run',
        ]),
      );
      expect(exitCtx.exitCodes).toHaveLength(0);
      const manifestRaw = await readFile(join(docs, '.manifest.json'), 'utf8');
      expect(JSON.parse(manifestRaw).entries.length).toBeGreaterThan(0);
      // Dry-run must not emit a feature dir.
      const featuresExists = await readFile(featuresDir).catch(() => null);
      expect(featuresExists).toBeNull();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('emits a feature dir under saifctl/features/ on a real run', async () => {
    // Layout: project/{docspec, src, out, saifctl/features} — output-dir
    // must sit inside project-dir for the compiler's path validation.
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen-emit-'));
    try {
      const projectInTmp = join(base, 'project');
      await cp(minimalProject, projectInTmp, { recursive: true });
      const docs = join(projectInTmp, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      const featuresDir = join(projectInTmp, 'saifctl', 'features');
      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(projectInTmp, 'out'),
          '--project-dir',
          projectInTmp,
          '--saifctl-features-dir',
          featuresDir,
          '--feature-id',
          'saifdocs-test',
        ]),
      );
      expect(exitCtx.exitCodes).toHaveLength(0);
      const featureYml = await readFile(join(featuresDir, 'saifdocs-test', 'feature.yml'), 'utf8');
      expect(featureYml).toMatch(/id: audit, rounds: 1/);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe('CLI audit', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('exits 1 when outputs are missing', async () => {
    const out = await mkdtemp(join(tmpdir(), 'saifdocs-audit-'));
    try {
      await mkdir(out, { recursive: true });
      await expect(
        auditCommand.run!(
          ctxArgv(auditCommand, [
            '--docspec-dir',
            minimalDocspec,
            '--output-dir',
            out,
            '--no-write-report',
          ]),
        ),
      ).rejects.toMatchObject({ exitCode: 1 });
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('exits 0 when runAudit reports no gaps', async () => {
    const spy = vi.spyOn(auditModule, 'runAudit').mockResolvedValue({
      findings: [],
      checkedCount: 7,
    });
    const out = join(tmpdir(), `saifdocs-audit-ok-${process.pid}`);
    try {
      await expect(
        auditCommand.run!(
          ctxArgv(auditCommand, [
            '--docspec-dir',
            minimalDocspec,
            '--output-dir',
            out,
            '--no-write-report',
          ]),
        ),
      ).rejects.toMatchObject({ exitCode: 0 });
      expect(exitCtx.exitCodes).toEqual([0]);
    } finally {
      spy.mockRestore();
    }
  });

  it('writes audit.md when gaps exist and --write-report is default', async () => {
    const out = await mkdtemp(join(tmpdir(), 'saifdocs-audit-md-'));
    try {
      await mkdir(out, { recursive: true });
      await expect(
        auditCommand.run!(
          ctxArgv(auditCommand, ['--docspec-dir', minimalDocspec, '--output-dir', out]),
        ),
      ).rejects.toMatchObject({ exitCode: 1 });
      const report = await readFile(join(out, 'audit.md'), 'utf8');
      expect(report).toContain('gap(s) found');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe('CLI update', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
    hoistedMocks.runUpdateCore.mockClear();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('exits 1 on invalid --types', async () => {
    await expect(
      updateCommand.run!(ctxArgv(updateCommand, ['--types', 'bad-type'])),
    ).rejects.toMatchObject({ exitCode: 1 });
    expect(hoistedMocks.runUpdateCore).not.toHaveBeenCalled();
  });

  it('maps runUpdateCore results to exit codes', async () => {
    const cases: { ret: UpdateCoreResult; code: number }[] = [
      { ret: { code: 0, kind: 'missing-manifest-skipped' }, code: 0 },
      { ret: { code: 2, kind: 'missing-manifest-error' }, code: 2 },
      { ret: { code: 2, kind: 'read-manifest-failed', message: 'x' }, code: 2 },
      { ret: { code: 0, kind: 'nothing-to-update' }, code: 0 },
      {
        ret: {
          code: 0,
          kind: 'dry-run',
          stale: [{ id: 'a', output: 'o', staleSince: 't', staleInputs: ['i'] }],
        },
        code: 0,
      },
      { ret: { code: 1, kind: 'compile-failed', message: 'boom' }, code: 1 },
      {
        ret: {
          code: 0,
          kind: 'success',
          result: {
            featureId: 'saifdocs-test',
            featureDir: '/tmp/x/saifdocs-test',
            featureDirRel: 'saifctl/features/saifdocs-test',
            phases: [],
            byType: {},
          },
        },
        code: 0,
      },
      { ret: { code: 1, kind: 'entry-not-found', selector: 'x' }, code: 1 },
      {
        ret: { code: 1, kind: 'entry-ambiguous', selector: 'y', candidates: ['a', 'b'] },
        code: 1,
      },
      {
        ret: {
          code: 1,
          kind: 'entry-excluded-by-types',
          entryId: 'c1',
          entryType: 'concepts',
          types: ['references'],
        },
        code: 1,
      },
    ];

    for (const { ret, code } of cases) {
      exitCtx.exitCodes.length = 0;
      hoistedMocks.runUpdateCore.mockResolvedValueOnce(ret);
      await expect(updateCommand.run!(ctxArgv(updateCommand, []))).rejects.toMatchObject({
        exitCode: code,
      });
      expect(exitCtx.exitCodes).toEqual([code]);
    }
  });
});

describe('CLI review', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
    hoistedMocks.runReview.mockClear();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('exits 1 when product, persona, or task missing', async () => {
    await expect(
      reviewCommand.run!(
        ctxArgv(reviewCommand, ['--product', 'p', '--persona', '', '--task', 't']),
      ),
    ).rejects.toMatchObject({ exitCode: 1 });
    expect(hoistedMocks.runReview).not.toHaveBeenCalled();
  });

  it('exits 0 on dry-run success', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      productId: 'p1',
      personaId: 'u1',
      taskId: 't1',
      success: true,
      message: 'dry-run',
      reportPath: '/tmp/report.md',
    });

    await expect(
      reviewCommand.run!(
        ctxArgv(reviewCommand, [
          '--product',
          'p1',
          '--persona',
          'u1',
          '--task',
          't1',
          '--docspec-dir',
          minimalDocspec,
          '--dry-run',
        ]),
      ),
    ).rejects.toMatchObject({ exitCode: 0 });

    expect(hoistedMocks.runReview).toHaveBeenCalled();
    const settings = hoistedMocks.runReview.mock.calls[0]![2];
    expect(settings.dryRun).toBe(true);
  });

  it('exits 1 when runReview returns failure', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      productId: 'p1',
      personaId: 'u1',
      taskId: 't1',
      success: false,
      message: 'compile-go-boom',
      reportPath: '/tmp/r.md',
    });

    await expect(
      reviewCommand.run!(
        ctxArgv(reviewCommand, [
          '--product',
          'p1',
          '--persona',
          'u1',
          '--task',
          't1',
          '--docspec-dir',
          minimalDocspec,
        ]),
      ),
    ).rejects.toMatchObject({ exitCode: 1 });

    expect(exitCtx.exitCodes).toEqual([1]);
  });

  it('exits 0 and logs the emitted feature when runReview succeeds (non dry-run)', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      productId: 'p1',
      personaId: 'u1',
      taskId: 't1',
      success: true,
      reportPath: '/abs/path/to/report.md',
      feature: {
        featureId: 'saifdocs-review-test',
        featureDir: '/saifctl/features/saifdocs-review-test',
        featureDirRel: 'saifctl/features/saifdocs-review-test',
        phaseId: '1-review-p1-u1-t1',
        phaseDir: '/saifctl/features/saifdocs-review-test/phases/1-review-p1-u1-t1',
      },
    });
    const successSpy = vi.spyOn(consola, 'success').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(consola, 'info').mockImplementation(() => undefined);

    await expect(
      reviewCommand.run!(
        ctxArgv(reviewCommand, [
          '--product',
          'p1',
          '--persona',
          'u1',
          '--task',
          't1',
          '--docspec-dir',
          minimalDocspec,
        ]),
      ),
    ).rejects.toMatchObject({ exitCode: 0 });

    expect(exitCtx.exitCodes).toEqual([0]);
    // Logs the emitted feature id (success channel) and the report path (info channel).
    expect(successSpy.mock.calls.some((c) => String(c[0]).includes('saifdocs-review-test'))).toBe(
      true,
    );
    expect(infoSpy.mock.calls.some((c) => String(c[0]).includes('/abs/path/to/report.md'))).toBe(
      true,
    );
    successSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
