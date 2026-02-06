import { describe, expect, it } from 'vitest';
import {
  normalizeSkillIdentifier,
  parseSkillWithContext,
  toCodexSkillCommand,
  toSlashSkillCommand,
} from '@/lib/skill-utils';

describe('normalizeSkillIdentifier', () => {
  it('normalizes all supported aliases to canonical flow.<name>', () => {
    expect(normalizeSkillIdentifier('/flow.design')).toBe('flow.design');
    expect(normalizeSkillIdentifier('flow.design')).toBe('flow.design');
    expect(normalizeSkillIdentifier('$flow-design')).toBe('flow.design');
    expect(normalizeSkillIdentifier('flow-design')).toBe('flow.design');
  });

  it('normalizes tasks-to-issues variant', () => {
    expect(normalizeSkillIdentifier('$flow-tasks-to-issues')).toBe('flow.taskstoissues');
  });

  it('returns null for non-skill input', () => {
    expect(normalizeSkillIdentifier('hello there')).toBeNull();
    expect(normalizeSkillIdentifier('')).toBeNull();
    expect(normalizeSkillIdentifier(undefined)).toBeNull();
  });
});

describe('parseSkillWithContext', () => {
  it('parses codex alias + context', () => {
    expect(parseSkillWithContext('$flow-design add details')).toEqual({
      skillName: 'flow.design',
      context: 'add details',
    });
  });

  it('parses canonical skill without context', () => {
    expect(parseSkillWithContext('flow.orchestrate')).toEqual({
      skillName: 'flow.orchestrate',
      context: null,
    });
  });

  it('treats plain text as context-only input', () => {
    expect(parseSkillWithContext('please continue')).toEqual({
      skillName: null,
      context: 'please continue',
    });
  });
});

describe('command render helpers', () => {
  it('renders provider-specific skill command formats', () => {
    expect(toSlashSkillCommand('flow.design')).toBe('/flow.design');
    expect(toCodexSkillCommand('flow.design')).toBe('$flow-design');
  });
});

