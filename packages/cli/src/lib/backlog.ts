import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, getSpecsDir, getTemplatesDir } from './paths.js';
import { phaseSlug } from './phases.js';

/**
 * Backlog and deferred item handling
 */

export interface DeferredItem {
  description: string;
  source: string;
  reason?: string;
  targetPhase?: string;
}

export interface DeferredSummary {
  count: number;
  withTarget: number;
  toBacklog: number;
  items: DeferredItem[];
}

/** Get the project backlog file path */
export function getBacklogPath(projectPath: string = process.cwd()): string {
  return join(projectPath, 'BACKLOG.md');
}

/** Get the deferred file path for a phase */
export function getDeferredPath(
  phaseNumber: string,
  phaseName: string,
  projectPath: string = process.cwd(),
): string {
  const slug = phaseSlug(phaseName);
  return join(getSpecsDir(projectPath), `${phaseNumber}-${slug}`, 'checklists', 'deferred.md');
}

/**
 * Parse deferred items from a deferred.md file
 */
export async function parseDeferredFile(filePath: string): Promise<DeferredItem[]> {
  if (!pathExists(filePath)) {
    return [];
  }

  const content = await readFile(filePath, 'utf-8');
  const items: DeferredItem[] = [];

  // Parse table rows: | Item | Source | Reason | Target Phase |
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    // Detect table start
    if (line.includes('|') && line.includes('Item') && line.includes('Source')) {
      inTable = true;
      continue;
    }

    // Skip separator
    if (inTable && line.match(/^\|[-:\s|]+\|$/)) {
      continue;
    }

    // Parse data rows
    if (inTable && line.startsWith('|') && !line.includes('---')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim());

      if (cells.length >= 2 && cells[0] && !cells[0].includes('[ITEM')) {
        items.push({
          description: cells[0],
          source: cells[1] || '',
          reason: cells[2] || undefined,
          targetPhase: cells[3] || undefined,
        });
      }
    }

    // End table on empty line or non-table content
    if (inTable && !line.startsWith('|') && line.trim() === '') {
      inTable = false;
    }
  }

  return items;
}

/**
 * Parse deferred items marked with [~] from checklist files
 */
async function parseDeferredFromChecklist(
  filePath: string,
  source: string,
): Promise<DeferredItem[]> {
  if (!pathExists(filePath)) {
    return [];
  }

  const content = await readFile(filePath, 'utf-8');
  const items: DeferredItem[] = [];

  // Match lines with [~] checkbox: - [~] V-001 Description - reason
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^-\s*\[~\]\s*([A-Z]-\d{3})\s+(.+)$/);
    if (match) {
      const id = match[1];
      const rest = match[2];
      // Check for inline reason after " - "
      const reasonMatch = rest.match(/^(.+?)\s+-\s+(.+)$/);
      if (reasonMatch) {
        items.push({
          description: `${id} ${reasonMatch[1].trim()}`,
          source,
          reason: reasonMatch[2].trim(),
        });
      } else {
        items.push({
          description: `${id} ${rest.trim()}`,
          source,
        });
      }
    }
  }

  return items;
}

/**
 * Scan for deferred items in a phase
 * Checks: checklists/deferred.md, checklists/verification.md, checklists/implementation.md
 */
export async function scanDeferredItems(
  phaseNumber: string,
  phaseName: string,
  projectPath: string = process.cwd(),
): Promise<DeferredSummary> {
  const slug = phaseSlug(phaseName);
  const specsDir = getSpecsDir(projectPath);
  const checklistDir = join(specsDir, `${phaseNumber}-${slug}`, 'checklists');

  // Collect from all sources
  const allItems: DeferredItem[] = [];

  // 1. Traditional deferred.md
  const deferredPath = getDeferredPath(phaseNumber, phaseName, projectPath);
  const deferredItems = await parseDeferredFile(deferredPath);
  allItems.push(...deferredItems);

  // 2. Verification checklist [~] markers
  const verificationPath = join(checklistDir, 'verification.md');
  const verificationItems = await parseDeferredFromChecklist(verificationPath, 'verification');
  allItems.push(...verificationItems);

  // 3. Implementation checklist [~] markers
  const implementationPath = join(checklistDir, 'implementation.md');
  const implementationItems = await parseDeferredFromChecklist(implementationPath, 'implementation');
  allItems.push(...implementationItems);

  const withTarget = allItems.filter(i => i.targetPhase && i.targetPhase !== 'Backlog').length;
  const toBacklog = allItems.filter(i => !i.targetPhase || i.targetPhase === 'Backlog').length;

  return {
    count: allItems.length,
    withTarget,
    toBacklog,
    items: allItems,
  };
}

/**
 * Add items to project BACKLOG.md
 */
export async function addToBacklog(
  items: DeferredItem[],
  sourcePhase: string,
  projectPath: string = process.cwd(),
): Promise<void> {
  if (items.length === 0) return;

  const backlogPath = getBacklogPath(projectPath);
  let content = '';

  if (pathExists(backlogPath)) {
    content = await readFile(backlogPath, 'utf-8');
  } else {
    // Create from template or minimal structure
    content = createBacklogFile(projectPath);
  }

  // Find the P2 (Medium Priority) section and add items there
  // Default to medium priority for deferred items
  const p2Section = '### P2 - Medium Priority';
  const p2Index = content.indexOf(p2Section);

  if (p2Index !== -1) {
    // Find the table in P2 section
    const tableStart = content.indexOf('| Item |', p2Index);
    const tableEnd = content.indexOf('\n\n', tableStart);

    if (tableStart !== -1) {
      // Add items to the table
      const newRows = items.map(item =>
        `| ${item.description} | Phase ${sourcePhase} | ${item.reason || 'Deferred'} | - |`,
      );

      const insertPoint = tableEnd !== -1 ? tableEnd : content.length;
      content =
        content.slice(0, insertPoint) +
        '\n' +
        newRows.join('\n') +
        content.slice(insertPoint);
    }
  }

  await writeFile(backlogPath, content);
}

/**
 * Create a new BACKLOG.md file
 */
function createBacklogFile(projectPath: string): string {
  const today = new Date().toISOString().split('T')[0];

  return `# Project Backlog

> Items deferred from phases without a specific target phase assignment.
> Review periodically to schedule into upcoming phases.

**Created**: ${today}
**Last Updated**: ${today}

---

## Priority Legend

| Priority | Meaning | Criteria |
|----------|---------|----------|
| **P1** | High | Core functionality, significant user value |
| **P2** | Medium | Nice-to-have, quality of life improvements |
| **P3** | Low | Future considerations, can wait indefinitely |

---

## Backlog Items

### P1 - High Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|

### P2 - Medium Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|

### P3 - Low Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|

---

## Scheduling Guidelines

When planning a new phase, review this backlog:

1. **Check P1 items** - Should any be scheduled for the next phase?
2. **Look for synergies** - Do any backlog items align with planned work?
3. **Update target phases** - Move items from Backlog to specific phases as appropriate
4. **Clean up** - Remove completed items, update priorities as project evolves
`;
}
