/**
 * Tests for `compileManifestToFeatureTree` (`compiler.ts`).
 *
 * The compiler is a pure file-emitter: given an in-memory manifest and a
 * temp output dir, it should produce a complete saifctl feature tree. We
 * assert:
 *  - directory shape (feature.yml, plan.md, critics/audit.md, phases/...)
 *  - phase ordering follows GEN_PHASES (refs → concepts → how-tos → ...)
 *  - phase-number width matches the total phase count (zero-padded)
 *  - feature id resolution (timestamp default vs explicit override)
 *  - selection filters (types + onlyEntryIds)
 */
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import type { ManifestDocument, ManifestEntry, OutputType } from '../manifest/types.js';
import {
  compileManifestToFeatureTree,
  padPhaseIndex,
  selectAndOrderEntries,
  slugForEntry,
} from './compiler.js';

let tmpRoot: string;
let projectDir: string;
let saifctlFeaturesDir: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'saifdocs-compiler-'));
  projectDir = join(tmpRoot, 'project');
  saifctlFeaturesDir = join(projectDir, 'saifctl', 'features');
  await mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

function makeEntry(
  overrides: Partial<ManifestEntry> & Pick<ManifestEntry, 'id' | 'type'>,
): ManifestEntry {
  return {
    output: join(projectDir, 'docs', 'page.md'),
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
    ...overrides,
  };
}

function makeManifest(entries: ManifestEntry[]): ManifestDocument {
  return {
    version: MANIFEST_VERSION,
    createdAt: '2026-05-04T10:30:45.123Z',
    docspecDir: join(projectDir, 'docspec'),
    outputDir: join(projectDir, 'docs'),
    projectDir,
    entries,
  };
}

describe('selectAndOrderEntries', () => {
  it('orders entries: references → concepts → how-tos → tutorials → landing-pages', () => {
    const manifest = makeManifest([
      makeEntry({ id: 'lp-overview', type: 'landing-pages' }),
      makeEntry({ id: 'tut-getting-started', type: 'tutorials' }),
      makeEntry({ id: 'how-deploy', type: 'how-tos' }),
      makeEntry({ id: 'con-auth', type: 'concepts' }),
      makeEntry({ id: 'ref-cli', type: 'references' }),
    ]);
    const out = selectAndOrderEntries(manifest, { types: 'all' });
    expect(out.map((s) => s.entry.id)).toEqual([
      'ref-cli',
      'con-auth',
      'how-deploy',
      'tut-getting-started',
      'lp-overview',
    ]);
  });

  it('honors the types filter', () => {
    const manifest = makeManifest([
      makeEntry({ id: 'ref-1', type: 'references' }),
      makeEntry({ id: 'con-1', type: 'concepts' }),
      makeEntry({ id: 'how-1', type: 'how-tos' }),
    ]);
    const out = selectAndOrderEntries(manifest, { types: ['references', 'concepts'] });
    expect(out.map((s) => s.entry.id)).toEqual(['ref-1', 'con-1']);
  });

  it('honors the onlyEntryIds filter', () => {
    const manifest = makeManifest([
      makeEntry({ id: 'ref-1', type: 'references' }),
      makeEntry({ id: 'ref-2', type: 'references' }),
      makeEntry({ id: 'ref-3', type: 'references' }),
    ]);
    const out = selectAndOrderEntries(manifest, {
      types: 'all',
      onlyEntryIds: new Set(['ref-2']),
    });
    expect(out.map((s) => s.entry.id)).toEqual(['ref-2']);
  });
});

describe('padPhaseIndex', () => {
  it('width = digits of total: 50 pages → 01..50', () => {
    expect(padPhaseIndex(1, 50)).toBe('01');
    expect(padPhaseIndex(50, 50)).toBe('50');
  });

  it('width = digits of total: 1023 pages → 0001..1023', () => {
    expect(padPhaseIndex(1, 1023)).toBe('0001');
    expect(padPhaseIndex(42, 1023)).toBe('0042');
    expect(padPhaseIndex(1023, 1023)).toBe('1023');
  });

  it('handles 1 page → just "1"', () => {
    expect(padPhaseIndex(1, 1)).toBe('1');
  });

  it('handles 9 pages → 1..9 (no padding needed)', () => {
    expect(padPhaseIndex(1, 9)).toBe('1');
    expect(padPhaseIndex(9, 9)).toBe('9');
  });
});

