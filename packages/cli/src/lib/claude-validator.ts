import { execSync } from 'child_process';

/**
 * Supported workflow agent providers.
 */
export type AgentProvider = 'claude' | 'codex';

/**
 * Result of agent CLI validation.
 */
export interface AgentValidationResult {
  available: boolean;
  path?: string;
  error?: string;
}

/**
 * Resolve provider from explicit input or environment.
 */
export function resolveAgentProvider(input?: string): AgentProvider {
  const raw = (
    input ||
    process.env.SPECFLOW_AGENT_PROVIDER ||
    process.env.AGENT_PROVIDER ||
    'claude'
  ).trim().toLowerCase();

  return raw === 'codex' ? 'codex' : 'claude';
}

/**
 * Validate that the selected agent CLI is installed and accessible.
 *
 * @returns Validation result with availability status.
 */
export function validateAgentCli(providerInput?: string): AgentValidationResult {
  const provider = resolveAgentProvider(providerInput);
  const binary = provider === 'codex' ? 'codex' : 'claude';
  const installHint = provider === 'codex'
    ? 'Codex CLI not found. Install Codex CLI and ensure `codex` is on PATH.'
    : 'Claude CLI not found. Install from https://claude.ai/code';

  try {
    const path = execSync(`which ${binary}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!path) {
      return {
        available: false,
        error: `${provider === 'codex' ? 'Codex' : 'Claude'} CLI not found in PATH`,
      };
    }

    return {
      available: true,
      path,
    };
  } catch {
    return {
      available: false,
      error: installHint,
    };
  }
}

/**
 * Assert that the selected agent CLI is available, throwing if not.
 *
 * @throws Error if CLI is not available.
 */
export function assertAgentCliAvailable(providerInput?: string): string {
  const result = validateAgentCli(providerInput);

  if (!result.available) {
    throw new Error(result.error);
  }

  return result.path!;
}

/**
 * Backward-compatible alias for existing imports.
 */
export type ClaudeValidationResult = AgentValidationResult;

/**
 * Backward-compatible wrapper (defaults to claude provider).
 */
export function validateClaudeCli(): ClaudeValidationResult {
  return validateAgentCli('claude');
}

/**
 * Backward-compatible wrapper (defaults to claude provider).
 */
export function assertClaudeCliAvailable(): string {
  return assertAgentCliAvailable('claude');
}
