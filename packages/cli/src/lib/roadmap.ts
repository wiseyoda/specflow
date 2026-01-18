import { readFile, writeFile } from 'node:fs/promises';
import { getRoadmapPath, pathExists, findProjectRoot } from './paths.js';
import { NotFoundError } from './errors.js';

/**
 * Phase status from ROADMAP.md
 */
export type PhaseStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'awaiting_user'
  | 'blocked';

/**
 * Parsed phase from ROADMAP.md
 */
export interface Phase {
  number: string;
  name: string;
  status: PhaseStatus;
  hasUserGate: boolean;
  verificationGate?: string;
  line: number;
}

/**
 * Complete parsed roadmap data
 */
export interface RoadmapData {
  filePath: string;
  projectName?: string;
  schemaVersion?: string;
  phases: Phase[];
  activePhase?: Phase;
  nextPhase?: Phase;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

/**
 * Parse phase status from status cell in table
 * Handles emoji and text formats: ✅, COMPLETE, DONE, 🔄, IN PROGRESS, IN_PROGRESS, etc.
 */
function parsePhaseStatus(statusCell: string): PhaseStatus {
  const lower = statusCell.toLowerCase().replace(/_/g, ' ');

  // Complete states
  if (lower.includes('✅') || lower.includes('complete') || lower.includes('done')) {
    return 'complete';
  }
  // In progress states
  if (lower.includes('🔄') || lower.includes('in progress') || lower.includes('active')) {
    return 'in_progress';
  }
  // Awaiting user states
  if (lower.includes('⏳') || lower.includes('awaiting') || lower.includes('waiting')) {
    return 'awaiting_user';
  }
  // Blocked states
  if (lower.includes('🚫') || lower.includes('blocked')) {
    return 'blocked';
  }
  // Not started states
  if (lower.includes('⬜') || lower.includes('not started') || lower.includes('pending')) {
    return 'not_started';
  }

  return 'not_started';
}

/**
 * Check if phase has USER GATE marker
 */
function hasUserGate(text: string): boolean {
  return text.toUpperCase().includes('USER GATE');
}

/**
 * Parse a table row into phase data
 * Expected format: | Phase | Name | Status | Verification Gate |
 */
function parseTableRow(row: string, lineNumber: number): Phase | null {
  // Remove leading/trailing pipes and split
  const cells = row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(c => c.trim());

  if (cells.length < 3) return null;

  const [phaseCell, nameCell, statusCell, gateCell] = cells;

  // Extract phase number (e.g., "0010", "1020")
  const phaseMatch = phaseCell.match(/(\d{4})/);
  if (!phaseMatch) return null;

  const number = phaseMatch[1];
  const name = nameCell || '';
  const status = parsePhaseStatus(statusCell || '');
  const hasGate = hasUserGate(gateCell || '') || hasUserGate(statusCell || '');

  return {
    number,
    name,
    status,
    hasUserGate: hasGate,
    verificationGate: gateCell || undefined,
    line: lineNumber,
  };
}

/**
 * Parse ROADMAP.md content
 */
export function parseRoadmapContent(content: string, filePath: string): RoadmapData {
  const lines = content.split('\n');
  const phases: Phase[] = [];

  let projectName: string | undefined;
  let schemaVersion: string | undefined;
  let inTable = false;
  let tableHeaderSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Extract project name from **Project**: line
    const projectMatch = line.match(/^\*\*Project\*\*:\s*(.+)/);
    if (projectMatch) {
      projectName = projectMatch[1].trim();
      continue;
    }

    // Extract schema version
    const schemaMatch = line.match(/^\*\*Schema Version\*\*:\s*(.+)/);
    if (schemaMatch) {
      schemaVersion = schemaMatch[1].trim();
      continue;
    }

    // Detect table start (row with Phase | Name | Status pattern)
    if (line.includes('|') && (line.includes('Phase') || line.includes('Name') || line.includes('Status'))) {
      if (line.includes('Phase') && line.includes('Status')) {
        inTable = true;
        tableHeaderSeen = false;
        continue;
      }
    }

    // Skip table separator row
    if (inTable && line.match(/^\|[-:\s|]+\|$/)) {
      tableHeaderSeen = true;
      continue;
    }

    // Parse table rows after header
    if (inTable && tableHeaderSeen && line.startsWith('|')) {
      const phase = parseTableRow(line, lineNumber);
      if (phase) {
        phases.push(phase);
      }
      continue;
    }

    // End table if we see non-table content
    if (inTable && tableHeaderSeen && !line.startsWith('|') && line.trim() !== '') {
      inTable = false;
      tableHeaderSeen = false;
    }
  }

