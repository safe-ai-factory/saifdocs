import { relative, resolve } from 'node:path';

import type { TaskFrontmatter } from '../docspec/schema.js';
import { posixPath } from '../generation/output-paths.js';

export type ReviewTaskFileOpts = {
  projectDir: string;
  outputDir: string;
  productId: string;
  personaId: string;
  taskId: string;
  personaBody: string;
  taskFrontmatter: TaskFrontmatter;
  taskBody: string;
  reportWorkspaceRel: string;
};

function formatSearchTerms(terms: string[]): string {
  if (!terms.length) return '(none specified)';
  return terms.map((t) => `"${t}"`).join(', ');
}

/**
 * Task prompt for the review sandbox: persona + task context + strict report structure.
 */
export function renderReviewTaskFile(opts: ReviewTaskFileOpts): string {
  const docsRel = posixPath(relative(resolve(opts.projectDir), resolve(opts.outputDir)));
  const arrival = opts.taskFrontmatter.arrival_context ?? 'unspecified';
  const userStage = opts.taskFrontmatter.user_stage ?? 'unspecified';

  return `# Documentation review (persona simulation)

You are running **inside the project workspace** (same tree as the host repo). Do **not** use the public internet to look up product information — base your review only on files in this repository, especially under \`${docsRel}/\`.

## Persona (adopt this perspective fully)

${opts.personaBody.trim()}

## Task / goal

**Product:** \`${opts.productId}\`  
**Persona id:** \`${opts.personaId}\`  
**Task id:** \`${opts.taskId}\`

**Arrival context:** \`${arrival}\`  
**Search terms** (how this reader might have arrived): ${formatSearchTerms(opts.taskFrontmatter.search_terms)}  
**User stage** (\`evaluating\` | \`getting-started\` | \`established\`): \`${userStage}\`

### Task description (from docspec)

${opts.taskBody.trim() || '(empty task body)'}

## What to do

1. Explore the **generated documentation** under \`${docsRel}/\` as this persona would — e.g. open relevant pages, follow links, skim headings.
2. Determine whether you could **accomplish the task** using only that documentation (no external search).
3. Write a structured review report at **exactly** this path (repo-relative, must be created):

\`${opts.reportWorkspaceRel}\`

Use Markdown. Follow this structure **exactly** (use every section; write \`None\` if a section has no items):

\`\`\`markdown
# Review: ${opts.personaId} — ${opts.taskId}

**Persona:** <short label>
**Task:** <one line>
**Arrival:** ${arrival} via ${formatSearchTerms(opts.taskFrontmatter.search_terms)}
**Date:** <ISO-8601 timestamp>

## Verdict
PASS | PARTIAL | FAIL

## Journey
Step-by-step: where you started, what you read, where you got stuck.

## Findings

### Blockers
- ...

### Friction points
- ...

### Missing information
- ...

## Positive signals
- ...

## Recommendations
Ordered by impact.
\`\`\`

## Rules

- **Do not** edit existing documentation under \`${docsRel}/\` except to add the single report file above (if your tools would modify other files, avoid that).
- The gate script only checks that your report file exists and is non-empty — but you should still produce a complete, honest review.
`;
}
