import type { RunSandboxPassthroughFields } from '../generation/run-sandbox.js';

/** Parsed from citty `args` (kebab-case keys) for {@link GenSettings} and `saifctl sandbox` spawn argv. */
export type SandboxPassthroughReadResult = Partial<RunSandboxPassthroughFields> & {
  cedarPolicyPath?: string;
};

/**
 * Reads saifctl sandbox passthrough flags from a citty args object (same keys as `sandboxPassthroughArgs`).
 */
export function readSandboxPassthroughFromCittyArgs(
  args: Record<string, unknown>,
): SandboxPassthroughReadResult {
  const str = (kebab: string, camel?: string): string | undefined => {
    const v = args[kebab] ?? (camel ? args[camel] : undefined);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const bool = (kebab: string, camel: string): boolean =>
    args[kebab] === true || args[camel] === true;

  const out: SandboxPassthroughReadResult = {};

  const model = str('model');
  if (model) out.model = model;
  const baseUrl = str('base-url', 'baseUrl');
  if (baseUrl) out.baseUrl = baseUrl;
  const agent = str('agent');
  if (agent) out.agent = agent;
  const agentScript = str('agent-script', 'agentScript');
  if (agentScript) out.agentScript = agentScript;
  const agentInstallScript = str('agent-install-script', 'agentInstallScript');
  if (agentInstallScript) out.agentInstallScript = agentInstallScript;
  const profile = str('profile');
  if (profile) out.profile = profile;
  const startupScript = str('startup-script', 'startupScript');
  if (startupScript) out.startupScript = startupScript;
  const coderImage = str('coder-image', 'coderImage');
  if (coderImage) out.coderImage = coderImage;
  const engine = str('engine');
  if (engine) out.engine = engine;
  const sandboxBaseDir = str('sandbox-base-dir', 'sandboxBaseDir');
  if (sandboxBaseDir) out.sandboxBaseDir = sandboxBaseDir;
  const agentEnv = str('agent-env', 'agentEnv');
  if (agentEnv) out.agentEnv = agentEnv;
  const agentEnvFile = str('agent-env-file', 'agentEnvFile');
  if (agentEnvFile) out.agentEnvFile = agentEnvFile;
  const agentSecret = str('agent-secret', 'agentSecret');
  if (agentSecret) out.agentSecret = agentSecret;
  const agentSecretFile = str('agent-secret-file', 'agentSecretFile');
  if (agentSecretFile) out.agentSecretFile = agentSecretFile;

  const cedar = str('cedar');
  if (cedar) out.cedarPolicyPath = cedar;

  if (bool('dangerous-no-leash', 'dangerousNoLeash')) out.dangerousNoLeash = true;
  if (bool('verbose', 'verbose') || args.v === true) out.verbose = true;

  return out;
}
