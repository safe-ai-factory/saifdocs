/**
 * Feature-id generator for compiled saifctl feature dirs.
 *
 * Default: `saifdocs-<ISO-8601-no-colons>` — e.g. `saifdocs-2026-05-04T10-30-45-123Z`.
 * The `:` characters in standard ISO-8601 are replaced with `-` so the id is
 * filesystem-safe across all platforms (Windows in particular dislikes `:` in
 * dir names) AND remains lexicographically sortable.
 *
 * Override via `featureId` opt on `compileManifestToFeatureTree`. Override
 * must satisfy `validateFeatureId()` (lowercase, kebab-case, filesystem-safe).
 */

const FEATURE_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const MAX_FEATURE_ID_LEN = 100;

/** Generate the default timestamped feature id (`saifdocs-<ISO>` with colons replaced). */
export function generateTimestampFeatureId(now: Date = new Date()): string {
  const iso = now.toISOString(); // e.g. 2026-05-04T10:30:45.123Z
  const safe = iso.replace(/:/g, '-').replace(/\./g, '-');
  return `saifdocs-${safe}`;
}

/**
 * Validate a user-supplied feature id. Must be:
 *  - 1..100 chars
 *  - lowercase letters, digits, and `-` only
 *  - cannot start or end with `-`
 *  - not contain consecutive `-` (kebab-case)
 */
export function validateFeatureId(id: string): { ok: true } | { ok: false; reason: string } {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, reason: 'feature id must be a non-empty string' };
  }
  if (id.length > MAX_FEATURE_ID_LEN) {
    return {
      ok: false,
      reason: `feature id too long (${id.length} > ${MAX_FEATURE_ID_LEN} chars)`,
    };
  }
  if (id.includes('--')) {
    return { ok: false, reason: 'feature id must not contain consecutive "-" (use kebab-case)' };
  }
  if (!FEATURE_ID_PATTERN.test(id)) {
    return {
      ok: false,
      reason: 'feature id must contain only letters, digits, and "-"; cannot start or end with "-"',
    };
  }
  return { ok: true };
}

/** Throws if invalid; returns the id unchanged otherwise. */
export function assertValidFeatureId(id: string): string {
  const result = validateFeatureId(id);
  if (!result.ok) {
    throw new Error(`Invalid feature id "${id}": ${result.reason}`);
  }
  return id;
}
