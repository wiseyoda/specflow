import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPhasesDir, pathExists } from './paths.js';

/**
 * Shared phase utilities — single source of truth for slug generation,
 * display name formatting, and phase detail file creation.
 */

/**
 * Convert a phase name to a kebab-case slug safe for filenames and branch names.
 * Handles spaces, special characters, and hyphen collapsing.
 */
export function phaseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert a kebab-case slug back to a display name.
 * e.g., "core-engine" → "Core Engine"
 */
export function phaseDisplayName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the path for a phase detail file in .specify/phases/
 */
export function getPhaseDetailPath(
  phaseNumber: string,
  phaseName: string,
  projectPath: string,
): string {
  const slug = phaseSlug(phaseName);
  return join(getPhasesDir(projectPath), `${phaseNumber}-${slug}.md`);
}

export interface CreatePhaseDetailOptions {
  phaseNumber: string;
  phaseName: string;
  projectPath: string;
  verificationGate?: string;
  status?: string;
}

/**
 * Create a phase detail file with YAML frontmatter template.
 * Returns the file path if created, or null if the file already exists.
 */
export async function createPhaseDetailFile(
  options: CreatePhaseDetailOptions,
): Promise<string | null> {
  const { phaseNumber, phaseName, projectPath, verificationGate, status } = options;
  const slug = phaseSlug(phaseName);
  const displayName = phaseDisplayName(slug);
  const filePath = getPhaseDetailPath(phaseNumber, phaseName, projectPath);

  // Don't overwrite existing files
  if (pathExists(filePath)) {
    return null;
  }

  // Ensure phases directory exists
  const phasesDir = getPhasesDir(projectPath);
  if (!pathExists(phasesDir)) {
    await mkdir(phasesDir, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const phaseStatus = status ?? 'not_started';
  const gate = verificationGate ?? '[Define success criteria]';

  const content = `---
phase: ${phaseNumber}
name: ${slug}
status: ${phaseStatus}
created: ${today}
updated: ${today}
---

# Phase ${phaseNumber}: ${displayName}

**Goal**: [Describe the goal of this phase]

**Scope**:
- [Define scope items]

**Deliverables**:
- [ ] [Deliverable 1]

**Verification Gate**: ${gate}

**Estimated Complexity**: [Low/Medium/High]
`;

  await writeFile(filePath, content);
  return filePath;
}
