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
  /**
   * ISO timestamp of when `outputHash` and `inputHashes` were last computed.
   * Informational — staleness is decided by hash comparison, not timestamp.
   * `null` means hashes haven't been populated (manifest just built; output
   * doesn't exist yet).
   */
  generatedAt: string | null;
  /**
   * SHA-256 hash of the output file's contents at the time hashes were
   * populated (typically right after `saifctl feat run` regenerated it).
   * `null` if the output file doesn't exist on disk.
   */
  outputHash: string | null;
  /**
   * SHA-256 hashes of each `read` path's contents at the time hashes were
   * populated, parallel to `read[]` (same length, same order). Missing
   * `read` files contribute `null` (validate skips those, matching the
   * previous mtime-based "missing reads ignored" behaviour).
   * `null` (the whole field) means hashes haven't been populated.
   */
  inputHashes: (string | null)[] | null;
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
