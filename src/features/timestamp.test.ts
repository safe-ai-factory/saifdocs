import { describe, expect, it } from 'vitest';

import {
  assertValidFeatureId,
  generateTimestampFeatureId,
  validateFeatureId,
} from './timestamp.js';

describe('generateTimestampFeatureId', () => {
  it('produces a saifdocs-<ISO> id with no colons or dots', () => {
    const id = generateTimestampFeatureId(new Date('2026-05-04T10:30:45.123Z'));
    expect(id).toBe('saifdocs-2026-05-04T10-30-45-123Z');
    expect(id).not.toContain(':');
    expect(id).not.toContain('.');
  });

  it('produced id is lex-sortable in chronological order', () => {
    const earlier = generateTimestampFeatureId(new Date('2026-01-01T00:00:00.000Z'));
    const middle = generateTimestampFeatureId(new Date('2026-06-15T12:30:00.500Z'));
    const later = generateTimestampFeatureId(new Date('2026-12-31T23:59:59.999Z'));
    const sorted = [later, earlier, middle].sort();
    expect(sorted).toEqual([earlier, middle, later]);
  });

  it('passes its own validation', () => {
    const id = generateTimestampFeatureId();
    expect(validateFeatureId(id)).toEqual({ ok: true });
  });
});

describe('validateFeatureId', () => {
  it('accepts simple kebab-case ids', () => {
    expect(validateFeatureId('saifdocs-monthly-2026-05')).toEqual({ ok: true });
    expect(validateFeatureId('docs')).toEqual({ ok: true });
    expect(validateFeatureId('a')).toEqual({ ok: true });
    expect(validateFeatureId('a1b2c3')).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    expect(validateFeatureId('')).toMatchObject({ ok: false });
  });

  it('rejects ids longer than 100 chars', () => {
    expect(validateFeatureId('a'.repeat(101))).toMatchObject({ ok: false });
  });

  it('accepts uppercase letters (ISO-8601 timestamps need T and Z)', () => {
    expect(validateFeatureId('saifdocs-2026-05-04T10-30-45-123Z')).toEqual({ ok: true });
    expect(validateFeatureId('Foo-Bar')).toEqual({ ok: true });
  });

  it('rejects leading or trailing hyphen', () => {
    expect(validateFeatureId('-foo')).toMatchObject({ ok: false });
    expect(validateFeatureId('foo-')).toMatchObject({ ok: false });
  });

  it('rejects consecutive hyphens', () => {
    expect(validateFeatureId('foo--bar')).toMatchObject({ ok: false });
  });

  it('rejects underscores, slashes, and other punctuation', () => {
    expect(validateFeatureId('foo_bar')).toMatchObject({ ok: false });
    expect(validateFeatureId('foo/bar')).toMatchObject({ ok: false });
    expect(validateFeatureId('foo.bar')).toMatchObject({ ok: false });
    expect(validateFeatureId('foo bar')).toMatchObject({ ok: false });
  });
});

describe('assertValidFeatureId', () => {
  it('returns the id unchanged when valid', () => {
    expect(assertValidFeatureId('saifdocs-monthly-2026-05')).toBe('saifdocs-monthly-2026-05');
  });

  it('throws with a descriptive message when invalid', () => {
    expect(() => assertValidFeatureId('foo bar')).toThrow(/letters, digits/);
  });
});
