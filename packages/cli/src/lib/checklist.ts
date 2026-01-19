import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { pathExists, getSpecsDir, findProjectRoot } from './paths.js';
import { NotFoundError } from './errors.js';

/**
 * Checklist item status
 */
export type ChecklistItemStatus = 'todo' | 'done' | 'skipped';

/**
 * Parsed checklist item
 */
export interface ChecklistItem {
  id: string;
  description: string;
  status: ChecklistItemStatus;
  section?: string;
  line: number;
}

/**
 * Section in a checklist
 */
export interface ChecklistSection {
  name: string;
  items: ChecklistItem[];
  isComplete: boolean;
  startLine: number;
  endLine: number;
}

/**
 * Complete parsed checklist data
 */
export interface ChecklistData {
  name: string;
  filePath: string;
  type: 'implementation' | 'verification' | 'deferred' | 'other';
  title?: string;
  sections: ChecklistSection[];
  items: ChecklistItem[];
  progress: {
    total: number;
    completed: number;
    skipped: number;
    percentage: number;
  };
}

/**
 * All checklists for a feature
 */
export interface FeatureChecklists {
  featureDir: string;
  implementation?: ChecklistData;
  verification?: ChecklistData;
  deferred?: ChecklistData;
  other: ChecklistData[];
}

/**
 * Parse checkbox status from line
 */
function parseCheckboxStatus(line: string): ChecklistItemStatus | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
    return 'done';
  }
  if (trimmed.startsWith('- [ ]')) {
    return 'todo';
  }
  if (trimmed.startsWith('- [~]') || trimmed.startsWith('- [-]')) {
    return 'skipped';
  }
  return null;
}

/**
 * Generate item ID from position (V-001, I-001, etc.)
 */
function generateItemId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

/**
 * Get ID prefix from checklist type
 */
function getIdPrefix(type: ChecklistData['type']): string {
  switch (type) {
    case 'verification':
      return 'V';
    case 'implementation':
      return 'I';
    case 'deferred':
      return 'D';
    default:
      return 'C';
  }
}

/**
 * Determine checklist type from filename
 */
function getChecklistType(filename: string): ChecklistData['type'] {
  const lower = filename.toLowerCase();
  if (lower.includes('verification') || lower.includes('verify')) {
    return 'verification';
  }
  if (lower.includes('implementation') || lower.includes('implement')) {
    return 'implementation';
  }
  if (lower.includes('deferred') || lower.includes('defer')) {
    return 'deferred';
  }
  return 'other';
}

/**
 * Parse section header (## or ### or ####)
 */
