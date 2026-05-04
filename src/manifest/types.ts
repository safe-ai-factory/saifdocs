export type OutputType = 'references' | 'concepts' | 'how-tos' | 'tutorials' | 'landing-pages';

export type ManifestEntry = {
  id: string;
  type: OutputType;
  output: string;
  read: string[];
  productId: string | null;
  personaId: string | null;
  /** Task stems referenced by a how-to (empty for non-how-to entries). */
  taskIds: string[];
  conceptId: string | null;
  /** 1-based position within this tutorial thread. */
  tutorialPosition: number | null;
  /** Number of tutorials in this tutorial thread. */
  tutorialThreadLength: number | null;
  generatedAt: string | null;
};

export type ManifestDocument = {
  version: number;
  createdAt: string;
  docspecDir: string;
  outputDir: string;
  projectDir: string;
  entries: ManifestEntry[];
};

export type GenSettings = {
  docspecDir: string;
  outputDir: string;
  projectDir: string;
  types: OutputType[] | 'all';
  /** If true, build the manifest only; do not emit a feature tree. */
  dryRun?: boolean;
};
