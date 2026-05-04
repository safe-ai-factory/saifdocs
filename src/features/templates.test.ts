import { describe, expect, it } from 'vitest';

import {
  renderAuditCriticMd,
  renderFeatureYml,
  renderGateScript,
  renderPlanMd,
} from './templates.js';

describe('renderFeatureYml', () => {
  it('declares the audit critic with rounds: 1 by default', () => {
    const yml = renderFeatureYml();
    expect(yml).toMatch(/critics:[\s\S]*\{ id: audit, rounds: 1 \}/);
  });

  it('locks tests as immutable by default', () => {
    expect(renderFeatureYml()).toMatch(/tests:\s+mutable: false/);
  });
});

describe('renderPlanMd', () => {
  const baseOpts = {
    featureId: 'saifdocs-2026-05-04T10-30-45-123Z',
    generatedAt: new Date('2026-05-04T10:30:45.123Z'),
    saifdocsVersion: '0.0.1',
    totalPhases: 7,
    byType: { references: 2, concepts: 1, 'how-tos': 3, tutorials: 1 } as const,
  };

  it('includes the feature id and generation timestamp', () => {
    const md = renderPlanMd(baseOpts);
    expect(md).toContain('saifdocs-2026-05-04T10-30-45-123Z');
    expect(md).toContain('2026-05-04T10:30:45.123Z');
  });

  it('lists the per-type phase breakdown', () => {
    const md = renderPlanMd(baseOpts);
    expect(md).toContain('- 2 references');
    expect(md).toContain('- 1 concepts');
    expect(md).toContain('- 3 how-tos');
    expect(md).toContain('- 1 tutorials');
  });

  it('omits zero-count types from the breakdown', () => {
    const md = renderPlanMd(baseOpts);
    expect(md).not.toContain('landing-pages');
  });

  it('shows the saifctl invocation command', () => {
    const md = renderPlanMd(baseOpts);
    expect(md).toContain(`saifctl feat run --feature ${baseOpts.featureId}`);
  });

  it('includes the saifdocs version', () => {
    const md = renderPlanMd(baseOpts);
    expect(md).toContain('saifdocs** v0.0.1');
  });
});

describe('renderAuditCriticMd', () => {
  it('uses saifctl mustache vocabulary', () => {
    const md = renderAuditCriticMd();
    expect(md).toContain('{{critic.id}}');
    expect(md).toContain('{{critic.round}}');
    expect(md).toContain('{{critic.totalRounds}}');
    expect(md).toContain('{{critic.step}}');
    expect(md).toContain('{{critic.findingsPath}}');
    expect(md).toContain('{{phase.id}}');
    expect(md).toContain('{{phase.spec}}');
    expect(md).toContain('{{phase.baseRef}}');
    expect(md).toContain('{{feature.name}}');
  });

  it('explicitly tells the critic NOT to modify code in the discover step', () => {
    expect(renderAuditCriticMd()).toMatch(/Do NOT modify (?:code|docs)/);
  });

  it('mentions the documentation-specific concerns (omissions, false claims, diátaxis)', () => {
    const md = renderAuditCriticMd();
    expect(md.toLowerCase()).toContain('omission');
    expect(md.toLowerCase()).toContain('false claim');
    expect(md.toLowerCase()).toContain('diátaxis');
  });

  it('specifies the findings file format and the no-findings sentinel', () => {
    const md = renderAuditCriticMd();
    expect(md).toMatch(/markdown checklist/);
    expect(md.toLowerCase()).toContain('no findings');
  });
});

describe('renderGateScript', () => {
  it('starts with the bash shebang and strict mode', () => {
    const script = renderGateScript('docs/references/cli.md');
    expect(script.split('\n')[0]).toBe('#!/usr/bin/env bash');
    expect(script).toContain('set -euo pipefail');
  });

  it('embeds the output path in single quotes', () => {
    const script = renderGateScript('docs/references/cli.md');
    expect(script).toContain(`OUTPUT_PATH='docs/references/cli.md'`);
  });

  it('escapes single quotes in the output path', () => {
    const script = renderGateScript("docs/foo's-page.md");
    // The script should contain the safe-quoted form, not the raw apostrophe.
    expect(script).toContain(`OUTPUT_PATH='docs/foo'\\''s-page.md'`);
  });

  it('checks for file existence, non-emptiness, and body content', () => {
    const script = renderGateScript('docs/x.md');
    expect(script).toContain('expected output not found');
    expect(script).toContain('output file is empty');
    expect(script).toContain('output has no body content');
  });
});
