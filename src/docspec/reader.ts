/**
 * Walks a docspec directory tree, parses frontmatter / YAML manifests, and returns
 * {@link ParsedDocspec}. Missing optional paths are skipped; invalid schema or required
 * missing files throw {@link DocspecError} with the offending path.
 */
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import matter from 'gray-matter';
import yaml from 'js-yaml';

import { DocspecError } from './errors.js';
import {
  ConceptFrontmatterSchema,
  HowToFileFrontmatterSchema,
  PageTemplateFrontmatterSchema,
  ReferencePointerFrontmatterSchema,
  SlugSchema,
  TaskFrontmatterSchema,
  TutorialFileFrontmatterSchema,
  TutorialIndexEntrySchema,
} from './schema.js';
import type {
  BlockTemplate,
  ConceptFile,
  GlobalRules,
  HowToIntent,
  PageTemplate,
  ParsedDocspec,
  PersonaEntry,
  PersonaFile,
  PersonaRules,
  ProductEntry,
  ProductFile,
  ProductRules,
  ReferencePointer,
  TaskFile,
  TutorialIntent,
} from './types.js';

// --- helpers ---

/** True if `path` exists (any file type). */
async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** True if `path` is a directory. */
async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Split YAML frontmatter + markdown body (gray-matter); `data` validated per call site. */
async function readMarkdownFile(
  path: string,
): Promise<{ data: Record<string, unknown>; body: string }> {
  const raw = await readFile(path, 'utf8');
  const parsed = matter(raw);
  return { data: parsed.data as Record<string, unknown>, body: parsed.content };
}

