import { cp, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
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

describe('CLI clear', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('removes output directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-'));
    const out = join(base, 'docs');
    await mkdir(join(out, 'nested'), { recursive: true });
    await writeFile(join(out, 'nested', 'a.md'), 'x', 'utf8');

    await clearCommand.run!(ctxArgv(clearCommand, ['--output-dir', out]));

    await expect(readFile(join(out, 'nested', 'a.md'), 'utf8')).rejects.toThrow();
    expect(exitCtx.exitCodes).toHaveLength(0);
  });

  it('clears default docs/ when --output-dir is omitted (cwd-relative)', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-clear-default-'));
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(base);
    try {
      const docs = join(base, 'docs');
      await mkdir(join(docs, 'nested'), { recursive: true });
      await writeFile(join(docs, 'nested', 'a.md'), 'x', 'utf8');

      await clearCommand.run!(ctxArgv(clearCommand, []));

      await expect(readFile(join(docs, 'nested', 'a.md'), 'utf8')).rejects.toThrow();
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

  it('exits 0 when manifest valid and entries skipped', async () => {
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
            taskId: null,
            conceptId: null,
            tutorialPosition: null,
            tutorialThreadLength: null,
            generatedAt: null,
          },
        ],
      };
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, '.manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await expect(
        validateCommand.run!(ctxArgv(validateCommand, ['--docspec-dir', dir, '--json'])),
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
            taskId: null,
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
            taskId: null,
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

  it('exits 1 on invalid --gate-retries', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      await expect(
        genCommand.run!(
          ctxArgv(genCommand, [
            '--docspec-dir',
            docs,
            '--output-dir',
            join(base, 'out'),
            '--project-dir',
            minimalProject,
            '--gate-retries',
            '0',
            '--dry-run',
          ]),
        ),
      ).rejects.toMatchObject({ exitCode: 1 });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('dry-run completes without non-zero process.exit', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen2-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(base, 'out'),
          '--project-dir',
          minimalProject,
          '--dry-run',
        ]),
      );
      expect(exitCtx.exitCodes).toHaveLength(0);
      const manifestRaw = await readFile(join(docs, '.manifest.json'), 'utf8');
      expect(JSON.parse(manifestRaw).entries.length).toBeGreaterThan(0);
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
      { ret: { code: 1, kind: 'invalid-gate-retries', raw: 'x' }, code: 1 },
      {
        ret: {
          code: 1,
          kind: 'generate-failed',
          summary: {
            attempted: 1,
            succeeded: 0,
            failed: 1,
            skipped: 0,
            failures: [],
          },
        },
        code: 1,
      },
      {
        ret: {
          code: 0,
          kind: 'success',
          summary: {
            attempted: 1,
            succeeded: 1,
            failed: 0,
            skipped: 0,
            failures: [],
          },
        },
        code: 0,
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

  it('exits 1 on invalid --gate-retries', async () => {
    await expect(
      reviewCommand.run!(
        ctxArgv(reviewCommand, [
          '--product',
          'p1',
          '--persona',
          'u1',
          '--task',
          't1',
          '--gate-retries',
          'nope',
        ]),
      ),
    ).rejects.toMatchObject({ exitCode: 1 });
    expect(hoistedMocks.runReview).not.toHaveBeenCalled();
  });

  it('exits 0 on dry-run success', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      success: true,
      message: 'dry-run',
      reportPath: '',
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

    expect(exitCtx.exitCodes).toEqual([0]);
  });

  it('uses strict cedar path when --strict-network', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      success: true,
      message: 'dry-run',
      reportPath: '',
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
          '--strict-network',
        ]),
      ),
    ).rejects.toMatchObject({ exitCode: 0 });

    expect(hoistedMocks.runReview).toHaveBeenCalled();
    const settings = hoistedMocks.runReview.mock.calls[0]![2];
    expect(settings.cedarPolicyPath).toMatch(/review-strict\.cedar$/);
  });

  it('exits 1 when runReview returns failure', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      success: false,
      message: 'saifctl sandbox exited non-zero',
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

  it('exits 0 and logs report path when runReview succeeds (non dry-run)', async () => {
    hoistedMocks.runReview.mockResolvedValueOnce({
      success: true,
      reportPath: '/abs/path/to/report.md',
    });
    const successSpy = vi.spyOn(consola, 'success').mockImplementation(() => undefined);

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
    expect(successSpy.mock.calls.some((c) => String(c[0]).includes('/abs/path/to/report.md'))).toBe(
      true,
    );
    successSpy.mockRestore();
  });
});