function parseSectionHeader(line: string): { name: string; level: number } | null {
  const headerMatch = line.match(/^(#{2,4})\s+(.+)/);
  if (headerMatch) {
    return {
      name: headerMatch[2].trim(),
      level: headerMatch[1].length,
    };
  }
  return null;
}

/**
 * Extract existing item ID from description (V-001, I-001, V-UI1, etc.)
 * Supports: V-001 (standard), V-UI1 (UI items), I-SEC1 (custom prefixes)
 */
function extractExistingId(description: string): string | null {
  // Match: letter, hyphen, then alphanumeric (e.g., V-001, V-UI1, I-SEC2)
  const match = description.match(/^([A-Z]-[A-Z0-9]+)\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Parse checklist content
 */
export function parseChecklistContent(
  content: string,
  filePath: string,
  type?: ChecklistData['type'],
): ChecklistData {
  const lines = content.split('\n');
  const sections: ChecklistSection[] = [];
  const allItems: ChecklistItem[] = [];

  const checklistType = type ?? getChecklistType(basename(filePath));
  const idPrefix = getIdPrefix(checklistType);
  let autoItemIndex = 1;

  let currentSection: ChecklistSection | null = null;
  let title: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Parse title
    if (!title && line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }

    // Parse section header (## or ### or ####)
    const sectionHeader = parseSectionHeader(line);
    if (sectionHeader) {
      // Only create new section for ## headers, nested headers become part of current section
      if (sectionHeader.level === 2) {
        if (currentSection) {
          currentSection.endLine = lineNumber - 1;
          currentSection.isComplete = currentSection.items.every(
            item => item.status === 'done' || item.status === 'skipped',
          );
          sections.push(currentSection);
        }

        currentSection = {
          name: sectionHeader.name,
          items: [],
          isComplete: false,
          startLine: lineNumber,
          endLine: lineNumber,
        };
      }
      continue;
    }

    // Parse checklist item
    const status = parseCheckboxStatus(line);
    if (status !== null) {
      const match = line.match(/^-\s*\[[xX ~\-]\]\s*(.+)$/);
      if (match) {
        const description = match[1].trim();

        // Try to extract existing ID from description, otherwise auto-generate
        const existingId = extractExistingId(description);
        const itemId = existingId ?? generateItemId(idPrefix, autoItemIndex++);

        const item: ChecklistItem = {
          id: itemId,
          description,
          status,
          section: currentSection?.name,
          line: lineNumber,
        };

        if (currentSection) {
          currentSection.items.push(item);
        }
        allItems.push(item);
      }
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endLine = lines.length;
    currentSection.isComplete = currentSection.items.every(
      item => item.status === 'done' || item.status === 'skipped',
    );
    sections.push(currentSection);
  }

  // Calculate progress
  const total = allItems.length;
  const completed = allItems.filter(item => item.status === 'done').length;
  const skipped = allItems.filter(item => item.status === 'skipped').length;

  return {
    name: basename(filePath, '.md'),
    filePath,
    type: checklistType,
    title,
    sections,
    items: allItems,
    progress: {
      total,
      completed,
      skipped,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  };
}

/**
 * Read and parse a single checklist file
 */
export async function readChecklist(checklistPath: string): Promise<ChecklistData> {
  if (!pathExists(checklistPath)) {
    throw new NotFoundError(
      'Checklist',
      `No checklist file found at ${checklistPath}`,
    );
  }

  const content = await readFile(checklistPath, 'utf-8');
  return parseChecklistContent(content, checklistPath);
}

/**
 * Read all checklists for a feature
 */
export async function readFeatureChecklists(featureDir: string): Promise<FeatureChecklists> {
  const checklistsDir = join(featureDir, 'checklists');

  const result: FeatureChecklists = {
    featureDir,
    other: [],
  };

  if (!pathExists(checklistsDir)) {
    return result;
  }

  const entries = await readdir(checklistsDir, { withFileTypes: true });
  const mdFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name);

  for (const filename of mdFiles) {
    const filePath = join(checklistsDir, filename);
    const checklist = await readChecklist(filePath);

    switch (checklist.type) {
      case 'implementation':
        result.implementation = checklist;
        break;
      case 'verification':
        result.verification = checklist;
        break;
      case 'deferred':
        result.deferred = checklist;
        break;
      default:
        result.other.push(checklist);
    }
  }

  return result;
}

/**
 * Find next incomplete checklist item
 */
export function findNextChecklistItem(checklist: ChecklistData): ChecklistItem | null {
  return checklist.items.find(item => item.status === 'todo') ?? null;
}

/**
 * Get item by ID
 */
export function getChecklistItemById(
  checklist: ChecklistData,
  itemId: string,
): ChecklistItem | null {
  return checklist.items.find(item => item.id === itemId) ?? null;
}

/**
 * Check if all checklists are complete
 */
export function areAllChecklistsComplete(checklists: FeatureChecklists): boolean {
  const allChecklists = [
    checklists.implementation,
    checklists.verification,
    ...checklists.other,
  ].filter(Boolean) as ChecklistData[];

  if (allChecklists.length === 0) return true;

  return allChecklists.every(
    checklist => checklist.items.every(
      item => item.status === 'done' || item.status === 'skipped',
    ),
  );
}
