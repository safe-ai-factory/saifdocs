/**
 * Turns a parsed docspec dir into a manifest: one entry per output file, each with
 * `output` (where to write) and `read` (absolute paths the generator agent must read).
 * Order of `read` matters where noted (e.g. persona rules before persona prose).
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { MANIFEST_VERSION } from '../constants.js';
import { DocspecError } from '../docspec/errors.js';
import type { ParsedDocspec, TutorialIntent } from '../docspec/types.js';
import type { GenSettings, ManifestDocument, ManifestEntry, OutputType } from './types.js';

// --- helpers ---

/** Stable, de-duplicated read list (first occurrence wins). */
function dedupeRead(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** Whether this build includes entries of the given output kind (`--types` filter). */
function settingsIncludeType(settings: GenSettings, t: OutputType): boolean {
  if (settings.types === 'all') return true;
  return settings.types.includes(t);
}

/** Optional page template under docspec/templates/pages/<name>.md */
function pageTemplateIfExists(docspecDir: string, name: string): string | undefined {
  const p = join(docspecDir, 'templates', 'pages', `${name}.md`);
  return existsSync(p) ? p : undefined;
}

/** Manifest entry id from path under references/ (e.g. commands/foo.md → reference--commands--foo). */
function referenceId(rel: string): string {
  const withoutMd = rel.replace(/\.md$/i, '');
  return `reference--${withoutMd.replace(/\//g, '--')}`;
}

/** Resolve persona by directory id under products/<product>/personas/<id>/. */
function findPersona(product: ParsedDocspec['products'][0], personaId: string) {
  const p = product.personas.find((x) => x.id === personaId);
  if (!p) {
    throw new DocspecError(
      `Unknown persona "${personaId}" for product "${product.id}"`,
      product.product.absolutePath,
    );
  }
  return p;
}

/** Match by filename stem or frontmatter `id`. */
function findConcept(product: ParsedDocspec['products'][0], conceptId: string) {
  const c =
    product.concepts.find((x) => x.id === conceptId) ??
    product.concepts.find((x) => x.frontmatter.id === conceptId);
  if (!c) {
    throw new DocspecError(
      `Unknown concept "${conceptId}" for product "${product.id}"`,
      product.product.absolutePath,
    );
  }
  return c;
}

/** Tutorial intent in the same product by `id`. */
function findTutorialById(
  intents: TutorialIntent[],
  tutorialId: string,
): TutorialIntent | undefined {
  return intents.find((t) => t.id === tutorialId);
}

export function buildManifest(parsed: ParsedDocspec, settings: GenSettings): ManifestDocument {
  const { docspecDir, outputDir, projectDir } = settings;
  const entries: ManifestEntry[] = [];

  const globalRulesPath = parsed.globalRules?.absolutePath;

  // Reference: pointer file + resolved source on disk + global rules + optional reference template.
  const pushReferenceEntries = (): void => {
    if (!settingsIncludeType(settings, 'references')) return;

    for (const ref of parsed.references) {
      const sourceAbs = resolve(projectDir, ref.frontmatter.source);
      if (!existsSync(sourceAbs)) {
        throw new DocspecError(
          `Reference source file not found: ${ref.frontmatter.source}`,
          ref.absolutePath,
        );
      }
      const output = join(outputDir, 'references', ref.relativePathUnderReferences);
      const read: string[] = [ref.absolutePath, sourceAbs];
      if (globalRulesPath) read.push(globalRulesPath);
      const tpl = pageTemplateIfExists(docspecDir, 'reference');
      if (tpl) read.push(tpl);

      entries.push({
        id: referenceId(ref.relativePathUnderReferences),
        type: 'references',
        output,
        read: dedupeRead(read),
        productId: null,
        personaId: null,
        taskIds: [],
        conceptId: null,
        tutorialPosition: null,
        tutorialThreadLength: null,
        generatedAt: null,
        outputHash: null,
        inputHashes: null,
      });
    }
  };

  /** Reference pages already present under outputDir (how-tos may cite them once they exist). */
  const referenceOutputsExisting = (): string[] => {
    const out: string[] = [];
    for (const ref of parsed.references) {
      const p = join(outputDir, 'references', ref.relativePathUnderReferences);
      if (existsSync(p)) out.push(p);
    }
    return out;
  };

  // Concept: intent file + product + every persona (and rules) for framing + product/global rules + template.
  const pushConceptEntries = (): void => {
    if (!settingsIncludeType(settings, 'concepts')) return;
    for (const product of parsed.products) {
      for (const concept of product.concepts) {
        const output = join(outputDir, 'products', product.id, 'concepts', `${concept.id}.md`);
        const read: string[] = [concept.absolutePath, product.product.absolutePath];
        for (const pe of product.personas) {
          read.push(pe.persona.absolutePath);
          if (pe.personaRules) read.push(pe.personaRules.absolutePath);
        }
        if (product.productRules) read.push(product.productRules.absolutePath);
        if (globalRulesPath) read.push(globalRulesPath);
        const tpl = pageTemplateIfExists(docspecDir, 'concept');
        if (tpl) read.push(tpl);

        entries.push({
          id: `concept--${product.id}--${concept.id}`,
          type: 'concepts',
          output,
          read: dedupeRead(read),
          productId: product.id,
          personaId: null,
          taskIds: [],
          conceptId: concept.id,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: null,
          outputHash: null,
          inputHashes: null,
        });
      }
    }
  };

  // How-to: persona rules → persona → how-to intent .md → task files → product rules → global → template → prereq concepts → existing ref outputs.
  const pushHowToEntries = (): void => {
    if (!settingsIncludeType(settings, 'how-tos')) return;
    const existingRefs = referenceOutputsExisting();
    for (const product of parsed.products) {
      const intents = product.howTosManifest ?? [];
      for (const intent of intents) {
        const persona = findPersona(product, intent.persona);
        const taskFiles: {
          id: string;
          absolutePath: string;
          frontmatter: { prereq_concepts: string[] };
        }[] = [];
        for (const taskStem of intent.tasks) {
          const task = persona.tasks.find((t) => t.id === taskStem);
          if (!task) {
            throw new DocspecError(
              `How-to "${intent.id}" references missing task "${taskStem}" for persona "${intent.persona}"`,
              intent.absolutePath,
            );
          }
          taskFiles.push(task);
        }
        const output = join(outputDir, 'products', product.id, 'how-tos', `${intent.id}.md`);
        const read: string[] = [];
        if (persona.personaRules) read.push(persona.personaRules.absolutePath);
        read.push(persona.persona.absolutePath);
        read.push(intent.absolutePath);
        for (const task of taskFiles) {
          read.push(task.absolutePath);
        }
        read.push(product.product.absolutePath);
        if (product.productRules) read.push(product.productRules.absolutePath);
        if (globalRulesPath) read.push(globalRulesPath);
        const tpl = pageTemplateIfExists(docspecDir, 'how-to');
        if (tpl) read.push(tpl);
        const prereqConceptsOrdered: string[] = [];
        const seenConcept = new Set<string>();
        for (const task of taskFiles) {
          for (const cid of task.frontmatter.prereq_concepts) {
            if (seenConcept.has(cid)) continue;
            seenConcept.add(cid);
            prereqConceptsOrdered.push(cid);
          }
        }
        for (const cid of prereqConceptsOrdered) {
          try {
            const c = findConcept(product, cid);
            read.push(c.absolutePath);
          } catch (e) {
            if (e instanceof DocspecError) {
              throw new DocspecError(
                `How-to "${intent.id}" prereq references unknown concept "${cid}" (from task definitions)`,
                intent.absolutePath,
              );
            }
            throw e;
          }
        }
        read.push(...existingRefs);

        entries.push({
          id: `how-to--${product.id}--${intent.id}`,
          type: 'how-tos',
          output,
          read: dedupeRead(read),
          productId: product.id,
          personaId: intent.persona,
          taskIds: [...intent.tasks],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: null,
          outputHash: null,
          inputHashes: null,
        });
      }
    }
  };

  // Tutorial: sorted by order; read list includes concept intents, optional prior tutorial output, and planned how-to outputs.
  const pushTutorialEntries = (): void => {
    if (!settingsIncludeType(settings, 'tutorials')) return;
    for (const product of parsed.products) {
      const intents = product.tutorialsManifest ?? [];
      const tutorialsErrorPath =
        product.tutorialsOrderPath ?? product.tutorialsDirPath ?? product.product.absolutePath;

      const seenTutorialIds = new Set<string>();
      for (const t of intents) {
        if (seenTutorialIds.has(t.id)) {
          throw new DocspecError(`Duplicate tutorial id "${t.id}"`, tutorialsErrorPath);
        }
        seenTutorialIds.add(t.id);
      }

      const threadByPersona = new Map<string, TutorialIntent[]>();
      for (const t of intents) {
        const thread = threadByPersona.get(t.persona) ?? [];
        thread.push(t);
        threadByPersona.set(t.persona, thread);
      }
      for (const thread of threadByPersona.values()) {
        thread.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      }

      const tutorialPositionMeta = new Map<string, { position: number; length: number }>();
      for (const thread of threadByPersona.values()) {
        const len = thread.length;
        for (let i = 0; i < thread.length; i++) {
          tutorialPositionMeta.set(thread[i]!.id, { position: i + 1, length: len });
        }
      }

      const sorted = [...intents].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const tutorialDir = join(outputDir, 'products', product.id, 'tutorials');
      for (const intent of sorted) {
        const persona = findPersona(product, intent.persona);
        const output = join(tutorialDir, `${intent.id}.md`);
        const read: string[] = [];
        if (persona.personaRules) read.push(persona.personaRules.absolutePath);
        read.push(persona.persona.absolutePath);
        read.push(intent.absolutePath);
        read.push(product.product.absolutePath);
        if (product.productRules) read.push(product.productRules.absolutePath);
        if (globalRulesPath) read.push(globalRulesPath);
        const tpl = pageTemplateIfExists(docspecDir, 'tutorial');
        if (tpl) read.push(tpl);
        for (const cid of intent.prereq_concepts) {
          try {
            const c = findConcept(product, cid);
            read.push(c.absolutePath);
          } catch (e) {
            if (e instanceof DocspecError) {
              throw new DocspecError(
                `Tutorial "${intent.id}" references unknown concept "${cid}" in prereq_concepts`,
                tutorialsErrorPath,
              );
            }
            throw e;
          }
        }
        for (const cid of intent.learns_concepts) {
          try {
            const c = findConcept(product, cid);
            read.push(c.absolutePath);
          } catch (e) {
            if (e instanceof DocspecError) {
              throw new DocspecError(
                `Tutorial "${intent.id}" references unknown concept "${cid}" in learns_concepts`,
                tutorialsErrorPath,
              );
            }
            throw e;
          }
        }
        if (intent.prereq_id != null) {
          const prereq = findTutorialById(intents, intent.prereq_id);
          if (!prereq) {
            throw new DocspecError(
              `Tutorial "${intent.id}" references unknown prereq_id "${intent.prereq_id}"`,
              tutorialsErrorPath,
            );
          }
          if (prereq.persona !== intent.persona) {
            throw new DocspecError(
              `Tutorial "${intent.id}" prereq_id "${intent.prereq_id}" must be a tutorial for the same persona ("${intent.persona}")`,
              tutorialsErrorPath,
            );
          }
          const thread = threadByPersona.get(intent.persona)!;
          const prereqIdx = thread.findIndex((x) => x.id === prereq.id);
          const selfIdx = thread.findIndex((x) => x.id === intent.id);
          if (prereqIdx < 0 || selfIdx < 0 || prereqIdx >= selfIdx) {
            throw new DocspecError(
              `Tutorial "${intent.id}" prereq_id must reference an earlier step in the same persona thread (sorted by order, then id)`,
              tutorialsErrorPath,
            );
          }
          const prereqOut = join(tutorialDir, `${prereq.id}.md`);
          read.push(prereqOut);
        }
        for (const hi of product.howTosManifest ?? []) {
          read.push(join(outputDir, 'products', product.id, 'how-tos', `${hi.id}.md`));
        }

        const posMeta = tutorialPositionMeta.get(intent.id);
        if (!posMeta) {
          throw new DocspecError(
            `Internal error: missing position meta for tutorial "${intent.id}"`,
            tutorialsErrorPath,
          );
        }

        entries.push({
          id: `tutorial--${product.id}--${intent.id}`,
          type: 'tutorials',
          output,
          read: dedupeRead(read),
          productId: product.id,
          personaId: intent.persona,
          taskIds: [],
          conceptId: null,
          tutorialPosition: posMeta.position,
          tutorialThreadLength: posMeta.length,
          generatedAt: null,
          outputHash: null,
          inputHashes: null,
        });
      }
    }
  };

  // Product landing: product + rules + all personas, persona rules, and tasks (navigation / overview inputs).
  const pushLandingEntries = (): void => {
    if (!settingsIncludeType(settings, 'landing-pages')) return;
    for (const product of parsed.products) {
      const output = join(outputDir, 'products', product.id, 'index.md');
      const read: string[] = [product.product.absolutePath];
      if (product.productRules) read.push(product.productRules.absolutePath);
      if (globalRulesPath) read.push(globalRulesPath);
      for (const pe of product.personas) {
        read.push(pe.persona.absolutePath);
        if (pe.personaRules) read.push(pe.personaRules.absolutePath);
        for (const t of pe.tasks) read.push(t.absolutePath);
      }
      const tpl = pageTemplateIfExists(docspecDir, 'landing');
      if (tpl) read.push(tpl);

      entries.push({
        id: `landing--${product.id}`,
        type: 'landing-pages',
        output,
        read: dedupeRead(read),
        productId: product.id,
        personaId: null,
        taskIds: [],
        conceptId: null,
        tutorialPosition: null,
        tutorialThreadLength: null,
        generatedAt: null,
        outputHash: null,
        inputHashes: null,
      });
    }
  };

  // Dependency order for downstream generation: references → concepts → how-tos → tutorials → landing.
  pushReferenceEntries();
  pushConceptEntries();
  pushHowToEntries();
  pushTutorialEntries();
  pushLandingEntries();

  return createManifestDocument({
    docspecDir,
    outputDir,
    projectDir,
    entries,
  });
}

export function createManifestDocument(params: {
  docspecDir: string;
  outputDir: string;
  projectDir: string;
  entries: ManifestDocument['entries'];
}): ManifestDocument {
  return {
    version: MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    docspecDir: params.docspecDir,
    outputDir: params.outputDir,
    projectDir: params.projectDir,
    entries: params.entries,
  };
}
