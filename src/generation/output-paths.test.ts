import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  extractIncludePrefix,
  MAX_SANDBOX_NAME_LEN,
  outputPathRelativeToProject,
  posixPath,
  sandboxNameFromEntryId,
} from './output-paths.js';

describe('output-paths', () => {
  it('sandboxNameFromEntryId collapses double hyphens for kebab-case name', () => {
    expect(sandboxNameFromEntryId('reference--commands--test-cmd')).toBe(
      'reference-commands-test-cmd',
    );
  });

  it('outputPathRelativeToProject returns posix repo-relative path', () => {
    const p = resolve('/proj/docs/ref.md');
    expect(outputPathRelativeToProject('/proj', p)).toBe('docs/ref.md');
  });

  it('extractIncludePrefix works when output-dir is absolute', () => {
    expect(extractIncludePrefix('/proj', '/proj/docs')).toBe('docs');
    expect(extractIncludePrefix('/proj', '/proj/nested/docs')).toBe('nested/docs');
  });

  it('outputPathRelativeToProject throws when output is outside project-dir', () => {
    expect(() => outputPathRelativeToProject('/proj', '/outside/other.md')).toThrow(
      /inside project-dir/,
    );
  });

  it('extractIncludePrefix throws when output-dir escapes project-dir', () => {
    expect(() => extractIncludePrefix('/proj', '/outside/docs')).toThrow(
      /output-dir must be inside project-dir/,
    );
  });

  it('outputPathRelativeToProject throws when output equals project root', () => {
    expect(() => outputPathRelativeToProject('/proj', '/proj')).toThrow(/inside project-dir/);
  });

  it('posixPath normalizes backslashes', () => {
    expect(posixPath('a\\b\\c')).toBe('a/b/c');
  });

  it('sandboxNameFromEntryId caps length for Docker-friendly names', () => {
    const longId = `reference--${'x'.repeat(80)}`;
    const name = sandboxNameFromEntryId(longId);
    expect(name.length).toBeLessThanOrEqual(MAX_SANDBOX_NAME_LEN);
    expect(name).toMatch(/^saifdocs-[0-9a-f]{16}$/);
  });
});
