import { NextResponse } from 'next/server';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { resolveAgentProvider, type AgentProvider } from '@/lib/agent-provider';
import {
  getSkillFilePath,
  normalizeSkillIdentifier,
  toCodexSkillCommand,
  toSlashSkillCommand,
} from '@/lib/skill-utils';

interface WorkflowSkill {
  id: string;
  name: string;
  command: string;
  description: string;
  group: 'primary' | 'workflow' | 'setup' | 'maintenance';
  isPrimary: boolean;
  provider: AgentProvider;
}

/**
 * GET /api/workflow/skills
 *
 * Discover skills for the selected agent provider:
 * - Claude: ~/.claude/commands/flow.*.md
 * - Codex: ~/.codex/skills/flow-{name}/SKILL.md
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = resolveAgentProvider(searchParams.get('provider'));
    const skills = loadProviderSkills(provider);
    sortSkills(skills);

    return NextResponse.json({
      provider,
      skills,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function loadProviderSkills(provider: AgentProvider): WorkflowSkill[] {
  const homeDir = process.env.HOME || '';

  if (provider === 'codex') {
    const skillsDir = join(homeDir, '.codex', 'skills');
    if (!existsSync(skillsDir)) return [];

    const entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('flow-'));

    return entries
      .map((entry) => {
        const canonicalId = normalizeSkillIdentifier(entry.name);
        if (!canonicalId) return null;

        const skillPath = getSkillFilePath(provider, homeDir, canonicalId);
        if (!existsSync(skillPath) || !statSync(skillPath).isFile()) {
          return null;
        }

        const shortName = canonicalId.replace('flow.', '');
        return buildSkillRecord(provider, canonicalId, shortName, skillPath);
      })
      .filter((skill): skill is WorkflowSkill => skill !== null);
  }

  const commandsDir = join(homeDir, '.claude', 'commands');
  if (!existsSync(commandsDir)) return [];

  const files = readdirSync(commandsDir).filter(
    (file) => file.startsWith('flow.') && file.endsWith('.md')
  );

  return files
    .map((file) => {
      const canonicalId = normalizeSkillIdentifier(file.replace(/\.md$/, ''));
      if (!canonicalId) return null;

      const shortName = canonicalId.replace('flow.', '');
      const skillPath = join(commandsDir, file);
      return buildSkillRecord(provider, canonicalId, shortName, skillPath);
    })
    .filter((skill): skill is WorkflowSkill => skill !== null);
}

function buildSkillRecord(
  provider: AgentProvider,
  canonicalId: string,
  shortName: string,
  filePath: string
): WorkflowSkill {
  const command = provider === 'codex'
    ? toCodexSkillCommand(canonicalId)
    : toSlashSkillCommand(canonicalId);
  const description = extractDescription(filePath);

  return {
    id: canonicalId,
    name: formatSkillName(shortName),
    command,
    description,
    group: categorizeSkill(shortName),
    isPrimary: shortName === 'orchestrate' || shortName === 'merge',
    provider,
  };
}

function sortSkills(skills: WorkflowSkill[]): void {
  const groupOrder = ['primary', 'workflow', 'setup', 'maintenance'];
  const primaryOrder = ['orchestrate', 'merge'];
  const workflowOrder = ['design', 'analyze', 'implement', 'verify'];

  skills.sort((a, b) => {
    const groupDiff = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
    if (groupDiff !== 0) return groupDiff;

    if (a.group === 'primary') {
      const aShort = a.id.replace('flow.', '');
      const bShort = b.id.replace('flow.', '');
      return primaryOrder.indexOf(aShort) - primaryOrder.indexOf(bShort);
    }

    if (a.group === 'workflow') {
      const aShort = a.id.replace('flow.', '');
      const bShort = b.id.replace('flow.', '');
      return workflowOrder.indexOf(aShort) - workflowOrder.indexOf(bShort);
    }

    return a.name.localeCompare(b.name);
  });
}

/**
 * Format skill name for display.
 */
function formatSkillName(shortName: string): string {
  const knownNames: Record<string, string> = {
    taskstoissues: 'Tasks to Issues',
    orchestrate: 'Orchestrate',
    doctor: 'Doctor',
  };

  if (knownNames[shortName]) {
    return knownNames[shortName];
  }

  const spaced = shortName.replace(/([a-z])([A-Z])/g, '$1 $2');

  return spaced
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract description from skill file.
 */
function extractDescription(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');

    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        const frontmatter = content.slice(3, endIndex);
        const match = frontmatter.match(/^description:\s*(.+)$/m);
        if (match) {
          const desc = match[1].trim().replace(/^["']|["']$/g, '');
          return desc.slice(0, 120) + (desc.length > 120 ? '...' : '');
        }
      }
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^##\s*Goal/i)) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const line = lines[j].trim();
          if (line && !line.startsWith('#') && !line.startsWith('```')) {
            return line.slice(0, 120) + (line.length > 120 ? '...' : '');
          }
        }
      }
    }

    return 'Execute this workflow skill';
  } catch {
    return 'Execute this workflow skill';
  }
}

/**
 * Categorize skill into groups.
 */
function categorizeSkill(
  shortName: string
): 'primary' | 'workflow' | 'setup' | 'maintenance' {
  if (shortName === 'orchestrate' || shortName === 'merge') {
    return 'primary';
  }

  const workflowSteps = ['design', 'analyze', 'implement', 'verify'];
  if (workflowSteps.includes(shortName)) {
    return 'workflow';
  }

  if (shortName === 'init' || shortName === 'roadmap') {
    return 'setup';
  }

  return 'maintenance';
}
