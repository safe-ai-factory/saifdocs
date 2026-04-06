import { DEFAULT_DOCSPEC_DIR, DEFAULT_OUTPUT_DIR } from '../constants.js';
import type { OutputType } from '../manifest/types.js';

export const docspecDirArg = {
  type: 'string' as const,
  description: 'Path to docspec input directory',
  default: DEFAULT_DOCSPEC_DIR,
};

export const outputDirArg = {
  type: 'string' as const,
  description: 'Directory for generated documentation output',
  default: DEFAULT_OUTPUT_DIR,
};

export const projectDirArg = {
  type: 'string' as const,
  description: 'Project root (resolves reference pointer source paths)',
  default: '.',
};

export const typesArg = {
  type: 'string' as const,
  description:
    'Comma-separated output types: references,concepts,how-tos,tutorials,landing-pages (or "all")',
  default: 'all',
};

/** When true, print manifest JSON to stdout after writing docspec/.manifest.json */
export const exportManifestStdoutArg = {
  type: 'boolean' as const,
  description: 'Print manifest JSON to stdout',
  default: false,
};

/** Write manifest JSON to this path (or "stdout" / "-" for stdout); can combine with --export-manifest */
export const exportManifestOutArg = {
  type: 'string' as const,
  description: 'Export manifest JSON to this file path, or "stdout" / "-" for stdout',
};

export const saifctlConfigArg = {
  type: 'string' as const,
  description: 'Path to saifctl configuration file',
};

export const saifctlDirArg = {
  type: 'string' as const,
  description: 'Path to saifctl config directory (Cosmiconfig module root; default: saifctl)',
  default: 'saifctl',
};

export const dryRunArg = {
  type: 'boolean' as const,
  description: 'Resolve manifest only; do not invoke saifctl sandbox',
  default: false,
};

export const allowMissingManifestArg = {
  type: 'boolean' as const,
  description: 'If no docspec/.manifest.json exists, exit successfully instead of failing',
  default: false,
};

export const jsonOutputArg = {
  type: 'boolean' as const,
  description: 'Print machine-readable JSON to stdout',
  default: false,
};

/** Citty may expose boolean flags under kebab-case, camelCase, or both on `args`. */
export function cliBooleanTrue(
  args: Record<string, unknown>,
  kebabKey: string,
  camelKey: string,
): boolean {
  return args[kebabKey] === true || args[camelKey] === true;
}

export function parseOutputTypes(raw: string | undefined): OutputType[] | 'all' {
  const v = raw?.trim() || 'all';
  if (v === 'all') return 'all';
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: OutputType[] = [];
  const allowed: OutputType[] = ['references', 'concepts', 'how-tos', 'tutorials', 'landing-pages'];
  for (const p of parts) {
    if (!allowed.includes(p as OutputType)) {
      throw new Error(`Unknown output type "${p}". Expected one of: ${allowed.join(', ')}, or all`);
    }
    out.push(p as OutputType);
  }
  return out;
}

/** Resolve --export-manifest-out value: empty → false, stdout/- → stdout, else file path (relative ok). */
export function resolveExportManifestOutPath(raw: string | undefined): false | 'stdout' | string {
  if (raw === undefined || raw === '') return false;
  const t = raw.trim();
  if (t === '') return false;
  if (t === 'stdout' || t === '-') return 'stdout';
  return t;
}