  // Find active and next phase
  const activePhase = phases.find(p => p.status === 'in_progress');
  const nextPhase = phases.find(p => p.status === 'not_started');

  // Calculate progress
  const total = phases.length;
  const completed = phases.filter(p => p.status === 'complete').length;

  return {
    filePath,
    projectName,
    schemaVersion,
    phases,
    activePhase,
    nextPhase,
    progress: {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  };
}

/**
 * Read and parse ROADMAP.md for current project
 */
export async function readRoadmap(projectPath?: string): Promise<RoadmapData> {
  const root = projectPath || findProjectRoot();
  if (!root) {
    throw new NotFoundError(
      'SpecFlow project',
      'Ensure you are in a SpecFlow project directory',
    );
  }

  const roadmapPath = getRoadmapPath(root);

  if (!pathExists(roadmapPath)) {
    throw new NotFoundError(
      'ROADMAP.md',
      `No roadmap file found at ${roadmapPath}`,
    );
  }

  const content = await readFile(roadmapPath, 'utf-8');
  return parseRoadmapContent(content, roadmapPath);
}

/**
 * Get phase by number
 */
export function getPhaseByNumber(roadmap: RoadmapData, phaseNumber: string): Phase | null {
  return roadmap.phases.find(p => p.number === phaseNumber) ?? null;
}

/**
 * Get all phases with a given status
 */
export function getPhasesByStatus(roadmap: RoadmapData, status: PhaseStatus): Phase[] {
  return roadmap.phases.filter(p => p.status === status);
}

/**
 * Check if roadmap has any USER GATE phases pending
 */
export function hasPendingUserGates(roadmap: RoadmapData): boolean {
  return roadmap.phases.some(
    p => p.hasUserGate && (p.status === 'in_progress' || p.status === 'awaiting_user'),
  );
}

/**
 * Status text mapping for ROADMAP.md updates
 */
const STATUS_TEXT: Record<PhaseStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
  awaiting_user: 'Awaiting User',
  blocked: 'Blocked',
};

/**
 * Update a phase's status in ROADMAP.md
 */
export async function updatePhaseStatus(
  phaseNumber: string,
  newStatus: PhaseStatus,
  projectPath?: string,
): Promise<{ updated: boolean; filePath: string }> {
  const root = projectPath || findProjectRoot();
  if (!root) {
    throw new NotFoundError(
      'SpecFlow project',
      'Ensure you are in a SpecFlow project directory',
    );
  }

  const roadmapPath = getRoadmapPath(root);

  if (!pathExists(roadmapPath)) {
    throw new NotFoundError(
      'ROADMAP.md',
      `No roadmap file found at ${roadmapPath}`,
    );
  }

  const content = await readFile(roadmapPath, 'utf-8');
  const lines = content.split('\n');
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a table row containing our phase number
    if (line.startsWith('|') && line.includes(phaseNumber)) {
      // Parse the cells
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim());

      // Verify this is the correct phase (first cell should contain the number)
      if (cells.length >= 3 && cells[0].includes(phaseNumber)) {
        // Update the status cell (index 2)
        cells[2] = STATUS_TEXT[newStatus];

        // Reconstruct the line with proper spacing
        lines[i] = '| ' + cells.join(' | ') + ' |';
        updated = true;
        break;
      }
    }
  }

  if (updated) {
    await writeFile(roadmapPath, lines.join('\n'));
  }

  return { updated, filePath: roadmapPath };
}

