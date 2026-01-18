import { mkdir, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { output } from '../../lib/output.js';
import { readState, writeState, setStateValue } from '../../lib/state.js';
import {
  readRoadmap,
  getPhaseByNumber,
  updatePhaseStatus,
  calculateNextHotfix,
  insertPhaseRow,
} from '../../lib/roadmap.js';
import { findProjectRoot, getPhasesDir, pathExists } from '../../lib/paths.js';
import { handleError, NotFoundError, ValidationError } from '../../lib/errors.js';

/**
 * Sanitize a string for use as a git branch name segment.
 * Only allows alphanumeric characters and hyphens.
 * Collapses multiple hyphens and trims hyphens from ends.
 */
function sanitizeBranchSegment(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove unsafe characters
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Phase open output
 */
export interface PhaseOpenOutput {
  action: 'opened' | 'created';
  phase: {
    number: string;
    name: string;
    branch: string;
  };
  isHotfix: boolean;
  message: string;
}

/**
 * Create a phase detail file in .specify/phases/
 */
async function createPhaseDetailFile(
  phaseNumber: string,
  phaseName: string,
  projectPath: string,
): Promise<string> {
  const phasesDir = getPhasesDir(projectPath);

  // Ensure phases directory exists
  if (!pathExists(phasesDir)) {
    await mkdir(phasesDir, { recursive: true });
  }

  const slug = sanitizeBranchSegment(phaseName);
  const fileName = `${phaseNumber}-${slug}.md`;
  const filePath = join(phasesDir, fileName);

  const today = new Date().toISOString().split('T')[0];

  const content = `# Phase ${phaseNumber}: ${phaseName}

**Created**: ${today}
**Status**: In Progress

## Goal

[Describe the goal of this phase]

## Scope

- [List scope items]

## Deliverables

- [ ] [Deliverable 1]
- [ ] [Deliverable 2]

## Verification Gate

[Define success criteria]

---

## Notes

[Add any notes or context]
`;

  await fsWriteFile(filePath, content);
  return filePath;
}

/**
 * Open an existing phase from ROADMAP.md
 */
async function openExistingPhase(
  phaseNumber: string | undefined,
  projectRoot: string,
): Promise<PhaseOpenOutput> {
  // Read roadmap to find phase
  const roadmap = await readRoadmap(projectRoot);

  let phase;
  if (phaseNumber) {
    // Find specific phase
    phase = getPhaseByNumber(roadmap, phaseNumber);
    if (!phase) {
      throw new NotFoundError(`Phase ${phaseNumber}`, 'Phase not found in ROADMAP.md');
    }
  } else {
    // Find next pending phase
    phase = roadmap.nextPhase;
    if (!phase) {
      throw new ValidationError(
        'No pending phases',
        'All phases are complete or in progress. Use --hotfix to create a new phase.',
      );
    }
  }

  // Check if already in progress
  if (phase.status === 'in_progress') {
    throw new ValidationError(
      `Phase ${phase.number} is already in progress`,
      'Use "specflow phase close" to complete it first',
    );
  }

  // Create branch name with sanitized slug
  const slug = sanitizeBranchSegment(phase.name);
  const branch = `${phase.number}-${slug}`;

  // Update state
  let state = await readState(projectRoot);
  state = setStateValue(state, 'orchestration.phase.number', phase.number);
  state = setStateValue(state, 'orchestration.phase.name', phase.name);
  state = setStateValue(state, 'orchestration.phase.branch', branch);
  state = setStateValue(state, 'orchestration.phase.status', 'in_progress');
  state = setStateValue(state, 'orchestration.step.current', 'design');
  state = setStateValue(state, 'orchestration.step.index', 0);
  state = setStateValue(state, 'orchestration.step.status', 'not_started');
  // Reset step-specific data from previous phase
  state = setStateValue(state, 'orchestration.steps', {});
  state = setStateValue(state, 'orchestration.progress', {
    tasks_completed: 0,
    tasks_total: 0,
    percentage: 0,
  });

  await writeState(state, projectRoot);

  // Update ROADMAP.md
  await updatePhaseStatus(phase.number, 'in_progress', projectRoot);

  return {
    action: 'opened',
    phase: {
      number: phase.number,
      name: phase.name,
      branch,
    },
    isHotfix: false,
    message: `Phase ${phase.number} started`,
  };
}

/**
 * Create and open a new hotfix phase
 */
async function createHotfixPhase(
  title: string | undefined,
  projectRoot: string,
): Promise<PhaseOpenOutput> {
  const roadmap = await readRoadmap(projectRoot);

  // Calculate next hotfix number
  const hotfixNumber = calculateNextHotfix(roadmap);
  if (!hotfixNumber) {
    throw new ValidationError(
      'Cannot create hotfix',
      'No active or completed phases found, or all hotfix slots are used',
    );
  }

  // Use provided title or generate one
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const phaseName = title || `Hotfix ${timestamp}`;

  // Insert new phase row in ROADMAP.md
  const insertResult = await insertPhaseRow(
    hotfixNumber,
    phaseName,
    'in_progress',
    undefined,
    projectRoot,
  );

  if (!insertResult.inserted) {
    throw new ValidationError(
      'Failed to insert phase',
      'Could not find Phase Overview table in ROADMAP.md',
    );
  }

  // Create phase detail file
  await createPhaseDetailFile(hotfixNumber, phaseName, projectRoot);

  // Create branch name with sanitized slug
  const slug = sanitizeBranchSegment(phaseName);
  const branch = `${hotfixNumber}-${slug}`;

  // Update state
  let state = await readState(projectRoot);
  state = setStateValue(state, 'orchestration.phase.number', hotfixNumber);
  state = setStateValue(state, 'orchestration.phase.name', phaseName);
  state = setStateValue(state, 'orchestration.phase.branch', branch);
  state = setStateValue(state, 'orchestration.phase.status', 'in_progress');
  state = setStateValue(state, 'orchestration.step.current', 'design');
  state = setStateValue(state, 'orchestration.step.index', 0);
  state = setStateValue(state, 'orchestration.step.status', 'not_started');
  // Reset step-specific data from previous phase
  state = setStateValue(state, 'orchestration.steps', {});
  state = setStateValue(state, 'orchestration.progress', {
    tasks_completed: 0,
    tasks_total: 0,
    percentage: 0,
  });

  await writeState(state, projectRoot);

  return {
    action: 'created',
    phase: {
      number: hotfixNumber,
      name: phaseName,
      branch,
    },
    isHotfix: true,
    message: `Hotfix phase ${hotfixNumber} created and started`,
  };
}

/**
 * Format human-readable output
 */
function formatHumanReadable(result: PhaseOpenOutput): string {
  const lines: string[] = [];

  if (result.isHotfix) {
    lines.push(`Created hotfix phase ${result.phase.number}: ${result.phase.name}`);
    lines.push(`Branch: ${result.phase.branch}`);
    lines.push('');
    lines.push('Phase added to ROADMAP.md and detail file created.');
  } else {
    lines.push(`Started Phase ${result.phase.number}: ${result.phase.name}`);
    lines.push(`Branch: ${result.phase.branch}`);
  }

  lines.push('');
  lines.push('Next steps:');
  lines.push('  git checkout -b ' + result.phase.branch);
  lines.push('  Run /flow.design to create spec artifacts');

  return lines.join('\n');
}

/**
 * Phase open action
 */
export async function openAction(
  phaseNumber: string | undefined,
  options: { json?: boolean; hotfix?: boolean | string },
): Promise<void> {
  try {
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
    }

    let result: PhaseOpenOutput;

    if (options.hotfix !== undefined && options.hotfix !== false) {
      // Create a new hotfix phase
      // If --hotfix is passed with a value, use it as the title
      const title = typeof options.hotfix === 'string' ? options.hotfix : undefined;
      result = await createHotfixPhase(title, projectRoot);
    } else {
      // Open an existing phase
      result = await openExistingPhase(phaseNumber, projectRoot);
    }

    if (options.json) {
      output(result);
    } else {
      output(result, formatHumanReadable(result));
    }
  } catch (err) {
    handleError(err);
  }
}
