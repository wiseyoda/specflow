import type { RoadmapPhase, RoadmapPhaseStatus, PhasesData } from '@specflow/shared';

/**
 * Parse phase status from status cell in table
 */
function parsePhaseStatus(statusCell: string): RoadmapPhaseStatus {
  const lower = statusCell.toLowerCase().replace(/_/g, ' ');

  if (lower.includes('✅') || lower.includes('complete') || lower.includes('done')) {
    return 'complete';
  }
  if (lower.includes('🔄') || lower.includes('in progress') || lower.includes('active')) {
    return 'in_progress';
  }
  if (lower.includes('⏳') || lower.includes('awaiting') || lower.includes('waiting')) {
    return 'awaiting_user';
  }
  if (lower.includes('🚫') || lower.includes('blocked')) {
    return 'blocked';
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
 * Strip markdown formatting (bold, italic) from text
 */
function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold **text**
    .replace(/__(.+?)__/g, '$1')     // bold __text__
    .replace(/\*(.+?)\*/g, '$1')     // italic *text*
    .replace(/_(.+?)_/g, '$1')       // italic _text_
    .trim();
}

/**
 * Parse a table row into phase data
 */
function parseTableRow(row: string): RoadmapPhase | null {
  const cells = row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

  if (cells.length < 3) return null;

  const [phaseCell, nameCell, statusCell, gateCell] = cells;

  const phaseMatch = phaseCell.match(/(\d{4})/);
  if (!phaseMatch) return null;

  const number = phaseMatch[1];
  const name = stripMarkdownFormatting(nameCell || '');
  const status = parsePhaseStatus(statusCell || '');
  const hasGate = hasUserGate(gateCell || '') || hasUserGate(statusCell || '');

  return {
    number,
    name,
    status,
    hasUserGate: hasGate,
    verificationGate: gateCell || undefined,
  };
}

/**
 * Parse ROADMAP.md content into phases
 */
export function parseRoadmapContent(content: string): RoadmapPhase[] {
  const lines = content.split('\n');
  const phases: RoadmapPhase[] = [];

  let inTable = false;
  let tableHeaderSeen = false;

  for (const line of lines) {
    // Detect table start
    if (line.includes('|') && line.includes('Phase') && line.includes('Status')) {
      inTable = true;
      tableHeaderSeen = false;
      continue;
    }

    // Skip table separator row
    if (inTable && line.match(/^\|[-:\s|]+\|$/)) {
      tableHeaderSeen = true;
      continue;
    }

    // Parse table rows after header
    if (inTable && tableHeaderSeen && line.startsWith('|')) {
      const phase = parseTableRow(line);
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

  return phases;
}

/**
 * Parse ROADMAP.md content into PhasesData structure
 */
export function parseRoadmapToPhasesData(content: string, projectId: string): PhasesData {
  const phases = parseRoadmapContent(content);
  const activePhase = phases.find((p) => p.status === 'in_progress') ?? null;

  return {
    phases,
    activePhase,
    progress: {
      total: phases.length,
      completed: phases.filter((p) => p.status === 'complete').length,
    },
  };
}
