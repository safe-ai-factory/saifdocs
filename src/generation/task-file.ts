/**
 * Per-entry task markdown for the sandbox agent (hybrid: lists paths to read; agent loads content).
 */
import matter from 'gray-matter';

import type { TaskFrontmatter } from '../docspec/schema.js';
import type { ManifestEntry } from '../manifest/types.js';
import { outputPathRelativeToProject } from './output-paths.js';

/** Container workspace root — the project is mounted here inside the sandbox. */
const CONTAINER_WORKSPACE = '/workspace';

/**
 * Translates a host-absolute path (from `entry.read` or `entry.output`) to the equivalent
 * path inside the sandbox container, where the project is mounted at `/workspace`.
 * Falls back to the original path if it cannot be made project-relative (e.g. a temp file).
 */
function toContainerPath(hostAbsPath: string, projectDir: string): string {
  try {
    const rel = outputPathRelativeToProject(projectDir, hostAbsPath);
    return `${CONTAINER_WORKSPACE}/${rel}`;
  } catch {
    return hostAbsPath;
  }
}

/** Optional task intent fields embedded in how-to task instructions (from docspec task frontmatter). */
export type HowToTaskHints = {
  arrival_context?: TaskFrontmatter['arrival_context'];
  search_terms?: string[];
  user_stage?: TaskFrontmatter['user_stage'];
};

export function renderReferenceTaskFile(entry: ManifestEntry, projectDir: string): string {
  const workspaceRel = outputPathRelativeToProject(projectDir, entry.output);
  const readList = entry.read.map((p) => `- ${toContainerPath(p, projectDir)}`).join('\n');

  const body = `You are generating a **reference** documentation page (Diátaxis: reference — information-oriented, easy to scan).

## Output (required)

Write the final page to this path relative to the **repository root** (workspace), creating parent directories if needed:

\`${workspaceRel}\`

Do not use a different path.

## Files to read first

Read every file below before writing. They contain the canonical source, pointer metadata, rules, and optional structure template.

${readList}

## Requirements

- Accurately document the public surface from the implementation source file (e.g. CLI flags: name, alias, type, required/optional, default, description).
- Include at least one realistic usage example (shell commands where applicable).
- Apply tone and formatting from any \`rules.md\` and from the reference page template if provided.
- Do **not** invent flags, options, or behaviour that are not present in the source.
- Use clear headings; keep reference pages scannable.

When finished, ensure the output file exists at the path above and is not empty.
`;

  const data = {
    output: `${CONTAINER_WORKSPACE}/${workspaceRel}`,
    type: entry.type,
    read: entry.read.map((p) => toContainerPath(p, projectDir)),
    workspace_relative_output: workspaceRel,
  };

  return matter.stringify(body, data);
}

export function renderConceptTaskFile(entry: ManifestEntry, projectDir: string): string {
  const workspaceRel = outputPathRelativeToProject(projectDir, entry.output);
  const readList = entry.read.map((p) => `- ${toContainerPath(p, projectDir)}`).join('\n');

  const body = `You are generating a **concept / explanation** page (Diátaxis: explanation — understanding-oriented, not a how-to).

## Output (required)

Write the final page to this path relative to the **repository root** (workspace), creating parent directories if needed:

\`${workspaceRel}\`

Do not use a different path.

## Files to read first

Read every file below before writing. They include the concept intent, product framing, persona descriptions, rules (apply in order: persona rules override product rules override global rules), and optional page template.

${readList}

## Requirements

- Build understanding: **why** and **how things fit together**. Do not write numbered step-by-step procedures or “run this command” tutorials here.
- The concept intent file lists \`learning_outcomes\` and \`analogies\`: the reader must leave the page having grasped those outcomes; use analogies only when they help.
- Frame vocabulary and examples for this **product** and the personas described in the persona files (multiple personas may be listed — avoid assuming only the most expert reader).
- Apply tone and structure from any \`rules.md\` files and from the concept page template if provided.
- Link out to how-to or reference pages where appropriate instead of duplicating procedural or flag-level detail.

When finished, ensure the output file exists at the path above and is not empty.
`;

  const data = {
    output: `${CONTAINER_WORKSPACE}/${workspaceRel}`,
    type: entry.type,
    read: entry.read.map((p) => toContainerPath(p, projectDir)),
    workspace_relative_output: workspaceRel,
  };

  return matter.stringify(body, data);
}

