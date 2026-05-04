import type { AuditResult } from './audit.js';

const SECTION: Record<string, string> = {
  'missing-reference': 'Missing references',
  'missing-concept': 'Missing concepts',
  'missing-how-to': "Missing how-to's",
  'missing-tutorial': 'Missing tutorials',
  'missing-landing': 'Missing product landing pages',
  'missing-prereq-concept': 'Missing prerequisite concepts (from tasks)',
  'unknown-prereq-concept': 'Unknown prerequisite concepts (docspec error)',
};

/** Render audit result as markdown for `docs/audit.md` or stdout. */
export function renderAuditReport(result: AuditResult, generatedAtIso: string): string {
  const lines: string[] = [
    '# Documentation gaps audit',
    '',
    `Generated: ${generatedAtIso}`,
    '',
    '## Summary',
    '',
  ];

  if (result.findings.length === 0) {
    lines.push(`No gaps found (${result.checkedCount} check(s)).`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`${result.findings.length} gap(s) found across ${result.checkedCount} check(s).`);
  lines.push('');

  const byType = new Map<string, typeof result.findings>();
  for (const f of result.findings) {
    const list = byType.get(f.type) ?? [];
    list.push(f);
    byType.set(f.type, list);
  }

  for (const [type, items] of [...byType.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${SECTION[type] ?? type}`);
    lines.push('');
    for (const f of items) {
      lines.push(`- **${f.id}**`);
      lines.push(`  - Expected: \`${f.expectedOutput}\``);
      lines.push(`  - Declared in: \`${f.declaredIn}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
