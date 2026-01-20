import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

interface Artifact {
  name: string;
  path: string;
  exists: boolean;
}

interface PhaseDetail {
  number: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  source: 'history' | 'phase_file' | 'none';
  content: string;
  completedAt?: string;
  goal?: string;
  dependencies?: string;
  complexity?: string;
  artifacts: Artifact[];
  artifactsLocation?: string;
}

/**
 * Standard SDD artifact filenames
 */
const STANDARD_ARTIFACTS = [
  'spec.md',
  'plan.md',
  'tasks.md',
  'discovery.md',
  'requirements.md',
  'research.md',
  'data-model.md',
];

/**
 * Find artifacts for a phase by checking multiple locations
 */
async function findArtifacts(
  projectPath: string,
  phaseNumber: string,
  phaseName: string
): Promise<{ artifacts: Artifact[]; location: string | undefined }> {
  const normalizedName = phaseName.toLowerCase().replace(/\s+/g, '-');
  const phaseDirName = `${phaseNumber}-${normalizedName}`;

  // Check locations in order of priority:
  // 1. specs/ (in-progress phases)
  // 2. .specify/archive/ (completed but not yet cleaned up)

  const locations = [
    { path: join(projectPath, 'specs', phaseDirName), name: 'specs' },
    { path: join(projectPath, '.specify', 'archive', phaseDirName), name: 'archive' },
  ];

  for (const location of locations) {
    if (existsSync(location.path)) {
      try {
        const files = await readdir(location.path);
        const mdFiles = files.filter((f) => f.endsWith('.md'));

        if (mdFiles.length > 0) {
          // Include standard artifacts that exist, plus any additional .md files
          const artifacts: Artifact[] = [];
          const addedFiles = new Set<string>();

          // First add standard artifacts in order
          for (const stdArtifact of STANDARD_ARTIFACTS) {
            if (mdFiles.includes(stdArtifact)) {
              artifacts.push({
                name: stdArtifact,
                path: join(location.path, stdArtifact),
                exists: true,
              });
              addedFiles.add(stdArtifact);
            }
          }

          // Then add any additional .md files
          for (const file of mdFiles) {
            if (!addedFiles.has(file)) {
              artifacts.push({
                name: file,
                path: join(location.path, file),
                exists: true,
              });
            }
          }

          // Also check for checklists subdirectory
          const checklistsPath = join(location.path, 'checklists');
          if (existsSync(checklistsPath)) {
            try {
              const checklistFiles = await readdir(checklistsPath);
              for (const file of checklistFiles.filter((f) => f.endsWith('.md'))) {
                artifacts.push({
                  name: `checklists/${file}`,
                  path: join(checklistsPath, file),
                  exists: true,
                });
              }
            } catch {
              // Ignore errors reading checklists
            }
          }

          return { artifacts, location: location.name };
        }
      } catch {
        // Continue to next location
      }
    }
  }

  // No artifacts found
  return { artifacts: [], location: undefined };
}

/**
 * Extract a specific phase section from HISTORY.md
 *
 * HISTORY.md format:
 * ## 0040 - Phase Name       <- Section header (##)
 * **Completed**: 2026-01-20
 * # Phase 0040: Phase Name   <- Content subheading (#) - NOT a new section
 * **Goal**: ...
 * ... rest of content ...
 * ---                        <- Section divider
 * ## 0045 - Next Phase       <- Next section
 */
function extractPhaseFromHistory(historyContent: string, phaseNumber: string): Omit<PhaseDetail, 'artifacts' | 'artifactsLocation'> | null {
  const lines = historyContent.split('\n');
  let inPhaseSection = false;
  let currentPhase: Omit<PhaseDetail, 'artifacts' | 'artifactsLocation'> | null = null;
  const contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Section headers are specifically ## (2 hashes) - e.g., "## 0040 - Obsidian Integration"
    // Single # headers inside content (like "# Phase 0040: Name") are NOT section boundaries
    const sectionHeaderMatch = line.match(/^##\s*(\d{4})\s*[-:]\s*(.+)/);

    if (sectionHeaderMatch) {
      // Found a new section header
      if (inPhaseSection && currentPhase) {
        // We were in the target section and hit a new one - return what we have
        currentPhase.content = contentLines.join('\n').trim();
        return currentPhase;
      }

      const [, num, name] = sectionHeaderMatch;
      if (num === phaseNumber) {
        // Found the target phase section
        inPhaseSection = true;
        currentPhase = {
          number: num,
          name: name.trim(),
          status: 'completed',
          source: 'history',
          content: '',
        };
        contentLines.length = 0;
        continue;
      }
    }

    // Check for horizontal rule which often separates phases
    if (inPhaseSection && line.trim() === '---') {
      // Check if this is followed by another phase section
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.match(/^##\s*\d{4}/)) {
        // End of our section
        currentPhase!.content = contentLines.join('\n').trim();
        return currentPhase;
      }
      // Otherwise it's just a divider within the section, include it
    }

    if (inPhaseSection) {
      // Extract metadata from content
      const completedMatch = line.match(/\*\*Completed\*\*:\s*(.+)/);
      if (completedMatch && currentPhase) {
        currentPhase.completedAt = completedMatch[1].trim();
      }

      const goalMatch = line.match(/\*\*Goal\*\*:\s*(.+)/);
      if (goalMatch && currentPhase) {
        currentPhase.goal = goalMatch[1].trim();
      }

      const depsMatch = line.match(/\*\*Dependencies\*\*:\s*(.+)/);
      if (depsMatch && currentPhase) {
        currentPhase.dependencies = depsMatch[1].trim();
      }

      const complexityMatch = line.match(/\*\*(?:Estimated\s+)?Complexity\*\*:\s*(.+)/);
      if (complexityMatch && currentPhase) {
        currentPhase.complexity = complexityMatch[1].trim();
      }

      contentLines.push(line);
    }
  }

  if (inPhaseSection && currentPhase) {
    currentPhase.content = contentLines.join('\n').trim();
    return currentPhase;
  }

  return null;
}

