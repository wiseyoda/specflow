export const AGENT_PROVIDERS = ['claude', 'codex'] as const;
export type AgentProvider = typeof AGENT_PROVIDERS[number];

/**
 * Resolve active workflow provider from explicit input or environment.
 * Falls back to Claude for backwards compatibility.
 */
export function resolveAgentProvider(input?: string | null): AgentProvider {
  const raw = (
    input ||
    process.env.SPECFLOW_AGENT_PROVIDER ||
    process.env.AGENT_PROVIDER ||
    'claude'
  ).trim().toLowerCase();

  return raw === 'codex' ? 'codex' : 'claude';
}

export function getAgentBinary(provider: AgentProvider): string {
  return provider === 'codex' ? 'codex' : 'claude';
}

export function formatProviderName(provider: AgentProvider): string {
  return provider === 'codex' ? 'Codex' : 'Claude';
}
