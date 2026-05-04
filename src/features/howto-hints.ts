/**
 * Pull arrival_context / search_terms / user_stage from a how-to entry's
 * task frontmatter (first task sets enums; search_terms merged across all
 * referenced tasks).
 */
import { readFile } from 'node:fs/promises';

import matter from 'gray-matter';

import { TaskFrontmatterSchema } from '../docspec/schema.js';
import type { HowToTaskHints } from '../generation/task-file.js';
import type { ManifestEntry } from '../manifest/types.js';

/**
 * Manifest `read` includes docspec task paths; match by `…/tasks/<taskId>.md`
 * (Windows-safe: backslashes normalized). Internal helper.
 */
function findTaskFilesInRead(entry: ManifestEntry): string[] {
  const out: string[] = [];
  for (const taskId of entry.taskIds) {
    const needle = `/tasks/${taskId}.md`;
    const p = entry.read.find((x) => x.replace(/\\/g, '/').endsWith(needle));
    if (p) out.push(p);
  }
  return out;
}

/**
 * Load and merge how-to task hints from the docspec task files referenced
 * by the entry. Returns `undefined` for non-how-to entries or when no task
 * files were found.
 */
export async function loadHowToTaskHints(
  entry: ManifestEntry,
): Promise<HowToTaskHints | undefined> {
  const taskPaths = findTaskFilesInRead(entry);
  if (taskPaths.length === 0) return undefined;
  let hints: HowToTaskHints | undefined;
  const mergedTerms: string[] = [];
  const seenTerm = new Set<string>();
  for (const taskPath of taskPaths) {
    try {
      const raw = await readFile(taskPath, 'utf8');
      const parsed = matter(raw);
      const result = TaskFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) continue;
      const d = result.data;
      if (!hints) {
        hints = {
          arrival_context: d.arrival_context,
          user_stage: d.user_stage,
        };
      }
      for (const t of d.search_terms ?? []) {
        if (!seenTerm.has(t)) {
          seenTerm.add(t);
          mergedTerms.push(t);
        }
      }
    } catch {
      /* skip bad task file */
    }
  }
  if (!hints) return undefined;
  if (mergedTerms.length) hints.search_terms = mergedTerms;
  return hints;
}