/**
 * Find and read a phase file from .specify/phases/
 */
async function readPhaseFile(projectPath: string, phaseNumber: string): Promise<Omit<PhaseDetail, 'artifacts' | 'artifactsLocation'> | null> {
  const phasesDir = join(projectPath, '.specify', 'phases');

  if (!existsSync(phasesDir)) {
    return null;
  }

  try {
    const files = await readdir(phasesDir);
    const phaseFile = files.find((f) => f.startsWith(phaseNumber) && f.endsWith('.md'));

    if (!phaseFile) {
      return null;
    }

    const filePath = join(phasesDir, phaseFile);
    const content = await readFile(filePath, 'utf-8');

    // Extract name from filename
    const nameMatch = phaseFile.match(/^\d{4}-(.+)\.md$/);
    const name = nameMatch
      ? nameMatch[1]
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : `Phase ${phaseNumber}`;

    // Extract metadata
    let goal: string | undefined;
    let dependencies: string | undefined;
    let complexity: string | undefined;
    let status: 'pending' | 'in_progress' = 'pending';

    const goalMatch = content.match(/\*\*Goal\*\*:\s*(.+)/);
    if (goalMatch) goal = goalMatch[1].trim();

    const depsMatch = content.match(/\*\*Dependencies\*\*:\s*(.+)/);
    if (depsMatch) dependencies = depsMatch[1].trim();

    const complexityMatch = content.match(/\*\*(?:Estimated\s+)?Complexity\*\*:\s*(.+)/);
    if (complexityMatch) complexity = complexityMatch[1].trim();

    // Check for status in frontmatter
    const statusMatch = content.match(/status:\s*([\w_]+)/);
    if (statusMatch) {
      const s = statusMatch[1].toLowerCase();
      if (s === 'in_progress' || s === 'active') {
        status = 'in_progress';
      }
    }

    return {
      number: phaseNumber,
      name,
      status,
      source: 'phase_file',
      content,
      goal,
      dependencies,
      complexity,
    };
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number: phaseNumber } = await params;
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');
  const phaseName = searchParams.get('phaseName') || '';

  if (!projectPath) {
    return NextResponse.json({ error: 'Missing projectPath parameter' }, { status: 400 });
  }

  let phaseDetail: PhaseDetail | null = null;

  // First try HISTORY.md for completed phases
  const historyPath = join(projectPath, '.specify', 'history', 'HISTORY.md');
  if (existsSync(historyPath)) {
    try {
      const historyContent = await readFile(historyPath, 'utf-8');
      const historyPhase = extractPhaseFromHistory(historyContent, phaseNumber);
      if (historyPhase) {
        phaseDetail = { ...historyPhase, artifacts: [], artifactsLocation: undefined };
      }
    } catch {
      // Continue to phase file
    }
  }

  // If not in history, try phase file
  if (!phaseDetail) {
    const phaseFileDetail = await readPhaseFile(projectPath, phaseNumber);
    if (phaseFileDetail) {
      phaseDetail = { ...phaseFileDetail, artifacts: [], artifactsLocation: undefined };
    }
  }

  // If still nothing, create minimal response
  if (!phaseDetail) {
    phaseDetail = {
      number: phaseNumber,
      name: phaseName || `Phase ${phaseNumber}`,
      status: 'pending',
      source: 'none',
      content: '',
      artifacts: [],
    };
  }

  // Find available artifacts
  const { artifacts, location } = await findArtifacts(
    projectPath,
    phaseNumber,
    phaseDetail.name
  );
  phaseDetail.artifacts = artifacts;
  phaseDetail.artifactsLocation = location;

  // Update status based on artifact location
  if (location === 'specs') {
    phaseDetail.status = 'in_progress';
  } else if (location === 'archive' || phaseDetail.source === 'history') {
    phaseDetail.status = 'completed';
  }

  return NextResponse.json({ phase: phaseDetail });
}
