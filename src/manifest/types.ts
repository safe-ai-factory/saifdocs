import type { RunSandboxPassthroughFields } from '../generation/run-sandbox.js';

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
  /** When set, passed as `--cedar` to `saifctl sandbox`. */
  cedarPolicyPath?: string;
  saifctlConfig?: string;
  /** Relative or absolute saifctl config directory (Cosmiconfig `saifctl` module). Default: saifctl */
  saifctlDir?: string;
  /** Max inner gate rounds for saifctl sandbox (default: 8). */
  gateRetries?: number;
  /** If true, skip invoking saifctl (manifest only). */
  dryRun?: boolean;
} & Partial<RunSandboxPassthroughFields>;
