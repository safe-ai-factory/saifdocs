import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readDocspec } from '../docspec/reader.js';
import { runReview } from './review.js';

const fixtureDir = fileURLToPath(
  new URL('../manifest/__fixtures__/minimal/docspec', import.meta.url),
);
const fixtureProject = fileURLToPath(
  new URL('../manifest/__fixtures__/minimal/project', import.meta.url),
);

describe('runReview', () => {
  let tmpRoot: string;
  let projectDir: string;
  let outputDir: string;
  let saifctlFeaturesDir: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'saifdocs-review-'));
    projectDir = join(tmpRoot, 'project');
    outputDir = join(projectDir, 'docs');
    saifctlFeaturesDir = join(projectDir, 'saifctl', 'features');
    await mkdir(projectDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('dry-run succeeds without emitting any feature dir', async () => {
    const parsed = await readDocspec(fixtureDir);
    const product = parsed.products[0]!;
    const persona = product.personas[0]!;
    const task = persona.tasks[0]!;

    const r = await runReview(
      parsed,
      { productId: product.id, personaId: persona.id, taskId: task.id },
      {
        docspecDir: fixtureDir,
        outputDir,
        projectDir,
        saifctlFeaturesDir,
        dryRun: true,
      },
    );
    expect(r.success).toBe(true);
    expect(r.message).toBe('dry-run');
    // No feature dir written.
    await expect(readFile(saifctlFeaturesDir).catch(() => null)).resolves.toBeNull();
  });

  it('returns failure when report path is outside project-dir', async () => {
    const parsed = await readDocspec(fixtureDir);
    const product = parsed.products[0]!;
    const persona = product.personas[0]!;
    const task = persona.tasks[0]!;

    // outputDir outside projectDir → reportAbs outside projectDir → outputPathRelativeToProject throws.
    const r = await runReview(
      parsed,
      { productId: product.id, personaId: persona.id, taskId: task.id },
      {
        docspecDir: fixtureDir,
        outputDir: join(tmpRoot, 'somewhere-else'),
        projectDir,
        saifctlFeaturesDir,
      },
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/inside project-dir/);
  });

  it('emits a feature dir on a real run; gate script references the report path', async () => {
    // Need a project layout where outputDir is inside projectDir for outputPathRelativeToProject to succeed.
    // Use the actual fixtureProject as projectDir (its `outputDir` lives at <projectDir>/docs).
    const parsed = await readDocspec(fixtureDir);
    const product = parsed.products[0]!;
    const persona = product.personas[0]!;
    const task = persona.tasks[0]!;

    const r = await runReview(
      parsed,
      { productId: product.id, personaId: persona.id, taskId: task.id },
      {
        docspecDir: fixtureDir,
        outputDir: join(fixtureProject, 'docs'),
        projectDir: fixtureProject,
        saifctlFeaturesDir,
        featureId: 'saifdocs-review-test',
      },
    );

    expect(r.success).toBe(true);
    expect(r.feature).toBeDefined();
    expect(r.feature!.featureId).toBe('saifdocs-review-test');

    // Feature.yml should declare empty critics (review IS the deliverable).
    const featureYml = await readFile(join(r.feature!.featureDir, 'feature.yml'), 'utf8');
    expect(featureYml).toMatch(/critics:\s*\[\]/);

    // The phase has spec.md (the review prompt) and tests/gate.sh.
    const specMd = await readFile(join(r.feature!.phaseDir, 'spec.md'), 'utf8');
    expect(specMd.length).toBeGreaterThan(0);
    const gate = await readFile(join(r.feature!.phaseDir, 'tests', 'gate.sh'), 'utf8');
    expect(gate).toContain('OUTPUT_PATH=');
    expect(gate).toMatch(/review\//);
  });

  it('rejects unknown product/persona/task with a DocspecError', async () => {
    const parsed = await readDocspec(fixtureDir);
    await expect(
      runReview(
        parsed,
        { productId: 'no-such', personaId: 'p', taskId: 't' },
        {
          docspecDir: fixtureDir,
          outputDir,
          projectDir,
          saifctlFeaturesDir,
        },
      ),
    ).rejects.toThrow(/Unknown product/);
  });
});
