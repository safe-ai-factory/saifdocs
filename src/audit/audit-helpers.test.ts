import { describe, expect, it } from 'vitest';

import type { ConceptFrontmatter } from '../docspec/schema.js';
import type { ProductEntry } from '../docspec/types.js';
import { findConcept } from './audit-helpers.js';

function productWithConcepts(concepts: ProductEntry['concepts']): ProductEntry {
  return {
    id: 'p1',
    product: { absolutePath: '/tmp/p1/product.md', body: '' },
    productRules: null,
    personas: [],
    concepts,
    howTosManifestPath: null,
    howTosManifest: null,
    tutorialsManifestPath: null,
    tutorialsManifest: null,
  };
}

describe('findConcept', () => {
  const fm: ConceptFrontmatter = {
    id: 'logical-id',
    explains: 'x',
    learning_outcomes: [],
    analogies: [],
  };

  it('resolves by filename stem when it matches', () => {
    const product = productWithConcepts([
      {
        id: 'c1',
        absolutePath: '/c1.md',
        frontmatter: { ...fm, id: 'other' },
        body: '',
      },
    ]);
    expect(findConcept(product, 'c1').id).toBe('c1');
  });

  it('falls back to frontmatter id when stem differs', () => {
    const product = productWithConcepts([
      {
        id: 'file-stem',
        absolutePath: '/file-stem.md',
        frontmatter: { ...fm, id: 'logical-id' },
        body: '',
      },
    ]);
    expect(findConcept(product, 'logical-id').id).toBe('file-stem');
  });

  it('throws when no concept matches', () => {
    const product = productWithConcepts([
      {
        id: 'a',
        absolutePath: '/a.md',
        frontmatter: { ...fm, id: 'b' },
        body: '',
      },
    ]);
    expect(() => findConcept(product, 'missing')).toThrow(/Unknown concept "missing"/);
  });
});
