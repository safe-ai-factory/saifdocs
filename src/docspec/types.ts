import type {
  ConceptFrontmatter,
  HowToIntent,
  PageTemplateFrontmatter,
  ReferencePointerFrontmatter,
  TaskFrontmatter,
  TutorialIntent,
} from './schema.js';

export type GlobalRules = {
  absolutePath: string;
  body: string;
};

export type PageTemplate = {
  id: string;
  absolutePath: string;
  frontmatter: PageTemplateFrontmatter;
  body: string;
};

export type BlockTemplate = {
  id: string;
  absolutePath: string;
  body: string;
};

export type ReferencePointer = {
  id: string;
  relativePathUnderReferences: string;
  absolutePath: string;
  frontmatter: ReferencePointerFrontmatter;
  body: string;
};

export type ProductFile = {
  absolutePath: string;
  body: string;
};

export type ProductRules = {
  absolutePath: string;
  body: string;
};

export type PersonaFile = {
  absolutePath: string;
  body: string;
};

export type PersonaRules = {
  absolutePath: string;
  body: string;
};

export type TaskFile = {
  id: string;
  absolutePath: string;
  frontmatter: TaskFrontmatter;
  body: string;
};

export type ConceptFile = {
  id: string;
  absolutePath: string;
  frontmatter: ConceptFrontmatter;
  body: string;
};

export type PersonaEntry = {
  id: string;
  persona: PersonaFile;
  personaRules: PersonaRules | null;
  tasks: TaskFile[];
};

export type ProductEntry = {
  id: string;
  product: ProductFile;
  productRules: ProductRules | null;
  personas: PersonaEntry[];
  concepts: ConceptFile[];
  /** Absolute path to `how-tos.yaml` or `how-tos.yml` when that manifest was read; otherwise null. */
  howTosManifestPath: string | null;
  howTosManifest: HowToIntent[] | null;
  /** Absolute path to `tutorials.yaml` or `tutorials.yml` when that manifest was read; otherwise null. */
  tutorialsManifestPath: string | null;
  tutorialsManifest: TutorialIntent[] | null;
};

export type ParsedDocspec = {
  globalRules: GlobalRules | null;
  pageTemplates: PageTemplate[];
  blockTemplates: BlockTemplate[];
  references: ReferencePointer[];
  products: ProductEntry[];
};
