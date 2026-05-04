import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { outputPathRelativeToProject, posixPath } from './output-paths.js';

describe('output-paths', () => {
  it('outputPathRelativeToProject returns posix repo-relative path', () => {
    const p = resolve('/proj/docs/ref.md');
    expect(outputPathRelativeToProject('/proj', p)).toBe('docs/ref.md');
  });

  it('outputPathRelativeToProject throws when output is outside project-dir', () => {
    expect(() => outputPathRelativeToProject('/proj', '/outside/other.md')).toThrow(
      /inside project-dir/,
    );
  });

  it('outputPathRelativeToProject throws when output equals project root', () => {
    expect(() => outputPathRelativeToProject('/proj', '/proj')).toThrow(/inside project-dir/);
  });

  it('posixPath normalizes backslashes', () => {
    expect(posixPath('a\\b\\c')).toBe('a/b/c');
  });
});
