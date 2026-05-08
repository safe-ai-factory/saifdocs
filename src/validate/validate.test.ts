import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { MANIFEST_VERSION } from '../constants.js';
import type { ManifestDocument, ManifestEntry } from '../manifest/types.js';
import { validateManifest } from './validate.js';

function sha256(content: string): string {
  return createHash('sha256').update(Buffer.from(content)).digest('hex');
}

describe('validateManifest', () => {
  const docspecDir = join(tmpdir(), `saifdocs-validate-${process.pid}`);
  const inputPath = join(docspecDir, 'input.md');
  const outputPath = join(docspecDir, 'out.md');

  afterEach(async () => {
    await rm(docspecDir, { recursive: true, force: true }).catch(() => {});
  });

  async function setupFiles(opts: {
    inputContent?: string;
    outputContent?: string;
  }): Promise<void> {
    await mkdir(docspecDir, { recursive: true });
    if (opts.inputContent !== undefined) {
      await writeFile(inputPath, opts.inputContent, 'utf8');
    }
    if (opts.outputContent !== undefined) {
      await writeFile(outputPath, opts.outputContent, 'utf8');
    }
  }

  function makeManifest(
    entry: Partial<ManifestEntry> & Pick<ManifestEntry, 'id' | 'type'>,
  ): ManifestDocument {
    const full: ManifestEntry = {
      id: entry.id,
      type: entry.type,
      output: entry.output ?? outputPath,
      read: entry.read ?? [inputPath],
      productId: entry.productId ?? null,
      personaId: entry.personaId ?? null,
      taskIds: entry.taskIds ?? [],
      conceptId: entry.conceptId ?? null,
      tutorialPosition: entry.tutorialPosition ?? null,
      tutorialThreadLength: entry.tutorialThreadLength ?? null,
      generatedAt: entry.generatedAt ?? null,
      outputHash: entry.outputHash ?? null,
      inputHashes: entry.inputHashes ?? null,
    };
    return {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir,
      outputDir: join(docspecDir, 'docs'),
      projectDir: docspecDir,
      entries: [full],
    };
  }

  it('counts hashes-not-populated as stale (never generated)', async () => {
    await setupFiles({ inputContent: 'content', outputContent: 'out' });
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        outputHash: null,
        inputHashes: null,
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.id).toBe('e1');
    expect(r.stale[0]!.staleInputs).toContain('(never generated)');
    expect(r.skipped).toBe(0);
    expect(r.upToDate).toBe(0);
  });

  it('marks stale when a `read` path content has changed since hashes were recorded', async () => {
    await setupFiles({ inputContent: 'new content', outputContent: 'out' });
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        outputHash: sha256('out'),
        inputHashes: [sha256('original content')],
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.staleInputs).toContain(inputPath);
    expect(r.upToDate).toBe(0);
  });

  it('marks up-to-date when current hashes equal recorded hashes', async () => {
    await setupFiles({ inputContent: 'content', outputContent: 'out' });
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        outputHash: sha256('out'),
        inputHashes: [sha256('content')],
      }),
    );
    expect(r.stale).toHaveLength(0);
    expect(r.upToDate).toBe(1);
  });

  it('marks stale when the output file content changed externally', async () => {
    await setupFiles({ inputContent: 'content', outputContent: 'tampered' });
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        outputHash: sha256('out'),
        inputHashes: [sha256('content')],
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.staleInputs).toContain('(output file modified externally)');
    expect(r.upToDate).toBe(0);
  });

  it('ignores missing read paths (does not mark stale)', async () => {
    await setupFiles({ outputContent: 'out' });
    const missing = join(docspecDir, 'nope.md');
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        read: [missing],
        outputHash: sha256('out'),
        inputHashes: [null],
      }),
    );
    expect(r.stale).toHaveLength(0);
    expect(r.upToDate).toBe(1);
  });

  it('marks stale when output file is missing even if hashes are populated', async () => {
    await setupFiles({ inputContent: 'content' });
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        output: join(docspecDir, 'nonexistent-output.md'),
        outputHash: sha256('out'),
        inputHashes: [sha256('content')],
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.staleInputs).toContain('(output file missing)');
    expect(r.upToDate).toBe(0);
  });

  it('marks stale when the read list length differs from inputHashes length', async () => {
    await setupFiles({ inputContent: 'content', outputContent: 'out' });
    const otherInput = join(docspecDir, 'other.md');
    await writeFile(otherInput, 'other', 'utf8');
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        read: [inputPath, otherInput],
        outputHash: sha256('out'),
        // Only one hash recorded for two read paths — last gen saw a different
        // read list, so this entry must be re-hashed.
        inputHashes: [sha256('content')],
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.staleInputs).toContain('(read list changed since last gen)');
  });

  it('treats a previously-missing-now-present read path as a change', async () => {
    await setupFiles({ inputContent: 'content', outputContent: 'out' });
    const r = await validateManifest(
      makeManifest({
        id: 'e1',
        type: 'references',
        outputHash: sha256('out'),
        inputHashes: [null], // last gen saw the file as missing
      }),
    );
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]!.staleInputs).toContain(inputPath);
  });

  it('filters by types', async () => {
    await setupFiles({ inputContent: 'content' });
    const o1 = join(docspecDir, 'o1.md');
    const o2 = join(docspecDir, 'o2.md');
    await writeFile(o1, 'o1', 'utf8');
    await writeFile(o2, 'o2', 'utf8');

    const manifest: ManifestDocument = {
      version: MANIFEST_VERSION,
      createdAt: '2020-01-01T00:00:00.000Z',
      docspecDir,
      outputDir: join(docspecDir, 'docs'),
      projectDir: docspecDir,
      entries: [
        {
          id: 'ref1',
          type: 'references',
          output: o1,
          read: [inputPath],
          productId: null,
          personaId: null,
          taskIds: [],
          conceptId: null,
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2025-01-01T00:00:00.000Z',
          outputHash: sha256('o1'),
          // Recorded a different content for the input → stale.
          inputHashes: [sha256('older content')],
        },
        {
          id: 'c1',
          type: 'concepts',
          output: o2,
          read: [inputPath],
          productId: 'p',
          personaId: null,
          taskIds: [],
          conceptId: 'c',
          tutorialPosition: null,
          tutorialThreadLength: null,
          generatedAt: '2025-01-01T00:00:00.000Z',
          outputHash: sha256('o2'),
          inputHashes: [sha256('older content')],
        },
      ],
    };

    const refsOnly = await validateManifest(manifest, { types: ['references'] });
    expect(refsOnly.stale).toHaveLength(1);
    expect(refsOnly.stale[0]!.id).toBe('ref1');
    expect(refsOnly.skipped).toBe(1);

    const conceptsOnly = await validateManifest(manifest, { types: ['concepts'] });
    expect(conceptsOnly.stale).toHaveLength(1);
    expect(conceptsOnly.stale[0]!.id).toBe('c1');
    expect(conceptsOnly.skipped).toBe(1);
  });
});
