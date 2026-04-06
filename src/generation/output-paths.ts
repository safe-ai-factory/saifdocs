/**
 * Repo-relative paths for generated docs and saifctl --extract-include prefix.
 */
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';

/** Normalize to forward slashes for git diff prefixes. */
export function posixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Workspace-relative path from project root to a generated file (e.g. docs/references/commands/x.md).
 */
export function outputPathRelativeToProject(projectDir: string, outputAbs: string): string {
  const rel = relative(resolve(projectDir), resolve(outputAbs));
  if (rel.startsWith('..') || rel === '') {
    throw new Error(
      `Generated output path must be inside project-dir: ${outputAbs} (project: ${projectDir})`,
    );
  }
  return posixPath(rel);
}

/**
 * Repo-relative prefix for `saifctl sandbox --extract-include` (e.g. `docs` or `generated-docs`).
 * `outputDir` may be absolute or relative; it is normalized with `resolve(outputDir)` first.
 */
export function extractIncludePrefix(projectDir: string, outputDir: string): string {
  const rel = relative(resolve(projectDir), resolve(outputDir));
  if (rel.startsWith('..') || rel === '') {
    throw new Error(
      `output-dir must be inside project-dir for sandbox extract (got output-dir=${outputDir})`,
    );
  }
  const p = posixPath(rel).replace(/\/+$/, '');
  return p === '' ? '.' : p;
}

/** Docker / container name limits are strict; keep under this length after sanitization. */
export const MAX_SANDBOX_NAME_LEN = 63;

/** Sanitize manifest entry id for `saifctl sandbox --name` (kebab-case segments only). */
export function sandboxNameFromEntryId(entryId: string): string {
  let s = entryId.replace(/--+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) {
    s = `saifdocs-${
      s
        .replace(/[^a-z0-9-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'run'
    }`;
  }
  if (s.length <= MAX_SANDBOX_NAME_LEN) return s;
  const h = createHash('sha256').update(entryId).digest('hex').slice(0, 16);
  return `saifdocs-${h}`;
}
