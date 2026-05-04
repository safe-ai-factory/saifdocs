import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs } from 'citty';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MANIFEST_VERSION } from '../../constants.js';
import genCommand from './gen.js';

const hoisted = vi.hoisted(() => ({
  compileManifestToFeatureTree: vi.fn(),
}));

vi.mock('../../features/compiler.js', () => ({
  compileManifestToFeatureTree: hoisted.compileManifestToFeatureTree,
}));

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const minimalDocspec = join(__dirname, '../../manifest/__fixtures__/minimal/docspec');
const minimalProject = join(__dirname, '../../manifest/__fixtures__/minimal/project');

type CittyRunContext<Cmd extends { run?: (ctx: never) => unknown }> = Cmd extends {
  run?: (ctx: infer Ctx) => unknown;
}
  ? Ctx
  : never;

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
    const err = new Error(`process.exit(${c})`);
    (err as Error & { exitCode: number }).exitCode = c;
    throw err;
  }) as typeof process.exit);
  return { spy, exitCodes };
}

describe('CLI gen export manifest', () => {
  let exitCtx: ReturnType<typeof installExitMock>;

  beforeEach(() => {
    exitCtx = installExitMock();
    hoisted.compileManifestToFeatureTree.mockReset();
    // Default: compiler succeeds with an empty result (we're testing the export path).
    hoisted.compileManifestToFeatureTree.mockResolvedValue({
      featureId: 'saifdocs-test',
      featureDir: '/tmp/saifdocs-test',
      featureDirRel: 'saifctl/features/saifdocs-test',
      phases: [],
      byType: {},
    });
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('writes manifest JSON to stdout with --export-manifest', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen-export-stdout-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(base, 'out'),
          '--project-dir',
          minimalProject,
          '--saifctl-features-dir',
          join(base, 'saifctl', 'features'),
          '--export-manifest',
        ]),
      );

      expect(exitCtx.exitCodes).toHaveLength(0);
      const written = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(JSON.parse(written).version).toBe(MANIFEST_VERSION);
      expect(Array.isArray(JSON.parse(written).entries)).toBe(true);
      stdoutSpy.mockRestore();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('writes manifest JSON to a file with --export-manifest-out', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen-export-file-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      const exportPath = join(base, 'exported-manifest.json');

      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(base, 'out'),
          '--project-dir',
          minimalProject,
          '--saifctl-features-dir',
          join(base, 'saifctl', 'features'),
          '--export-manifest-out',
          exportPath,
        ]),
      );

      expect(exitCtx.exitCodes).toHaveLength(0);
      const raw = await readFile(exportPath, 'utf8');
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(MANIFEST_VERSION);
      expect(Array.isArray(parsed.entries)).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('exits 1 when the compiler throws', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen-export-err-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });
      hoisted.compileManifestToFeatureTree.mockRejectedValueOnce(new Error('boom'));

      await expect(
        genCommand.run!(
          ctxArgv(genCommand, [
            '--docspec-dir',
            docs,
            '--output-dir',
            join(base, 'out'),
            '--project-dir',
            minimalProject,
            '--saifctl-features-dir',
            join(base, 'saifctl', 'features'),
          ]),
        ),
      ).rejects.toMatchObject({ exitCode: 1 });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
