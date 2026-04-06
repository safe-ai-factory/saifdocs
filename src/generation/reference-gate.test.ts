import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildReferenceGateScript } from './reference-gate.js';

describe('buildReferenceGateScript', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      rmSync(d, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  function writeGateAndCheckSyntax(script: string): void {
    const dir = mkdtempSync(join(tmpdir(), 'saifdocs-gate-'));
    tmpDirs.push(dir);
    const p = join(dir, 'gate.sh');
    writeFileSync(p, script, 'utf8');
    expect(() => {
      execFileSync('bash', ['-n', p], { encoding: 'utf8' });
    }).not.toThrow();
  }

  it('produces bash that passes bash -n', () => {
    const script = buildReferenceGateScript(['docs/references/commands/foo.md']);
    writeGateAndCheckSyntax(script);
  });

  it('lists all expected paths in the for loop', () => {
    const script = buildReferenceGateScript(['a.md', 'b/c.md']);
    expect(script).toContain('"a.md"');
    expect(script).toContain('"b/c.md"');
  });

  it('escapes double quotes and normalizes backslashes (still valid bash)', () => {
    const script = buildReferenceGateScript(['dir\\sub\\weird"name.md']);
    expect(script).toContain('dir/sub/weird');
    expect(script).toContain('\\"');
    writeGateAndCheckSyntax(script);
  });
});
