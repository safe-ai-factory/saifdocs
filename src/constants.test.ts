import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  getDefaultReviewCedarPath,
  getDefaultReviewStrictCedarPath,
  REVIEW_CEDAR_FILENAME,
  REVIEW_STRICT_CEDAR_FILENAME,
} from './constants.js';

describe('packaged Cedar policies', () => {
  it('default review policy exists on disk', () => {
    const p = getDefaultReviewCedarPath();
    expect(p.endsWith(REVIEW_CEDAR_FILENAME)).toBe(true);
    expect(existsSync(p)).toBe(true);
  });

  it('strict review policy exists on disk', () => {
    const p = getDefaultReviewStrictCedarPath();
    expect(p.endsWith(REVIEW_STRICT_CEDAR_FILENAME)).toBe(true);
    expect(existsSync(p)).toBe(true);
  });
});
