import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DOCSPEC_DIR = 'docspec';
export const DEFAULT_OUTPUT_DIR = 'docs';
export const MANIFEST_FILENAME = '.manifest.json';
export const REVIEW_CEDAR_FILENAME = 'review.cedar';
export const REVIEW_STRICT_CEDAR_FILENAME = 'review-strict.cedar';

export const MANIFEST_VERSION = 1;

/** Default max inner gate rounds for saifctl sandbox (matches saifctl's own default). */
export const DEFAULT_GATE_RETRIES = 10;

/** Saifdocs package root (directory containing `package.json`). */
export function getSaifdocsRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), '..');
}

/** `version` from this package's `package.json`. */
export function getSaifdocsPackageVersion(): string {
  const pkgPath = join(getSaifdocsRoot(), 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as { version?: string };
  if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
    throw new Error(`Missing or invalid "version" in ${pkgPath}`);
  }
  return pkg.version;
}

/** Packaged Leash policy for `saifdocs review` (sibling to dist/ in the package root). */
export function getDefaultReviewCedarPath(): string {
  return join(getSaifdocsRoot(), REVIEW_CEDAR_FILENAME);
}

/** Strict network allowlist for `saifdocs review --strict-network`. */
export function getDefaultReviewStrictCedarPath(): string {
  return join(getSaifdocsRoot(), REVIEW_STRICT_CEDAR_FILENAME);
}
