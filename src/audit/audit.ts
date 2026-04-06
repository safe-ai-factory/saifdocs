/**
 * Gaps audit: compare declared docspec intents to files on disk under outputDir.
 *
 * Does not run generators — only checks that paths `gen` would target actually exist
 * (structural completeness). Distinct from `validate` (staleness vs manifest inputs).
 */
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ParsedDocspec } from '../docspec/types.js';
import { findConcept } from './audit-helpers.js';

/** Kind of mismatch; `unknown-prereq-concept` means docspec error, the rest mean missing output file. */
export type AuditFindingType =
  | 'missing-reference'
  | 'missing-concept'
  | 'missing-how-to'
  | 'missing-tutorial'
  | 'missing-landing'
  | 'missing-prereq-concept'
  | 'unknown-prereq-concept';

/** One gap: where it was declared in docspec vs where the file should have been written. */
export type AuditFinding = {
  type: AuditFindingType;
  id: string;
  expectedOutput: string;
  declaredIn: string;
};

/** All gaps plus how many existence checks ran (for summaries / CI). */
export type AuditResult = {
  findings: AuditFinding[];
  checkedCount: number;
};

/** True if path exists (any type); used instead of stat to avoid caring about directories vs files here. */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cross-check parsed docspec vs generated files under `outputDir` (absolute paths recommended).
 *
 * Expected layout matches {@link buildManifest} outputs: `references/…`, `products/<id>/…`.
 */
export async function runAudit(parsed: ParsedDocspec, outputDir: string): Promise<AuditResult> {
  const findings: AuditFinding[] = [];
  let checkedCount = 0;

  // docspec/references/** → outputDir/references/** (same relative path under references/)
  for (const ref of parsed.references) {
    checkedCount++;
    const expectedOutput = join(outputDir, 'references', ref.relativePathUnderReferences);
    if (!(await pathExists(expectedOutput))) {
      findings.push({
        type: 'missing-reference',
        id: ref.id,
        expectedOutput,
        declaredIn: ref.absolutePath,
      });
    }
  }

  for (const product of parsed.products) {
    // Parent of product.md: manifest may be how-tos.{yaml,yml} / tutorials.{yaml,yml}
    const productRoot = dirname(product.product.absolutePath);

    // Intent files under docspec/products/<id>/concepts/ → generated concept pages
    for (const concept of product.concepts) {
      checkedCount++;
      const expectedOutput = join(
        outputDir,
        'products',
        product.id,
        'concepts',
        `${concept.id}.md`,
      );
      if (!(await pathExists(expectedOutput))) {
        findings.push({
          type: 'missing-concept',
          id: `${product.id}/${concept.id}`,
          expectedOutput,
          declaredIn: concept.absolutePath,
        });
      }
    }

    // YAML list in how-tos.{yaml,yml} → one file per intent id under products/<id>/how-tos/
    const howTosDecl = product.howTosManifestPath ?? join(productRoot, 'how-tos.yaml');
    for (const intent of product.howTosManifest ?? []) {
      checkedCount++;
      const expectedOutput = join(outputDir, 'products', product.id, 'how-tos', `${intent.id}.md`);
      if (!(await pathExists(expectedOutput))) {
        findings.push({
          type: 'missing-how-to',
          id: intent.id,
          expectedOutput,
          declaredIn: howTosDecl,
        });
      }
    }

    // YAML list in tutorials.{yaml,yml} → products/<id>/tutorials/<intent.id>.md
    const tutorialsDecl = product.tutorialsManifestPath ?? join(productRoot, 'tutorials.yaml');
    for (const intent of product.tutorialsManifest ?? []) {
      checkedCount++;
      const expectedOutput = join(
        outputDir,
        'products',
        product.id,
        'tutorials',
        `${intent.id}.md`,
      );
      if (!(await pathExists(expectedOutput))) {
        findings.push({
          type: 'missing-tutorial',
          id: intent.id,
          expectedOutput,
          declaredIn: tutorialsDecl,
        });
      }
    }

    // One landing page per product (gen always emits it when landing-pages are in scope)
    checkedCount++;
    const landingOutput = join(outputDir, 'products', product.id, 'index.md');
    if (!(await pathExists(landingOutput))) {
      findings.push({
        type: 'missing-landing',
        id: product.id,
        expectedOutput: landingOutput,
        declaredIn: product.product.absolutePath,
      });
    }

    // Task frontmatter can name concepts the how-to generator should assume; ensure they exist in docspec and on disk.
    // Duplicates `missing-concept` when a prereq is also a declared concept but not yet generated — intentional overlap for clearer reporting.
    for (const persona of product.personas) {
      for (const task of persona.tasks) {
        for (const cid of task.frontmatter.prereq_concepts) {
          checkedCount++;
          try {
            findConcept(product, cid);
          } catch {
            // id does not match any concept file / frontmatter id under this product
            findings.push({
              type: 'unknown-prereq-concept',
              id: cid,
              expectedOutput: join(outputDir, 'products', product.id, 'concepts', `${cid}.md`),
              declaredIn: task.absolutePath,
            });
            continue;
          }

          // Concept is declared but generated page may still be missing after a partial `gen`
          const expectedOutput = join(outputDir, 'products', product.id, 'concepts', `${cid}.md`);
          if (!(await pathExists(expectedOutput))) {
            findings.push({
              type: 'missing-prereq-concept',
              id: `${product.id}/${cid}`,
              expectedOutput,
              declaredIn: task.absolutePath,
            });
          }
        }
      }
    }
  }

  return { findings, checkedCount };
}