/**
 * Calculate the next available hotfix phase number
 * ABBC format: A=milestone, BB=phase, C=hotfix (0=main, 1-9=hotfixes)
 *
 * @param roadmap - Parsed roadmap data
 * @returns Next available hotfix number (e.g., "0081" if 0080 is in progress)
 */
export function calculateNextHotfix(roadmap: RoadmapData): string | null {
  // Find current in-progress phase or most recently completed
  const activePhase = roadmap.activePhase;
  const completedPhases = roadmap.phases.filter(p => p.status === 'complete');
  const lastCompleted = completedPhases[completedPhases.length - 1];

  const basePhase = activePhase || lastCompleted;
  if (!basePhase) {
    return null;
  }

  const baseNumber = basePhase.number;
  // Extract base (first 3 digits) and current hotfix slot (last digit)
  const base = baseNumber.slice(0, 3);
  const currentSlot = parseInt(baseNumber.slice(3), 10);

  // Find all existing phases with this base
  const existingSlots = roadmap.phases
    .filter(p => p.number.startsWith(base))
    .map(p => parseInt(p.number.slice(3), 10));

  // Find next available slot (1-9 for hotfixes)
  for (let slot = currentSlot + 1; slot <= 9; slot++) {
    if (!existingSlots.includes(slot)) {
      return `${base}${slot}`;
    }
  }

  // All slots used (shouldn't happen often)
  return null;
}

/**
 * Insert a new phase row into ROADMAP.md table
 */
export async function insertPhaseRow(
  phaseNumber: string,
  phaseName: string,
  status: PhaseStatus = 'not_started',
  verificationGate?: string,
  projectPath?: string,
): Promise<{ inserted: boolean; filePath: string; line: number }> {
  const root = projectPath || findProjectRoot();
  if (!root) {
    throw new NotFoundError(
      'SpecFlow project',
      'Ensure you are in a SpecFlow project directory',
    );
  }

  const roadmapPath = getRoadmapPath(root);

  if (!pathExists(roadmapPath)) {
    throw new NotFoundError(
      'ROADMAP.md',
      `No roadmap file found at ${roadmapPath}`,
    );
  }

  const content = await readFile(roadmapPath, 'utf-8');
  const lines = content.split('\n');

  // Find the Phase Overview table
  let tableStartLine = -1;
  let tableEndLine = -1;
  let insertAfterLine = -1;
  const phaseBase = phaseNumber.slice(0, 3);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find table header
    if (line.includes('| Phase |') && line.includes('| Status |')) {
      tableStartLine = i;
      continue;
    }

    // Track end of table (Legend line or empty section)
    if (tableStartLine !== -1 && line.startsWith('**Legend**')) {
      tableEndLine = i;
      break;
    }

    // Find where to insert (after the base phase or at end of table)
    if (tableStartLine !== -1 && line.startsWith('|') && line.includes(phaseBase)) {
      insertAfterLine = i;
    }
  }

  // Default to end of table if no matching base found
  if (insertAfterLine === -1 && tableEndLine !== -1) {
    // Insert before Legend line, find last table row
    for (let i = tableEndLine - 1; i >= tableStartLine; i--) {
      if (lines[i].startsWith('|') && lines[i].includes('|')) {
        insertAfterLine = i;
        break;
      }
    }
  }

  if (insertAfterLine === -1) {
    return { inserted: false, filePath: roadmapPath, line: -1 };
  }

  // Build the new row
  const statusText = STATUS_TEXT[status];
  const gateText = verificationGate || '';
  const newRow = `| ${phaseNumber} | ${phaseName} | ${statusText} | ${gateText} |`;

  // Insert the new row
  lines.splice(insertAfterLine + 1, 0, newRow);

  await writeFile(roadmapPath, lines.join('\n'));

  return { inserted: true, filePath: roadmapPath, line: insertAfterLine + 2 };
}
