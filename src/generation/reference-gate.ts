/**
 * Bash gate script for reference generation: requires output files under workspace to exist and be non-empty.
 *
 * Note: The gate assumes the agent workspace root matches saifctl’s default mount. We use
 * `SAIFCTL_WORKSPACE_BASE` (when set) or fall back to `/workspace`. If saifctl ever changes the
 * in-container workspace path without setting that env var, this script must be updated to match.
 */

/** `relPaths` are repo-relative, e.g. docs/references/commands/sandbox.md */
export function buildReferenceGateScript(relPaths: string[]): string {
  const quoted = relPaths.map((p) => `"${p.replace(/\\/g, '/').replace(/"/g, '\\"')}"`);
  const forList = quoted.join(' \\\n  ');

  const lines: string[] = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'WS="${SAIFCTL_WORKSPACE_BASE:-/workspace}"',
    'MISSING=()',
    'for rel in \\',
    `  ${forList}; do`,
    '  f="$WS/$rel"',
    '  if [[ ! -f "$f" ]]; then',
    '    MISSING+=("MISSING: $rel (no file at $f)")',
    '  elif [[ ! -s "$f" ]]; then',
    '    MISSING+=("EMPTY: $rel")',
    '  fi',
    'done',
    'if [[ ${#MISSING[@]} -gt 0 ]]; then',
    '  echo "Gate failed. Fix these outputs before the run can succeed:"',
    '  printf \'  %s\\n\' "${MISSING[@]}"',
    '  exit 1',
    'fi',
    'echo "Gate passed: all expected reference outputs exist and are non-empty."',
    'exit 0',
  ];

  return `${lines.join('\n')}\n`;
}