/** Whole file is a YAML array of objects. */
function parseYamlListFile<T>(
  path: string,
  raw: string,
  itemSchema: { parse: (v: unknown) => T },
): T[] {
  const loaded = yaml.load(raw);
  if (!Array.isArray(loaded)) {
    throw new DocspecError('Expected YAML array at root', path);
  }
  return loaded.map((item, i) => {
    try {
      return itemSchema.parse(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DocspecError(`Invalid item at index ${i}: ${msg}`, path);
    }
  });
}

function slugifyStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveDocspecSlugId(
  explicit: string | undefined,
  fileStem: string,
  filePath: string,
): string {
  const candidate = explicit ?? slugifyStem(fileStem);
  if (!candidate) {
    throw new DocspecError(
      'Could not derive id from filename; add a lowercase kebab-case `id` in frontmatter',
      filePath,
    );
  }
  const r = SlugSchema.safeParse(candidate);
  if (!r.success) {
    const msg = r.error.issues[0]?.message ?? 'invalid slug';
    throw new DocspecError(`Invalid id "${candidate}": ${msg}`, filePath);
  }
  return candidate;
}

async function resolveTutorialsIndexPath(tutorialsDir: string): Promise<string | null> {
  const yamlPath = join(tutorialsDir, 'index.yaml');
  const ymlPath = join(tutorialsDir, 'index.yml');
  const hasYaml = await exists(yamlPath);
  const hasYml = await exists(ymlPath);
  if (hasYaml && hasYml) {
    throw new DocspecError(
      'Only one of tutorials/index.yaml or tutorials/index.yml may exist (both found)',
      yamlPath,
    );
  }
  if (hasYaml) return yamlPath;
  if (hasYml) return ymlPath;
  return null;
}

export async function readHowTosDir(howTosDir: string): Promise<HowToIntent[]> {
  const byId = new Map<string, HowToIntent>();
  for (const name of await readdir(howTosDir)) {
    if (!name.endsWith('.md')) continue;
    const absolutePath = join(howTosDir, name);
    if (!(await stat(absolutePath)).isFile()) continue;
    const stem = basename(name, '.md');
    const { data, body } = await readMarkdownFile(absolutePath);
    let frontmatter;
    try {
      frontmatter = HowToFileFrontmatterSchema.parse(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DocspecError(`Invalid how-to frontmatter: ${msg}`, absolutePath);
    }
    const id = resolveDocspecSlugId(frontmatter.id, stem, absolutePath);
    if (byId.has(id)) {
      throw new DocspecError(`Duplicate how-to id "${id}"`, absolutePath);
    }
    byId.set(id, {
      id,
      persona: frontmatter.persona,
      tasks: frontmatter.tasks,
      goal: frontmatter.goal,
      body,
      absolutePath,
    });
  }
  return [...byId.values()];
}

type Row = {
  id: string;
  persona: string;
  prereq_concepts: string[];
  learns_concepts: string[];
  goal?: string;
  body: string;
  absolutePath: string;
};

export async function readTutorialsDir(
  tutorialsDir: string,
): Promise<{ intents: TutorialIntent[]; orderPath: string | null }> {
  // Collect one intent per tutorial .md (id from frontmatter or slugified filename).
  const byId = new Map<string, Row>();
  for (const name of await readdir(tutorialsDir)) {
    if (!name.endsWith('.md')) continue;
    const absolutePath = join(tutorialsDir, name);
    if (!(await stat(absolutePath)).isFile()) continue;
    const stem = basename(name, '.md');
    const { data, body } = await readMarkdownFile(absolutePath);
    let frontmatter;
    try {
      frontmatter = TutorialFileFrontmatterSchema.parse(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DocspecError(`Invalid tutorial frontmatter: ${msg}`, absolutePath);
    }
    const id = resolveDocspecSlugId(frontmatter.id, stem, absolutePath);
    if (byId.has(id)) {
      throw new DocspecError(`Duplicate tutorial id "${id}"`, absolutePath);
    }
    byId.set(id, {
      id,
      persona: frontmatter.persona,
      prereq_concepts: frontmatter.prereq_concepts,
      learns_concepts: frontmatter.learns_concepts,
      goal: frontmatter.goal,
      body,
      absolutePath,
    });
  }

  const orderPath = await resolveTutorialsIndexPath(tutorialsDir);
  if (byId.size === 0) {
    // Empty tutorials/ is allowed (optional product section).
    return { intents: [], orderPath };
  }

  if (!orderPath) {
    // No index: stable order by id; prereq_id stays null (only index.yaml defines the thread).
    const sortedIds = [...byId.keys()].sort((a, b) => a.localeCompare(b));
    const intents: TutorialIntent[] = sortedIds.map((id, i) => {
      const row = byId.get(id)!;
      return {
        id: row.id,
        persona: row.persona,
        order: i + 1,
        prereq_id: null,
        prereq_concepts: row.prereq_concepts,
        learns_concepts: row.learns_concepts,
        goal: row.goal,
        body: row.body,
        absolutePath: row.absolutePath,
      };
    });
    return { intents, orderPath: null };
  }

  // With index: YAML supplies order + prereq_id; .md files supply persona, concepts, goal, body.
  const raw = (await readFile(orderPath, 'utf8')).trim();
  if (!raw) {
    throw new DocspecError('Tutorial index file is empty but tutorial .md files exist', orderPath);
  }
  const indexRows = parseYamlListFile(orderPath, raw, TutorialIndexEntrySchema);
  const seenIndex = new Set<string>();
  for (const row of indexRows) {
    if (seenIndex.has(row.id)) {
      throw new DocspecError(`Duplicate tutorial id "${row.id}" in index`, orderPath);
    }
    seenIndex.add(row.id);
  }

  // Index and disk must describe the same set of ids (no extras either way).
  const mdIds = new Set(byId.keys());
  const indexIds = new Set(indexRows.map((r) => r.id));
  for (const id of mdIds) {
    if (!indexIds.has(id)) {
      throw new DocspecError(
        `Tutorial "${id}" has a .md file but is not listed in the index (every tutorial must appear exactly once)`,
        byId.get(id)!.absolutePath,
      );
    }
  }
  for (const id of indexIds) {
    if (!mdIds.has(id)) {
      throw new DocspecError(
        `Index references unknown tutorial id "${id}" (no matching .md in tutorials/)`,
        orderPath,
      );
    }
  }

  const intents: TutorialIntent[] = indexRows.map((idx) => {
    const row = byId.get(idx.id)!;
    return {
      id: row.id,
      persona: row.persona,
      order: idx.order,
      prereq_id: idx.prereq_id ?? null,
      prereq_concepts: row.prereq_concepts,
      learns_concepts: row.learns_concepts,
      goal: row.goal,
      body: row.body,
      absolutePath: row.absolutePath,
    };
  });
  return { intents, orderPath };
}

export async function readDocspec(docspecDir: string): Promise<ParsedDocspec> {
  const root = docspecDir;

  // Optional global prose rules (no strict frontmatter schema).
  let globalRules: GlobalRules | null = null;
  const rulesPath = join(root, 'rules.md');
  if (await exists(rulesPath)) {
    const { body } = await readMarkdownFile(rulesPath);
    globalRules = { absolutePath: rulesPath, body };
  }

  // Page templates: optional `intent` in frontmatter; rest is body for generators.
  const pageTemplates: PageTemplate[] = [];
  const pagesDir = join(root, 'templates', 'pages');
  if (await exists(pagesDir)) {
    for (const name of await readdir(pagesDir)) {
      if (!name.endsWith('.md')) continue;
      const absolutePath = join(pagesDir, name);
      if (!(await stat(absolutePath)).isFile()) continue;
      const { data, body } = await readMarkdownFile(absolutePath);
      try {
        const frontmatter = PageTemplateFrontmatterSchema.parse(data);
        pageTemplates.push({
          id: basename(name, '.md'),
          absolutePath,
          frontmatter,
          body,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new DocspecError(`Invalid page template frontmatter: ${msg}`, absolutePath);
      }
    }
  }

  // Block templates: markdown snippets (e.g. example formatting); no required frontmatter.
  const blockTemplates: BlockTemplate[] = [];
  const blocksDir = join(root, 'templates', 'blocks');
  if (await exists(blocksDir)) {
    for (const name of await readdir(blocksDir)) {
      if (!name.endsWith('.md')) continue;
      const absolutePath = join(blocksDir, name);
      if ((await stat(absolutePath)).isFile()) {
        const { body } = await readMarkdownFile(absolutePath);
        blockTemplates.push({ id: basename(name, '.md'), absolutePath, body });
      }
    }
  }

  // Reference pointers: recursive *.md under references/; `source` + `type` in frontmatter.
  const references: ReferencePointer[] = [];
  const referencesRoot = join(root, 'references');
  if (await exists(referencesRoot)) {
    const walkRefs = async (dir: string): Promise<void> => {
      for (const name of await readdir(dir)) {
        const full = join(dir, name);
        if ((await stat(full)).isDirectory()) {
          await walkRefs(full);
          continue;
        }
        if (!name.endsWith('.md')) continue;
        const { data, body } = await readMarkdownFile(full);
        try {
          const frontmatter = ReferencePointerFrontmatterSchema.parse(data);
          references.push({
            id: basename(name, '.md'),
            relativePathUnderReferences: relative(referencesRoot, full).replace(/\\/g, '/'),
            absolutePath: full,
            frontmatter,
            body,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new DocspecError(`Invalid reference pointer frontmatter: ${msg}`, full);
        }
      }
    };
    await walkRefs(referencesRoot);
  }

  // Products: one folder per product id; requires product.md; optional rules.md.
  const products: ProductEntry[] = [];
  const productsRoot = join(root, 'products');
  if (await exists(productsRoot)) {
    for (const productId of await readdir(productsRoot)) {
      const productDir = join(productsRoot, productId);
      if (!(await isDir(productDir))) continue;

      const productMd = join(productDir, 'product.md');
      if (!(await exists(productMd))) {
        throw new DocspecError('Missing product.md', productMd);
      }
      const productParsed = await readMarkdownFile(productMd);
      const product: ProductFile = { absolutePath: productMd, body: productParsed.body };

      let productRules: ProductRules | null = null;
      const prPath = join(productDir, 'rules.md');
      if (await exists(prPath)) {
        const pr = await readMarkdownFile(prPath);
        productRules = { absolutePath: prPath, body: pr.body };
      }

      // Personas: personas/<id>/ requires persona.md; optional rules.md and tasks/*.md.
      const personas: PersonaEntry[] = [];
      const personasRoot = join(productDir, 'personas');
      if (await exists(personasRoot)) {
        for (const personaId of await readdir(personasRoot)) {
          const personaDir = join(personasRoot, personaId);
          if (!(await isDir(personaDir))) continue;

          const personaMd = join(personaDir, 'persona.md');
          if (!(await exists(personaMd))) {
            throw new DocspecError('Missing persona.md', personaMd);
          }
          const personaParsed = await readMarkdownFile(personaMd);
          const persona: PersonaFile = { absolutePath: personaMd, body: personaParsed.body };

          let personaRules: PersonaRules | null = null;
          const perRules = join(personaDir, 'rules.md');
          if (await exists(perRules)) {
            const prs = await readMarkdownFile(perRules);
            personaRules = { absolutePath: perRules, body: prs.body };
          }

          const tasks: TaskFile[] = [];
          const tasksDir = join(personaDir, 'tasks');
          if (await exists(tasksDir)) {
            for (const taskName of await readdir(tasksDir)) {
              if (!taskName.endsWith('.md')) continue;
              const taskPath = join(tasksDir, taskName);
              if (!(await stat(taskPath)).isFile()) continue;
              const { data, body } = await readMarkdownFile(taskPath);
              try {
                const frontmatter = TaskFrontmatterSchema.parse(data);
                tasks.push({
                  id: basename(taskName, '.md'),
                  absolutePath: taskPath,
                  frontmatter,
                  body,
                });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                throw new DocspecError(`Invalid task frontmatter: ${msg}`, taskPath);
              }
            }
          }

          personas.push({ id: personaId, persona, personaRules, tasks });
        }
      }

      // Concepts: concepts/<slug>.md with validated concept frontmatter.
      const concepts: ConceptFile[] = [];
      const conceptsDir = join(productDir, 'concepts');
      if (await exists(conceptsDir)) {
        for (const cname of await readdir(conceptsDir)) {
          if (!cname.endsWith('.md')) continue;
          const cpath = join(conceptsDir, cname);
          if (!(await stat(cpath)).isFile()) continue;
          const { data, body } = await readMarkdownFile(cpath);
          try {
            const frontmatter = ConceptFrontmatterSchema.parse(data);
            concepts.push({
              id: basename(cname, '.md'),
              absolutePath: cpath,
              frontmatter,
              body,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new DocspecError(`Invalid concept frontmatter: ${msg}`, cpath);
          }
        }
      }

      // Optional Diátaxis sections: absent dirs → null manifests; tutorialsOrderPath set only when index.yaml|yml exists.
      const howTosDir = join(productDir, 'how-tos');
      const howTosDirPath = (await isDir(howTosDir)) ? howTosDir : null;
      const howTosManifest = howTosDirPath ? await readHowTosDir(howTosDirPath) : null;

      const tutorialsDir = join(productDir, 'tutorials');
      const tutorialsDirPath = (await isDir(tutorialsDir)) ? tutorialsDir : null;
      let tutorialsManifest: TutorialIntent[] | null = null;
      let tutorialsOrderPath: string | null = null;
      if (tutorialsDirPath) {
        const tut = await readTutorialsDir(tutorialsDirPath);
        tutorialsManifest = tut.intents;
        tutorialsOrderPath = tut.orderPath;
      }

      products.push({
        id: productId,
        product,
        productRules,
        personas,
        concepts,
        howTosDirPath,
        howTosManifest,
        tutorialsDirPath,
        tutorialsOrderPath,
        tutorialsManifest,
      });
    }
  }

  return { globalRules, pageTemplates, blockTemplates, references, products };
}
