import type { ParsedDocspec } from '../docspec/types.js';

type Product = ParsedDocspec['products'][0];

/** Match by filename stem or frontmatter `id` (same as manifest builder). */
export function findConcept(product: Product, conceptId: string) {
  const c =
    product.concepts.find((x) => x.id === conceptId) ??
    product.concepts.find((x) => x.frontmatter.id === conceptId);
  if (!c) {
    throw new Error(`Unknown concept "${conceptId}" for product "${product.id}"`);
  }
  return c;
}
