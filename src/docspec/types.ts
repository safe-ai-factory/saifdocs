import type {
  ConceptFrontmatter,
  PageTemplateFrontmatter,
  ReferencePointerFrontmatter,
  TaskFrontmatter,
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

/** One how-to intent from `products/<id>/how-tos/<slug>.md`. */
export type HowToIntent = {
  id: string;
  persona: string;
  tasks: string[];
  goal?: string;
  body: string;
  absolutePath: string;
};

/** One tutorial intent assembled from `tutorials/*.md` and optional `index.yaml`. */
export type TutorialIntent = {
  id: string;
  persona: string;
  order: number;
  prereq_id: string | null;
  prereq_concepts: string[];
  learns_concepts: string[];
  goal?: string;
  body: string;
  absolutePath: string;
};

export type ProductEntry = {
  id: string;
  product: ProductFile;
  productRules: ProductRules | null;
  personas: PersonaEntry[];
  concepts: ConceptFile[];
  /** Absolute path to `how-tos/` when present; otherwise null. */
  howTosDirPath: string | null;
  howTosManifest: HowToIntent[] | null;
  /** Absolute path to `tutorials/` when present; otherwise null. */
  tutorialsDirPath: string | null;
  /** Absolute path to `tutorials/index.yaml` or `index.yml` when that file was used; otherwise null. */
  tutorialsOrderPath: string | null;
  tutorialsManifest: TutorialIntent[] | null;
};

export type ParsedDocspec = {
  globalRules: GlobalRules | null;
  pageTemplates: PageTemplate[];
  blockTemplates: BlockTemplate[];
  references: ReferencePointer[];
  products: ProductEntry[];
};
