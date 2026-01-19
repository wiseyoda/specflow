import { NextResponse } from 'next/server';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/workflow/skills
 *
 * Dynamically discovers available workflow skills by scanning
 * ~/.claude/commands/flow.*.md files.
 *
 * Response:
 * - skills: Array of { id, name, command, description, group }
 */
export async function GET() {
  try {
    const homeDir = process.env.HOME || '';
    const commandsDir = join(homeDir, '.claude', 'commands');

    if (!existsSync(commandsDir)) {
      return NextResponse.json({ skills: [] });
    }

    const files = readdirSync(commandsDir).filter(
      (f) => f.startsWith('flow.') && f.endsWith('.md')
    );

    const skills = files.map((filename) => {
      const skillId = filename.replace('.md', ''); // e.g., "flow.orchestrate"
      const command = '/' + skillId; // e.g., "/flow.orchestrate"
      const shortName = skillId.replace('flow.', ''); // e.g., "orchestrate"

      // Format name: orchestrate -> Orchestrate, taskstoissues -> Tasks to Issues
      const name = formatSkillName(shortName);

      // Try to extract description from file
      const filePath = join(commandsDir, filename);
      const description = extractDescription(filePath);

      // Determine group based on skill name
      const group = categorizeSkill(shortName);

      return {
        id: skillId,
        name,
        command,
        description,
        group,
        isPrimary: shortName === 'orchestrate' || shortName === 'merge',
      };
    });

    // Sort: primary first, then workflow in specific order, then others alphabetically
    const groupOrder = ['primary', 'workflow', 'setup', 'maintenance'];
    const primaryOrder = ['orchestrate', 'merge'];
    const workflowOrder = ['design', 'analyze', 'implement', 'verify'];

    skills.sort((a, b) => {
      // First sort by group
      const groupDiff = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
      if (groupDiff !== 0) return groupDiff;

      // Within primary group, use specific order
      if (a.group === 'primary') {
        const aShort = a.id.replace('flow.', '');
        const bShort = b.id.replace('flow.', '');
        return primaryOrder.indexOf(aShort) - primaryOrder.indexOf(bShort);
      }

      // Within workflow group, use specific order
      if (a.group === 'workflow') {
        const aShort = a.id.replace('flow.', '');
        const bShort = b.id.replace('flow.', '');
        return workflowOrder.indexOf(aShort) - workflowOrder.indexOf(bShort);
      }

      // Everything else alphabetically
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ skills });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Format skill name for display
 * orchestrate -> Orchestrate
 * taskstoissues -> Tasks to Issues
 */
function formatSkillName(shortName: string): string {
  // Known compound words that need special handling
  const knownNames: Record<string, string> = {
    'taskstoissues': 'Tasks to Issues',
    'orchestrate': 'Orchestrate',
    'doctor': 'Doctor',
  };

  if (knownNames[shortName]) {
    return knownNames[shortName];
  }

  // Handle camelCase
  const spaced = shortName.replace(/([a-z])([A-Z])/g, '$1 $2');

  return spaced
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract description from skill file
 * Parses YAML frontmatter for description field
 */
function extractDescription(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Check for YAML frontmatter (starts with ---)
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        const frontmatter = content.slice(3, endIndex);
        // Simple regex to extract description field
        const match = frontmatter.match(/^description:\s*(.+)$/m);
        if (match) {
          const desc = match[1].trim().replace(/^["']|["']$/g, '');
          return desc.slice(0, 120) + (desc.length > 120 ? '...' : '');
        }
      }
    }

    // Fallback: Look for ## Goal section
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
 * Categorize skill into groups
 */
function categorizeSkill(
  shortName: string
): 'primary' | 'workflow' | 'setup' | 'maintenance' {
  // Primary skills - main entry points
  if (shortName === 'orchestrate' || shortName === 'merge') {
    return 'primary';
  }

  // Workflow steps - the core design/implement/verify cycle
  const workflowSteps = ['design', 'analyze', 'implement', 'verify'];
  if (workflowSteps.includes(shortName)) {
    return 'workflow';
  }

  // Setup skills - project initialization
  if (shortName === 'init' || shortName === 'roadmap') {
    return 'setup';
  }

  // Everything else is maintenance/utilities
  // (memory, doctor, review, taskstoissues, etc.)
  return 'maintenance';
}
