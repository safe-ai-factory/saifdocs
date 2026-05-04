/**
 * Repo-relative path helpers for generated docs.
 */
import { relative, resolve } from 'node:path';

/** Normalize to forward slashes for cross-platform path handling. */
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