function formatHowToHintsBlock(hints: HowToTaskHints | undefined): string {
  if (!hints) {
    return 'Use the task intent file under `tasks/` in the read list for arrival context, search terms, and user stage if present.';
  }
  const lines: string[] = [];
  if (hints.arrival_context !== undefined) {
    lines.push(
      `- **Arrival context**: \`${hints.arrival_context}\` — open the page so it matches how someone arriving this way would think (e.g. search = cold landing, match likely queries).`,
    );
  }
  if (hints.search_terms?.length) {
    lines.push(
      `- **Search / query language** (use these phrases or close synonyms in the opening so the page meets the reader where they are): ${hints.search_terms.map((t) => `\`${t}\``).join(', ')}`,
    );
  }
  if (hints.user_stage !== undefined) {
    const stageGuide =
      hints.user_stage === 'evaluating'
        ? 'Reader is evaluating / pre-commitment — clarify fit and trust; avoid assuming deep prior commitment.'
        : hints.user_stage === 'getting-started'
          ? 'Reader is onboarding — fastest path to first success; clear sequence.'
          : 'Reader is established in production — troubleshooting and “if X then Y” patterns where relevant.';
    lines.push(`- **User stage** (\`user_stage: ${hints.user_stage}\`): ${stageGuide}`);
  }
  if (lines.length === 0) {
    return 'Use the task intent file under `tasks/` in the read list for arrival context, search terms, and user stage if present.';
  }
  return lines.join('\n');
}

export function renderHowToTaskFile(
  entry: ManifestEntry,
  projectDir: string,
  hints?: HowToTaskHints,
): string {
  const workspaceRel = outputPathRelativeToProject(projectDir, entry.output);
  const readList = entry.read.map((p) => `- ${toContainerPath(p, projectDir)}`).join('\n');
  const hintsBlock = formatHowToHintsBlock(hints);

  const body = `You are generating a **how-to guide** (Diátaxis: how-to — goal-oriented; reader wants to accomplish a specific outcome).

## Output (required)

Write the final page to this path relative to the **repository root** (workspace), creating parent directories if needed:

\`${workspaceRel}\`

Do not use a different path.

## Files to read first

Read every file below before writing. They include persona rules, persona description, task intent, product framing, prerequisite concept intents, reference pages for CLI accuracy, and optional template.

${readList}

## Reader and framing

${hintsBlock}

## Rules precedence

When \`rules.md\` files conflict, **persona rules win over product rules, which win over global rules** (the read list order reflects that: persona rules appear before persona prose before task before product).

## Requirements

- Lead with the **outcome** the reader wants, not internal implementation detail.
- If arrival context is \`search\` or search terms are given, surface those ideas in the **first paragraph** so cold landers see familiar language.
- Use **accurate** command names and flags from reference pages in the read list; do not invent options.
- Prerequisite concept files are in the read list: if the reader may not have read them yet, add a **short** inline reminder of the one idea they need; otherwise link to the concept page.
- Do not turn this into a long conceptual article — link to concept pages for theory.
- End with a clear **next step** or **See also** (links to related how-tos, concepts, or reference).

When finished, ensure the output file exists at the path above and is not empty.
`;

  const data = {
    output: `${CONTAINER_WORKSPACE}/${workspaceRel}`,
    type: entry.type,
    read: entry.read.map((p) => toContainerPath(p, projectDir)),
    workspace_relative_output: workspaceRel,
    ...(hints && Object.keys(hints).length ? { how_to_hints: hints } : {}),
  };

  return matter.stringify(body, data);
}

