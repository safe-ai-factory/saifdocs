import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';

import type { RunSubtaskInput } from '@safe-ai-factory/saifctl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildSubtasksJsonFile,
  formatSaifctlSpawnCommand,
  runSaifctlSandboxCli,
} from './run-sandbox.js';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

describe('formatSaifctlSpawnCommand', () => {
  it('joins node path and args with JSON quoting for spaces', () => {
    expect(formatSaifctlSpawnCommand('/usr/bin/node', ['/path/with space/cli.js', 'sandbox'])).toBe(
      '"/usr/bin/node" "/path/with space/cli.js" "sandbox"',
    );
  });
});

describe('runSaifctlSandboxCli', () => {
  afterEach(() => {
    mockSpawn.mockReset();
  });

  it('includes --saifctl-config when saifctlConfig is set', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: null,
      stdout: null,
      stderr: null,
    });
    mockSpawn.mockReturnValue(child as never);

    const done = runSaifctlSandboxCli({
      projectDir: '/p',
      saifctlDir: 'saifctl',
      cliExecutable: '/fake/saifctl/dist/cli.js',
      saifctlConfig: '/etc/saif.yaml',
      taskFile: '/tmp/task.md',
      gateScript: '/tmp/gate.sh',
      extractInclude: 'docs',
      name: 'test-run',
      gateRetries: 3,
    });

    child.emit('close', 0);
    await done;

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const argv = mockSpawn.mock.calls[0]![1] as string[];
    const idx = argv.indexOf('--saifctl-config');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(argv[idx + 1]).toBe('/etc/saif.yaml');
  });

  it('omits --saifctl-config when saifctlConfig is undefined', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: null,
      stdout: null,
      stderr: null,
    });
    mockSpawn.mockReturnValue(child as never);

    const done = runSaifctlSandboxCli({
      projectDir: '/p',
      saifctlDir: 'saifctl',
      cliExecutable: '/fake/saifctl/dist/cli.js',
      taskFile: '/tmp/task.md',
      gateScript: '/tmp/gate.sh',
      extractInclude: 'docs',
      name: 'test-run',
      gateRetries: 3,
    });

    child.emit('close', 0);
    await done;

    const argv = mockSpawn.mock.calls[0]![1] as string[];
    expect(argv).not.toContain('--saifctl-config');
  });

  it('includes --cedar when cedarPolicyPath is set', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: null,
      stdout: null,
      stderr: null,
    });
    mockSpawn.mockReturnValue(child as never);

    const done = runSaifctlSandboxCli({
      projectDir: '/p',
      saifctlDir: 'saifctl',
      cliExecutable: '/fake/saifctl/dist/cli.js',
      cedarPolicyPath: '/policies/review.cedar',
      taskFile: '/tmp/task.md',
      gateScript: '/tmp/gate.sh',
      extractInclude: 'docs/review',
      name: 'test-run',
      gateRetries: 3,
    });

    child.emit('close', 0);
    await done;

    const argv = mockSpawn.mock.calls[0]![1] as string[];
    const idx = argv.indexOf('--cedar');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(argv[idx + 1]).toBe('/policies/review.cedar');
  });

  it('passes --subtasks instead of --task-file and --gate-script when subtasksFile is set', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: null,
      stdout: null,
      stderr: null,
    });
    mockSpawn.mockReturnValue(child as never);

    const done = runSaifctlSandboxCli({
      projectDir: '/p',
      saifctlDir: 'saifctl',
      cliExecutable: '/fake/saifctl/dist/cli.js',
      subtasksFile: '/tmp/subtasks.json',
      extractInclude: 'docs',
      name: 'test-phase',
      gateRetries: 5,
    });

    child.emit('close', 0);
    await done;

    const argv = mockSpawn.mock.calls[0]![1] as string[];
    expect(argv).toContain('--subtasks');
    expect(argv[argv.indexOf('--subtasks') + 1]).toBe('/tmp/subtasks.json');
    expect(argv).not.toContain('--task-file');
    expect(argv).not.toContain('--gate-script');
  });

  it('passes --model and --verbose when set', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: null,
      stdout: null,
      stderr: null,
    });
    mockSpawn.mockReturnValue(child as never);

    const done = runSaifctlSandboxCli({
      projectDir: '/p',
      saifctlDir: 'saifctl',
      cliExecutable: '/fake/saifctl/dist/cli.js',
      subtasksFile: '/tmp/subtasks.json',
      extractInclude: 'docs',
      name: 'test-phase',
      gateRetries: 5,
      model: 'anthropic/claude-3-5-sonnet',
      verbose: true,
    });

    child.emit('close', 0);
    await done;

    const argv = mockSpawn.mock.calls[0]![1] as string[];
    const mi = argv.indexOf('--model');
    expect(mi).toBeGreaterThan(-1);
    expect(argv[mi + 1]).toBe('anthropic/claude-3-5-sonnet');
    expect(argv).toContain('--verbose');
  });

  it('still passes --gate-retries in subtasks mode', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: null,
      stdout: null,
      stderr: null,
    });
    mockSpawn.mockReturnValue(child as never);

    const done = runSaifctlSandboxCli({
      projectDir: '/p',
      saifctlDir: 'saifctl',
      cliExecutable: '/fake/saifctl/dist/cli.js',
      subtasksFile: '/tmp/subtasks.json',
      extractInclude: 'docs',
      name: 'test-phase',
      gateRetries: 7,
    });

    child.emit('close', 0);
    await done;

    const argv = mockSpawn.mock.calls[0]![1] as string[];
    const idx = argv.indexOf('--gate-retries');
    expect(idx).toBeGreaterThan(-1);
    expect(argv[idx + 1]).toBe('7');
  });
});

describe('buildSubtasksJsonFile', () => {
  it('writes valid JSON array to a temp file and returns its path', async () => {
    const subtasks: RunSubtaskInput[] = [
      { title: 'Task 1', content: 'Do X', gateScript: '#!/bin/bash\nexit 0', gateRetries: 2 },
      { content: 'Do Y' },
    ];
    const filePath = await buildSubtasksJsonFile(subtasks);
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as RunSubtaskInput[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.title).toBe('Task 1');
    expect(parsed[1]!.content).toBe('Do Y');
  });
});
