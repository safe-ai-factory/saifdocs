import { describe, expect, it } from 'vitest';

import { cliBooleanTrue, parseOutputTypes, resolveExportManifestOutPath } from './args.js';

describe('resolveExportManifestOutPath', () => {
  it('returns false for undefined or empty', () => {
    expect(resolveExportManifestOutPath(undefined)).toBe(false);
    expect(resolveExportManifestOutPath('')).toBe(false);
    expect(resolveExportManifestOutPath('   ')).toBe(false);
  });

  it('maps stdout and - to stdout sentinel', () => {
    expect(resolveExportManifestOutPath('stdout')).toBe('stdout');
    expect(resolveExportManifestOutPath('-')).toBe('stdout');
  });

  it('returns path string for file targets', () => {
    expect(resolveExportManifestOutPath('./out/manifest.json')).toBe('./out/manifest.json');
  });
});

describe('parseOutputTypes', () => {
  it('accepts all', () => {
    expect(parseOutputTypes('all')).toBe('all');
    expect(parseOutputTypes(undefined)).toBe('all');
    expect(parseOutputTypes('   ')).toBe('all');
  });

  it('trims raw value and comma-separated parts', () => {
    expect(parseOutputTypes('  all  ')).toBe('all');
    expect(parseOutputTypes(' references , concepts ')).toEqual(['references', 'concepts']);
  });

  it('drops empty segments from commas', () => {
    expect(parseOutputTypes('references,,concepts')).toEqual(['references', 'concepts']);
  });

  it('throws on unknown type', () => {
    expect(() => parseOutputTypes('references,bogus')).toThrow(/Unknown output type "bogus"/);
  });
});

describe('cliBooleanTrue', () => {
  it('is true when kebab or camel key is true', () => {
    expect(
      cliBooleanTrue(
        { 'allow-missing-manifest': true },
        'allow-missing-manifest',
        'allowMissingManifest',
      ),
    ).toBe(true);
    expect(
      cliBooleanTrue(
        { allowMissingManifest: true },
        'allow-missing-manifest',
        'allowMissingManifest',
      ),
    ).toBe(true);
    expect(cliBooleanTrue({}, 'allow-missing-manifest', 'allowMissingManifest')).toBe(false);
  });
});
