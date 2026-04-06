import { describe, expect, it } from 'vitest';

import { renderAuditReport } from './audit-report.js';

describe('renderAuditReport', () => {
  it('renders summary when no findings', () => {
    const md = renderAuditReport({ findings: [], checkedCount: 5 }, '2026-01-01T00:00:00.000Z');
    expect(md).toContain('No gaps found');
    expect(md).toContain('5 check(s)');
  });

  it('groups findings by type', () => {
    const md = renderAuditReport(
      {
        findings: [
          {
            type: 'missing-how-to',
            id: 'h1',
            expectedOutput: '/docs/how.md',
            declaredIn: '/docspec/products/p1/how-tos/h1.md',
          },
          {
            type: 'missing-reference',
            id: 'r1',
            expectedOutput: '/docs/ref.md',
            declaredIn: '/ref.md',
          },
        ],
        checkedCount: 2,
      },
      '2026-01-01T00:00:00.000Z',
    );
    expect(md).toContain('Missing how-tos');
    expect(md).toContain('Missing references');
    expect(md).toContain('h1');
  });
});
