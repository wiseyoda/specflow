import { join } from 'path';
import type { AgentProvider } from './agent-provider';

/**
 * Normalize supported skill aliases to canonical dot form.
 * Examples:
 * - /flow.design -> flow.design
 * - flow.design -> flow.design
 * - $flow-design -> flow.design
 * - flow-design -> flow.design
 */
export function normalizeSkillIdentifier(input: string | null | undefined): string | null {
  if (!input) return null;

  const token = input
    .trim()
    .split(/\s+/)[0]
    .replace(/^[/$]+/, '')
    .toLowerCase();

  let core: string;
  if (token.startsWith('flow.')) {
    core = token.slice('flow.'.length);
  } else if (token.startsWith('flow-')) {
    core = token.slice('flow-'.length);
  } else {
    return null;
  }

  core = core.replace(/_/g, '-');
  if (core === 'tasks-to-issues') {
    core = 'taskstoissues';
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(core)) {
    return null;
  }

  return `flow.${core}`;
}

export function toSlashSkillCommand(input: string): string {
  const normalized = normalizeSkillIdentifier(input);
  return normalized ? `/${normalized}` : input;
}

export function toCodexSkillCommand(input: string): string {
  const normalized = normalizeSkillIdentifier(input);
  if (!normalized) return input;
  return `$${normalized.replace('.', '-')}`;
}

export function getSkillFilePath(
  provider: AgentProvider,
  homeDir: string,
  canonicalSkill: string
): string {
  if (provider === 'codex') {
    return join(homeDir, '.codex', 'skills', canonicalSkill.replace('.', '-'), 'SKILL.md');
  }

  return join(homeDir, '.claude', 'commands', `${canonicalSkill}.md`);
}

export function parseSkillWithContext(
  input: string
): { skillName: string | null; context: string | null } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { skillName: null, context: null };
  }

  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    const skillName = normalizeSkillIdentifier(trimmed);
    return skillName
      ? { skillName, context: null }
      : { skillName: null, context: trimmed };
  }

  const token = trimmed.slice(0, firstSpace);
  const context = trimmed.slice(firstSpace + 1).trim();
  const skillName = normalizeSkillIdentifier(token);

  if (skillName) {
    return { skillName, context: context || null };
  }

  return { skillName: null, context: trimmed };
}
