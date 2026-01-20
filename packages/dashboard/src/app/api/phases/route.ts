import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Phase status from ROADMAP.md
 */
type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'awaiting_user' | 'blocked';

/**
 * Parsed phase from ROADMAP.md
 */
interface Phase {
  number: string;
  name: string;
  status: PhaseStatus;
  hasUserGate: boolean;
  verificationGate?: string;
}

/**
 * Parse phase status from status cell in table
 */
function parsePhaseStatus(statusCell: string): PhaseStatus {
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
 * Parse a table row into phase data
 */
function parseTableRow(row: string): Phase | null {
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
  const name = nameCell || '';
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
 * Parse ROADMAP.md content
 */
function parseRoadmapContent(content: string): Phase[] {
  const lines = content.split('\n');
  const phases: Phase[] = [];

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');

  if (!projectPath) {
    return NextResponse.json({ error: 'Missing projectPath parameter' }, { status: 400 });
  }

  const roadmapPath = join(projectPath, 'ROADMAP.md');

  if (!existsSync(roadmapPath)) {
    return NextResponse.json({ phases: [], error: 'ROADMAP.md not found' });
  }

  try {
    const content = await readFile(roadmapPath, 'utf-8');
    const phases = parseRoadmapContent(content);

    return NextResponse.json({
      phases,
      activePhase: phases.find((p) => p.status === 'in_progress') ?? null,
      progress: {
        total: phases.length,
        completed: phases.filter((p) => p.status === 'complete').length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
