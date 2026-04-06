import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { defineCommand } from 'citty';

import { runAudit } from '../../audit/audit.js';
import { renderAuditReport } from '../../audit/audit-report.js';
import { DocspecError } from '../../docspec/errors.js';
import { readDocspec } from '../../docspec/reader.js';
import { consola } from '../../logger.js';
import { docspecDirArg, outputDirArg } from '../args.js';

const auditCommand = defineCommand({
  meta: {
    name: 'audit',
    description:
      'Check that generated files exist for every declared reference, concept, how-to, tutorial, landing page, and task prereq concepts',
  },
  args: {
    'docspec-dir': docspecDirArg,
    'output-dir': outputDirArg,
    'write-report': {
      type: 'boolean' as const,
      description: 'Write audit.md under output-dir',
      default: true,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const docspecDir = resolve(cwd, args['docspec-dir'] ?? 'docspec');
    const outputDir = resolve(cwd, args['output-dir'] ?? 'docs');

    let parsed;
    try {
      parsed = await readDocspec(docspecDir);
    } catch (e) {
      if (e instanceof DocspecError) {
        consola.error(e.message);
      } else {
        consola.error(e instanceof Error ? e.message : String(e));
      }
      process.exit(1);
    }

    const result = await runAudit(parsed, outputDir);
    const report = renderAuditReport(result, new Date().toISOString());

    if (args['write-report'] === true) {
      await mkdir(outputDir, { recursive: true });
      await writeFile(resolve(outputDir, 'audit.md'), report, 'utf8');
      consola.info(`[audit] Wrote ${resolve(outputDir, 'audit.md')}`);
    }

    if (result.findings.length === 0) {
      consola.success(`[audit] No gaps (${result.checkedCount} check(s)).`);
      process.exit(0);
    }

    consola.warn(`[audit] ${result.findings.length} gap(s) (${result.checkedCount} check(s)).`);
    for (const f of result.findings) {
      consola.warn(`  - [${f.type}] ${f.id} → expected ${f.expectedOutput}`);
    }
    process.exit(1);
  },
});

export default auditCommand;