describe('slugForEntry', () => {
  it('prefixes by type and strips redundant type-marker prefixes from the id', () => {
    expect(slugForEntry(makeEntry({ id: 'concept--saifdocs--docspec', type: 'concepts' }))).toBe(
      'con-saifdocs-docspec',
    );
    expect(slugForEntry(makeEntry({ id: 'reference--cli--flags', type: 'references' }))).toBe(
      'ref-cli-flags',
    );
  });

  it('kebab-normalizes weird characters', () => {
    expect(slugForEntry(makeEntry({ id: 'Foo Bar Baz!', type: 'concepts' }))).toBe(
      'con-foo-bar-baz',
    );
  });

  it('falls back to "unknown" if normalization empties the id', () => {
    expect(slugForEntry(makeEntry({ id: '!!!', type: 'concepts' }))).toBe('con-unknown');
  });
});

describe('compileManifestToFeatureTree', () => {
  function entryWithOutput(id: string, type: OutputType, outputRel: string): ManifestEntry {
    return makeEntry({ id, type, output: join(projectDir, outputRel) });
  }

  it('emits the expected directory shape with feature.yml, plan.md, critics/audit.md', async () => {
    const manifest = makeManifest([
      entryWithOutput('reference--cli', 'references', 'docs/references/cli.md'),
    ]);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-test',
    });

    expect(result.featureId).toBe('saifdocs-test');
    expect(result.featureDir).toBe(join(saifctlFeaturesDir, 'saifdocs-test'));
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]!.phaseId).toBe('1-ref-cli');

    // Files emitted at the feature root
    await expect(stat(join(result.featureDir, 'feature.yml'))).resolves.toBeDefined();
    await expect(stat(join(result.featureDir, 'plan.md'))).resolves.toBeDefined();
    await expect(stat(join(result.featureDir, 'critics', 'audit.md'))).resolves.toBeDefined();

    // Phase dir + spec.md + tests/public/output.spec.ts
    const phaseDir = result.phases[0]!.phaseDir;
    await expect(stat(join(phaseDir, 'spec.md'))).resolves.toBeDefined();
    const spec = await stat(join(phaseDir, 'tests', 'public', 'output.spec.ts'));
    expect(spec.isFile()).toBe(true);
  });

  it('uses a timestamped feature id by default', async () => {
    const manifest = makeManifest([entryWithOutput('ref', 'references', 'docs/x.md')]);
    const fixedNow = new Date('2026-05-04T10:30:45.123Z');
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      now: fixedNow,
    });
    expect(result.featureId).toBe('saifdocs-2026-05-04T10-30-45-123Z');
  });

  it('rejects an invalid override featureId before writing anything', async () => {
    const manifest = makeManifest([entryWithOutput('ref', 'references', 'docs/x.md')]);
    await expect(
      compileManifestToFeatureTree({
        manifest,
        saifctlFeaturesDir,
        projectDir,
        types: 'all',
        featureId: 'NOT VALID',
      }),
    ).rejects.toThrow(/Invalid feature id/);
    // Output dir should not have been created (fail before mkdir).
    await expect(stat(saifctlFeaturesDir)).rejects.toThrow();
  });

  it('zero-pads phase indices to the width of the total phase count', async () => {
    // 12 entries → width 2 → 01..12
    const entries = Array.from({ length: 12 }, (_, i) =>
      entryWithOutput(`reference-${i}`, 'references', `docs/r-${i}.md`),
    );
    const manifest = makeManifest(entries);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-12',
    });
    const phaseIds = result.phases.map((p) => p.phaseId);
    expect(phaseIds[0]).toMatch(/^01-/);
    expect(phaseIds[11]).toMatch(/^12-/);
    // Lex-sorted order of phase dirs on disk should match emitted order.
    const onDisk = (await readdir(join(result.featureDir, 'phases'))).sort();
    expect(onDisk).toEqual(phaseIds);
  });

  it('zero-pads phase indices for very large counts (1023 → 0001..1023)', async () => {
    // We don't actually emit 1023 dirs (test cost); just verify the pad function
    // is wired. We use a 100-entry case for a real on-disk check.
    const entries = Array.from({ length: 100 }, (_, i) =>
      entryWithOutput(`reference-${i}`, 'references', `docs/r-${i}.md`),
    );
    const manifest = makeManifest(entries);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-100',
    });
    expect(result.phases[0]!.phaseId).toMatch(/^001-/);
    expect(result.phases[99]!.phaseId).toMatch(/^100-/);
  });

  it('orders phases: references → concepts → how-tos → tutorials → landing-pages', async () => {
    const manifest = makeManifest([
      entryWithOutput('lp-1', 'landing-pages', 'docs/lp.md'),
      entryWithOutput('tut-1', 'tutorials', 'docs/tut.md'),
      entryWithOutput('con-1', 'concepts', 'docs/con.md'),
      entryWithOutput('ref-1', 'references', 'docs/ref.md'),
      entryWithOutput('how-1', 'how-tos', 'docs/how.md'),
    ]);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-mixed',
    });
    const phasePrefixes = result.phases.map((p) => p.phaseId.split('-')[1]);
    expect(phasePrefixes).toEqual(['ref', 'con', 'how', 'tut', 'lp']);
  });

  it('byType counts match the emitted phases', async () => {
    const manifest = makeManifest([
      entryWithOutput('ref-1', 'references', 'docs/r1.md'),
      entryWithOutput('ref-2', 'references', 'docs/r2.md'),
      entryWithOutput('con-1', 'concepts', 'docs/c1.md'),
      entryWithOutput('how-1', 'how-tos', 'docs/h1.md'),
    ]);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-counts',
    });
    expect(result.byType).toEqual({ references: 2, concepts: 1, 'how-tos': 1 });
  });

  it('honors the types filter and only emits phases for selected types', async () => {
    const manifest = makeManifest([
      entryWithOutput('ref-1', 'references', 'docs/r.md'),
      entryWithOutput('con-1', 'concepts', 'docs/c.md'),
      entryWithOutput('how-1', 'how-tos', 'docs/h.md'),
    ]);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: ['references'],
      featureId: 'saifdocs-refs-only',
    });
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]!.entry.id).toBe('ref-1');
  });

  it('disambiguates phase slug collisions deterministically', async () => {
    // Two entries that normalize to the same slug → second gets `-2`.
    const manifest = makeManifest([
      entryWithOutput('Foo Bar', 'references', 'docs/a.md'),
      entryWithOutput('foo-bar', 'references', 'docs/b.md'),
    ]);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-dup',
    });
    const phaseIds = result.phases.map((p) => p.phaseId);
    expect(phaseIds[0]).toBe('1-ref-foo-bar');
    expect(phaseIds[1]).toBe('2-ref-foo-bar-2');
  });

  it('feature.yml declares the audit critic; output.spec.ts references the doc output path', async () => {
    const manifest = makeManifest([
      entryWithOutput('ref-1', 'references', 'docs/references/cli.md'),
    ]);
    const result = await compileManifestToFeatureTree({
      manifest,
      saifctlFeaturesDir,
      projectDir,
      types: 'all',
      featureId: 'saifdocs-content-check',
    });
    const featureYml = await readFile(join(result.featureDir, 'feature.yml'), 'utf8');
    expect(featureYml).toMatch(/id: audit, rounds: 1/);

    const spec = await readFile(
      join(result.phases[0]!.phaseDir, 'tests', 'public', 'output.spec.ts'),
      'utf8',
    );
    expect(spec).toContain(`const OUTPUT = '/workspace/docs/references/cli.md';`);
    expect(spec).toContain(`import { describe, expect, it } from 'vitest';`);
  });
});
