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
  HowToIntentSchema,
  PageTemplateFrontmatterSchema,
  ReferencePointerFrontmatterSchema,
  TaskFrontmatterSchema,
  TutorialIntentSchema,
} from './schema.js';
import type {
  BlockTemplate,
  ConceptFile,
  GlobalRules,
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

/** Resolve `how-tos` / `tutorials` manifest: `*.yaml` or `*.yml` (not both). */
export async function resolveProductYamlManifestPath(
  productDir: string,
  stem: 'how-tos' | 'tutorials',
): Promise<string | null> {
  const yamlPath = join(productDir, `${stem}.yaml`);
  const ymlPath = join(productDir, `${stem}.yml`);
  const hasYaml = await exists(yamlPath);
  const hasYml = await exists(ymlPath);
  if (hasYaml && hasYml) {
    throw new DocspecError(
      `Only one of ${stem}.yaml or ${stem}.yml may exist (both found)`,
      yamlPath,
    );
  }
  if (hasYaml) return yamlPath;
  if (hasYml) return ymlPath;
  return null;
}

/** `how-tos.{yaml,yml}` / `tutorials.{yaml,yml}`: whole file is a YAML array of intent objects. */
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

/** Missing file → `null`; empty file → `[]`. */
async function readOptionalYamlManifest<T>(
  path: string,
  itemSchema: { parse: (v: unknown) => T },
): Promise<T[] | null> {
  if (!(await exists(path))) return null;
  const raw = (await readFile(path, 'utf8')).trim();
  if (!raw) return [];
  return parseYamlListFile(path, raw, itemSchema);
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

      // Declarative links from product → how-tos / tutorials (YAML lists at product root).
      const howTosPath = await resolveProductYamlManifestPath(productDir, 'how-tos');
      const tutorialsPath = await resolveProductYamlManifestPath(productDir, 'tutorials');
      const howTosManifest = howTosPath
        ? await readOptionalYamlManifest(howTosPath, HowToIntentSchema)
        : null;
      const tutorialsManifest = tutorialsPath
        ? await readOptionalYamlManifest(tutorialsPath, TutorialIntentSchema)
        : null;

      products.push({
        id: productId,
        product,
        productRules,
        personas,
        concepts,
        howTosManifestPath: howTosPath,
        howTosManifest,
        tutorialsManifestPath: tutorialsPath,
        tutorialsManifest,
      });
    }
  }

  return { globalRules, pageTemplates, blockTemplates, references, products };
}
