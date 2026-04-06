/**
 * Spawn `node <saifctl>/dist/cli.js sandbox ...` for reference doc generation.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { RunSubtaskInput } from '@safe-ai-factory/saifctl';

import { consola } from '../logger.js';

const require = createRequire(import.meta.url);

/** Printable command line (argv-shaped) for logs and copy-paste. */
export function formatSaifctlSpawnCommand(nodePath: string, args: string[]): string {
  return [nodePath, ...args].map((a) => JSON.stringify(a)).join(' ');
}

export function resolveSaifctlCliJs(): string {
  // Resolve the package main (exports "." → dist/index.js); do not use
  // @safe-ai-factory/saifctl/package.json — it is not listed in "exports".
  const mainEntry = require.resolve('@safe-ai-factory/saifctl');
  return join(dirname(mainEntry), 'cli.js');
}

/** Options mirrored from `saifctl sandbox` / feat run (forwarded as CLI flags). */
export type RunSandboxPassthroughFields = {
  model?: string;
  baseUrl?: string;
  agent?: string;
  agentScript?: string;
  agentInstallScript?: string;
  profile?: string;
  startupScript?: string;
  coderImage?: string;
  engine?: string;
  dangerousNoLeash?: boolean;
  sandboxBaseDir?: string;
  agentEnv?: string;
  agentEnvFile?: string;
  agentSecret?: string;
  agentSecretFile?: string;
  verbose?: boolean;
};

type RunSandboxCliOptsBase = {
  projectDir: string;
  saifctlDir: string;
  /** When set, passed as `--cedar` to saifctl sandbox (Leash policy path). */
  cedarPolicyPath?: string;
  /** When set, passed as `--saifctl-config` to saifctl sandbox. */
  saifctlConfig?: string;
  /**
   * Absolute path to saifctl `dist/cli.js`. When unset, resolved from the installed
   * `@safe-ai-factory/saifctl` main entry (`dist/index.js` → sibling `cli.js`).
   */
  cliExecutable?: string;
  extractInclude: string;
  name: string;
  gateRetries: number;
} & RunSandboxPassthroughFields;

export type RunSandboxCliOpts =
  | (RunSandboxCliOptsBase & { taskFile: string; gateScript: string; subtasksFile?: never })
  | (RunSandboxCliOptsBase & { subtasksFile: string; taskFile?: never; gateScript?: never });

/**
 * Writes `subtasks.json` under a new temp directory and returns its absolute path.
 * Caller may delete the parent directory to clean up (optional).
 */
export async function buildSubtasksJsonFile(subtasks: RunSubtaskInput[]): Promise<string> {
  const tmpBase = await mkdtemp(join(tmpdir(), 'saifdocs-subtasks-'));
  const filePath = join(tmpBase, 'subtasks.json');
  await writeFile(filePath, `${JSON.stringify(subtasks, null, 2)}\n`, 'utf8');
  return filePath;
}

/**
 * Runs saifctl sandbox with extract filtered to `extractInclude` prefix. Resolves when process exits 0.
 */
export function runSaifctlSandboxCli(opts: RunSandboxCliOpts): Promise<{ code: number | null }> {
  const cliJs = opts.cliExecutable ?? resolveSaifctlCliJs();
  const args: string[] = [
    cliJs,
    'sandbox',
    '--project-dir',
    opts.projectDir,
    '--saifctl-dir',
    opts.saifctlDir,
  ];
  if (opts.saifctlConfig) {
    args.push('--saifctl-config', opts.saifctlConfig);
  }
  if (opts.cedarPolicyPath?.trim()) {
    args.push('--cedar', opts.cedarPolicyPath.trim());
  }

  if ('subtasksFile' in opts && opts.subtasksFile) {
    args.push('--subtasks', opts.subtasksFile);
  } else {
    const { taskFile, gateScript } = opts as Extract<
      RunSandboxCliOpts,
      { taskFile: string; gateScript: string }
    >;
    args.push('--task-file', taskFile, '--gate-script', gateScript);
  }

  args.push(
    '--extract',
    '--extract-include',
    opts.extractInclude,
    '--gate-retries',
    String(opts.gateRetries),
    '--name',
    opts.name,
  );

  // Passthrough args to saifctl sandbox CLI.
  const pushOpt = (flag: string, value: string | undefined) => {
    const t = value?.trim();
    if (t) args.push(flag, t);
  };
  pushOpt('--model', opts.model);
  pushOpt('--base-url', opts.baseUrl);
  pushOpt('--agent', opts.agent);
  pushOpt('--agent-script', opts.agentScript);
  pushOpt('--agent-install-script', opts.agentInstallScript);
  pushOpt('--profile', opts.profile);
  pushOpt('--startup-script', opts.startupScript);
  pushOpt('--coder-image', opts.coderImage);
  pushOpt('--engine', opts.engine);
  pushOpt('--sandbox-base-dir', opts.sandboxBaseDir);
  pushOpt('--agent-env', opts.agentEnv);
  pushOpt('--agent-env-file', opts.agentEnvFile);
  pushOpt('--agent-secret', opts.agentSecret);
  pushOpt('--agent-secret-file', opts.agentSecretFile);
  if (opts.dangerousNoLeash === true) args.push('--dangerous-no-leash');
  if (opts.verbose === true) args.push('--verbose');

  consola.info(`[saifdocs] saifctl sandbox: ${formatSaifctlSpawnCommand(process.execPath, args)}`);

  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd: opts.projectDir,
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('error', (err) => {
      console.error('[saifdocs] Failed to spawn saifctl:', err);
      resolvePromise({ code: 1 });
    });
    child.on('close', (code) => {
      resolvePromise({ code });
    });
  });
}
