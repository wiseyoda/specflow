import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getSpecifyDir, pathExists } from './paths.js';
import type { Phase } from './roadmap.js';

/**
 * History file operations for archiving completed phases
 */

/** Get the history file path */
export function getHistoryPath(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'history', 'HISTORY.md');
}

/** Get the phases directory path */
export function getPhasesDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'phases');
}

/** Get a phase file path */
export function getPhaseFilePath(
  phaseNumber: string,
  phaseName: string,
  projectPath: string = process.cwd(),
): string {
  const slug = phaseName.toLowerCase().replace(/\s+/g, '-');
  return join(getPhasesDir(projectPath), `${phaseNumber}-${slug}.md`);
}

/**
 * Archive a phase to HISTORY.md
 * Reads the phase file from .specify/phases/ and appends to HISTORY.md
 */
export async function archivePhase(
  phase: Phase,
  projectPath: string = process.cwd(),
): Promise<{ archived: boolean; historyPath: string }> {
  const historyPath = getHistoryPath(projectPath);
  const phasesDir = getPhasesDir(projectPath);

  // Ensure history directory exists
  await mkdir(dirname(historyPath), { recursive: true });

  // Find phase file
  const phaseFilePattern = join(phasesDir, `${phase.number}-*.md`);
  const { glob } = await import('node:fs/promises');
  let phaseContent = '';
  let phaseFilePath = '';

  // Try to find and read the phase file
  try {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(phasesDir);
    const phaseFile = files.find(f => f.startsWith(`${phase.number}-`));

    if (phaseFile) {
      phaseFilePath = join(phasesDir, phaseFile);
      phaseContent = await readFile(phaseFilePath, 'utf-8');
    }
  } catch {
    // No phase file found, create minimal entry
  }

  // Create archive entry
  const today = new Date().toISOString().split('T')[0];
  const archiveEntry = phaseContent
    ? formatPhaseForHistory(phaseContent, phase, today)
    : createMinimalHistoryEntry(phase, today);

  // Read existing history or create new
  let historyContent = '';
  if (pathExists(historyPath)) {
    historyContent = await readFile(historyPath, 'utf-8');
  } else {
    historyContent = `# Completed Phases

> Archive of completed development phases. Newest first.

---

`;
  }

  // Insert new entry after the header (after first ---)
  const headerEndIndex = historyContent.indexOf('---\n') + 4;
  const updatedHistory =
    historyContent.slice(0, headerEndIndex) +
    '\n' +
    archiveEntry +
    historyContent.slice(headerEndIndex);

  await writeFile(historyPath, updatedHistory);

  // Delete the phase file if it existed
  if (phaseFilePath && pathExists(phaseFilePath)) {
    const { unlink } = await import('node:fs/promises');
    await unlink(phaseFilePath);
  }

  return { archived: true, historyPath };
}

/**
 * Format phase file content for history
 */
function formatPhaseForHistory(content: string, phase: Phase, date: string): string {
  // Remove frontmatter if present
  let cleanContent = content;
  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex !== -1) {
      cleanContent = content.slice(endIndex + 3).trim();
    }
  }

  // Add completed header
  const header = `## ${phase.number} - ${phase.name}

**Completed**: ${date}

`;

  return header + cleanContent + '\n\n---\n';
}

/**
 * Create minimal history entry when no phase file exists
 */
function createMinimalHistoryEntry(phase: Phase, date: string): string {
  return `## ${phase.number} - ${phase.name}

**Completed**: ${date}

Phase completed without detailed phase file.

---

`;
}

/**
 * Check if a phase is already archived
 */
export async function isPhaseArchived(
  phaseNumber: string,
  projectPath: string = process.cwd(),
): Promise<boolean> {
  const historyPath = getHistoryPath(projectPath);

  if (!pathExists(historyPath)) {
    return false;
  }

  const content = await readFile(historyPath, 'utf-8');
  // Look for ## NNNN pattern
  const pattern = new RegExp(`^## ${phaseNumber}\\s*-`, 'm');
  return pattern.test(content);
}
