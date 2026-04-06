import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { getDefaultReviewCedarPath, getDefaultReviewStrictCedarPath } from '../constants.js';
import { readDocspec } from '../docspec/reader.js';
import { runReview } from './review.js';

const fixtureDir = fileURLToPath(
  new URL('../manifest/__fixtures__/minimal/docspec', import.meta.url),
);

describe('runReview', () => {
  it('dry-run succeeds without invoking sandbox', async () => {
    const parsed = await readDocspec(fixtureDir);
    const r = await runReview(
      parsed,
      { productId: 'p1', personaId: 'u1', taskId: 't1' },
      {
        docspecDir: fixtureDir,
        outputDir: '/tmp/proj/docs',
        projectDir: '/tmp/proj',
        dryRun: true,
      },
    );
    expect(r.success).toBe(true);
    expect(r.message).toBe('dry-run');
    expect(r.reportPath).toMatch(/review[/\\]p1[/\\]u1[/\\]t1-/);
  });

  it('returns failure when report path is outside project-dir', async () => {
    const parsed = await readDocspec(fixtureDir);
    const r = await runReview(
      parsed,
      { productId: 'p1', personaId: 'u1', taskId: 't1' },
      {
        docspecDir: fixtureDir,
        outputDir: '/outside/docs',
        projectDir: '/tmp/proj',
        dryRun: false,
      },
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/inside project-dir/);
  });

  it('returns failure when sandbox exits non-zero', async () => {
    const parsed = await readDocspec(fixtureDir);
    const runSandbox = vi.fn().mockResolvedValue({ code: 1 });
    const projectDir = join(fixtureDir, '..', 'review-proj-nonzero');
    const outputDir = join(projectDir, 'docs');

    const r = await runReview(
      parsed,
      { productId: 'p1', personaId: 'u1', taskId: 't1' },
      {
        docspecDir: fixtureDir,
        outputDir,
        projectDir,
        gateRetries: 1,
      },
      { runSandbox },
    );

    expect(r.success).toBe(false);
    expect(r.message).toBe('saifctl sandbox exited non-zero');
    expect(runSandbox).toHaveBeenCalledTimes(1);
  });

  it('invokes sandbox with cedar policy path', async () => {
    const parsed = await readDocspec(fixtureDir);
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    const projectDir = join(fixtureDir, '..', 'review-proj');
    const outputDir = join(projectDir, 'docs');

    const r = await runReview(
      parsed,
      { productId: 'p1', personaId: 'u1', taskId: 't1' },
      {
        docspecDir: fixtureDir,
        outputDir,
        projectDir,
        gateRetries: 2,
        cedarPolicyPath: '/policies/custom.cedar',
      },
      { runSandbox },
    );

    expect(r.success).toBe(true);
    expect(runSandbox).toHaveBeenCalledTimes(1);
    const opts = runSandbox.mock.calls[0]![0];
    expect(opts.cedarPolicyPath).toBe('/policies/custom.cedar');
    expect(opts.extractInclude).toBe('docs/review');
    expect(opts.gateRetries).toBe(2);
  });

  it('invokes sandbox with packaged strict cedar when set', async () => {
    const parsed = await readDocspec(fixtureDir);
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    const projectDir = join(fixtureDir, '..', 'review-proj');
    const outputDir = join(projectDir, 'docs');
    const strictPath = getDefaultReviewStrictCedarPath();

    const r = await runReview(
      parsed,
      { productId: 'p1', personaId: 'u1', taskId: 't1' },
      {
        docspecDir: fixtureDir,
        outputDir,
        projectDir,
        gateRetries: 1,
        cedarPolicyPath: strictPath,
      },
      { runSandbox },
    );

    expect(r.success).toBe(true);
    const opts = runSandbox.mock.calls[0]![0];
    expect(opts.cedarPolicyPath).toBe(strictPath);
  });

  it('treats whitespace-only cedarPolicyPath as unset (uses packaged default)', async () => {
    const parsed = await readDocspec(fixtureDir);
    const runSandbox = vi.fn().mockResolvedValue({ code: 0 });
    const projectDir = join(fixtureDir, '..', 'review-proj-cedar-trim');
    const outputDir = join(projectDir, 'docs');
    const defaultCedar = getDefaultReviewCedarPath();

    const r = await runReview(
      parsed,
      { productId: 'p1', personaId: 'u1', taskId: 't1' },
      {
        docspecDir: fixtureDir,
        outputDir,
        projectDir,
        gateRetries: 1,
        cedarPolicyPath: '   \t  ',
      },
      { runSandbox },
    );

    expect(r.success).toBe(true);
    expect(runSandbox.mock.calls[0]![0].cedarPolicyPath).toBe(defaultCedar);
  });
});