export function renderTutorialTaskFile(entry: ManifestEntry, projectDir: string): string {
  const workspaceRel = outputPathRelativeToProject(projectDir, entry.output);
  const readList = entry.read.map((p) => `- ${toContainerPath(p, projectDir)}`).join('\n');
  const pos = entry.tutorialPosition ?? 'unknown';
  const total = entry.tutorialThreadLength ?? 'unknown';

  const body = `You are generating a **tutorial stage** (Diátaxis: tutorial — learning-oriented; reader follows structured steps in a safe environment to build understanding).

## Output (required)

Write the final page to this path relative to the **repository root** (workspace), creating parent directories if needed:

\`${workspaceRel}\`

Do not use a different path.

## Files to read first

Read every file below before writing. They include persona rules, persona description, product framing, concept intents for this stage, optional prior tutorial output, how-to pages for accurate commands, rules, and optional tutorial template.

${readList}

## Stage context

- **Stage**: ${pos} of ${total} in this tutorial series (same persona thread; progressive disclosure).
- **Persona**: \`${entry.personaId ?? 'unknown'}\` — write for this reader.
- **Product**: \`${entry.productId ?? 'unknown'}\` — use this product’s framing.

## Requirements

- This stage introduces new ideas to a reader who may be new to the tool.
- Concept intent files in the read list (often aligned with \`learns_concepts\` for this stage) define what the reader should grasp by the end; teach those ideas through **doing**, not only prose.
- If a **prior-stage** tutorial markdown file appears in the read list, read it first: reuse vocabulary already established and **do not** repeat what that stage already taught.
- **How-to** pages in the read list are for accurate command usage; **link** to them for procedures instead of duplicating long flag lists.
- Tutorials teach by doing: include concrete steps the reader can follow (commands, checks, or exercises as appropriate).
- When \`rules.md\` files conflict, **persona rules win over product rules, which win over global rules**.
- Apply the tutorial page template from the read list if present.
- End with a clear **next step** (next tutorial stage, a how-to, or “you are ready to try X”).

When finished, ensure the output file exists at the path above and is not empty.
`;

  const data = {
    output: `${CONTAINER_WORKSPACE}/${workspaceRel}`,
    type: entry.type,
    read: entry.read.map((p) => toContainerPath(p, projectDir)),
    workspace_relative_output: workspaceRel,
    tutorial_position: entry.tutorialPosition,
    tutorial_thread_length: entry.tutorialThreadLength,
    persona_id: entry.personaId,
    product_id: entry.productId,
  };

  return matter.stringify(body, data);
}

export function renderLandingPageTaskFile(entry: ManifestEntry, projectDir: string): string {
  const workspaceRel = outputPathRelativeToProject(projectDir, entry.output);
  const readList = entry.read.map((p) => `- ${toContainerPath(p, projectDir)}`).join('\n');

  const body = `You are generating a **product landing / index page** (navigation root for one product; helps readers orient and choose their path).

## Output (required)

Write the final page to this path relative to the **repository root** (workspace), creating parent directories if needed:

\`${workspaceRel}\`

Do not use a different path.

## Files to read first

Read every file below before writing. They include the product description, product rules, global rules, every persona and persona rules, every task intent under those personas, and optional landing template.

${readList}

## Requirements

- This is the first page a reader sees for this **product**. In seconds they should know: what this product is, who it is for, and what they can do next.
- Use language from the product and persona files; avoid internal implementation jargon as the lead.
- Task files in the read list describe jobs readers want; surface the most important outcomes as navigation entry points.
- **Link** to how-to guides, tutorials, and concept pages that correspond to paths under this product in the generated docs tree. Only promise or link to content you can infer from the read list and standard layout (\`how-tos/\`, \`tutorials/\`, \`concepts/\` under the same product).
- When \`rules.md\` files conflict at this level, **product rules win over global rules** (there is no single persona for a landing page).
- Apply the landing page template from the read list if present.
- Prefer clear headings, short blurbs, and links over long prose.

When finished, ensure the output file exists at the path above and is not empty.
`;

  const data = {
    output: `${CONTAINER_WORKSPACE}/${workspaceRel}`,
    type: entry.type,
    read: entry.read.map((p) => toContainerPath(p, projectDir)),
    workspace_relative_output: workspaceRel,
    product_id: entry.productId,
  };

  return matter.stringify(body, data);
}
