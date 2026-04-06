import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs } from 'citty';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MANIFEST_VERSION } from '../../constants.js';
import type { ManifestDocument } from '../../manifest/types.js';
import genCommand from './gen.js';

const hoisted = vi.hoisted(() => ({
  generateEntries: vi.fn(),
}));

vi.mock('../../generation/generate.js', () => ({
  generateEntries: hoisted.generateEntries,
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
    hoisted.generateEntries.mockReset();
  });

  afterEach(() => {
    exitCtx.spy.mockRestore();
  });

  it('writes manifest JSON to stdout with --export-manifest', async () => {
    const base = await mkdtemp(join(tmpdir(), 'saifdocs-gen-export-stdout-'));
    try {
      const docs = join(base, 'docspec');
      await cp(minimalDocspec, docs, { recursive: true });

      const afterGen: ManifestDocument = {
        version: MANIFEST_VERSION,
        createdAt: '2024-01-01T00:00:00.000Z',
        docspecDir: docs,
        outputDir: join(base, 'out'),
        projectDir: minimalProject,
        entries: [],
      };

      hoisted.generateEntries.mockResolvedValue({
        summary: {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          failures: [],
        },
        manifest: afterGen,
      });

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(base, 'out'),
          '--project-dir',
          minimalProject,
          '--export-manifest',
        ]),
      );

      expect(exitCtx.exitCodes).toHaveLength(0);
      const written = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(JSON.parse(written).version).toBe(MANIFEST_VERSION);
      expect(JSON.parse(written).entries).toEqual([]);
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

      const afterGen: ManifestDocument = {
        version: MANIFEST_VERSION,
        createdAt: '2024-06-01T00:00:00.000Z',
        docspecDir: docs,
        outputDir: join(base, 'out'),
        projectDir: minimalProject,
        entries: [
          {
            id: 'x',
            type: 'references' as const,
            output: '/o',
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

      hoisted.generateEntries.mockResolvedValue({
        summary: {
          attempted: 1,
          succeeded: 1,
          failed: 0,
          skipped: 0,
          failures: [],
        },
        manifest: afterGen,
      });

      await genCommand.run!(
        ctxArgv(genCommand, [
          '--docspec-dir',
          docs,
          '--output-dir',
          join(base, 'out'),
          '--project-dir',
          minimalProject,
          '--export-manifest-out',
          exportPath,
        ]),
      );

      expect(exitCtx.exitCodes).toHaveLength(0);
      const raw = await readFile(exportPath, 'utf8');
      expect(JSON.parse(raw).entries[0]?.id).toBe('x');
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
