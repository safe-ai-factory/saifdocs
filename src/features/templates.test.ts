import { describe, expect, it } from 'vitest';

import {
  renderAuditCriticMd,
  renderFeatureYml,
  renderOutputSpec,
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

describe('renderOutputSpec', () => {
  it('renders a vitest spec (imports describe/it/expect)', () => {
    const spec = renderOutputSpec('docs/references/cli.md');
    expect(spec).toContain(`import { describe, expect, it } from 'vitest';`);
  });

  it('embeds the output path under /workspace as the OUTPUT constant', () => {
    const spec = renderOutputSpec('docs/references/cli.md');
    expect(spec).toContain(`const OUTPUT = '/workspace/docs/references/cli.md';`);
  });

  it('escapes single quotes in the output path', () => {
    const spec = renderOutputSpec("docs/foo's-page.md");
    // The TS string literal must use \\' to neutralize the apostrophe.
    expect(spec).toContain(`/workspace/docs/foo\\'s-page.md`);
    // Round-trip: the emitted line must be syntactically valid (no unterminated string).
    expect(spec).toMatch(/const OUTPUT = '\/workspace\/docs\/foo\\'s-page\.md';/);
  });

  it('escapes backslashes in the output path', () => {
    // Implausible on Unix but we should not produce an escape-sequence trap.
    const spec = renderOutputSpec('docs\\weird.md');
    expect(spec).toContain('/workspace/docs\\\\weird.md');
  });

  it('reaches the staging container via the saifctl HTTP sidecar', () => {
    const spec = renderOutputSpec('docs/x.md');
    expect(spec).toContain('SAIFCTL_SIDECAR_URL');
    expect(spec).toContain(`/exec`);
  });

  it('asserts file existence, non-emptiness, and body content beyond frontmatter', () => {
    const spec = renderOutputSpec('docs/x.md');
    expect(spec).toContain('expected output not found');
    expect(spec).toContain('output file is empty');
    expect(spec).toContain('output has no body content');
  });

  it('uses test, test, and awk via the sidecar (matches gate.sh semantics)', () => {
    const spec = renderOutputSpec('docs/x.md');
    expect(spec).toMatch(/exec\('test', \['-f', OUTPUT\]\)/);
    expect(spec).toMatch(/exec\('test', \['-s', OUTPUT\]\)/);
    expect(spec).toMatch(/exec\('awk', \[FRONTMATTER_BODY_AWK, OUTPUT\]\)/);
  });
});
