import { Command } from 'commander';
import { output } from '../../lib/output.js';
import { insertPhaseRow, readRoadmap, type PhaseStatus } from '../../lib/roadmap.js';
import { findProjectRoot } from '../../lib/paths.js';
import { createPhaseDetailFile } from '../../lib/phases.js';
import { handleError, NotFoundError, ValidationError, StateError } from '../../lib/errors.js';

/**
 * Add command output
 */
export interface AddOutput {
  success: boolean;
  phase: {
    number: string;
    name: string;
    status: PhaseStatus;
    verificationGate?: string;
  };
  filePath: string;
  line: number;
  phaseDetailPath: string | null;
  phaseDetailCreated: boolean;
}

/**
 * Add action - insert a new phase into ROADMAP.md and create phase detail file
 */
export async function addAction(
  number: string,
  name: string,
  options: { json?: boolean; gate?: string; userGate?: boolean; file?: boolean },
): Promise<void> {
  try {
    const projectRoot = findProjectRoot();

    if (!projectRoot) {
      throw new NotFoundError(
        'SpecFlow project',
        'Ensure you are in a SpecFlow project directory',
      );
    }

    // Validate phase number format (4 digits)
    if (!/^\d{4}$/.test(number)) {
      throw new ValidationError(
        `Invalid phase number: ${number}. Must be 4 digits (e.g., 0010)`,
        'Use a 4-digit number like 0010, 0080, or 1020',
      );
    }

    // Check if phase already exists
    const roadmap = await readRoadmap(projectRoot);
    const existingPhase = roadmap.phases.find(p => p.number === number);
    if (existingPhase) {
      throw new ValidationError(
        `Phase ${number} already exists: ${existingPhase.name}`,
        'Choose a different phase number',
      );
    }

    // Build verification gate text
    let verificationGate = options.gate;
    if (options.userGate && verificationGate) {
      verificationGate = `**USER GATE**: ${verificationGate}`;
    } else if (options.userGate) {
      verificationGate = '**USER GATE**';
    }

    // Insert the phase
    const result = await insertPhaseRow(
      number,
      name,
      'not_started',
      verificationGate,
      projectRoot,
    );

    if (!result.inserted) {
      throw new StateError(
        'Failed to insert phase into ROADMAP.md table',
        'Check that ROADMAP.md has a valid phase table',
      );
    }

    // Create phase detail file (unless --no-file)
    let phaseDetailPath: string | null = null;
    const shouldCreateFile = options.file !== false;

    if (shouldCreateFile) {
      phaseDetailPath = await createPhaseDetailFile({
        phaseNumber: number,
        phaseName: name,
        projectPath: projectRoot,
        verificationGate,
      });
    }

    const addOutput: AddOutput = {
      success: true,
      phase: {
        number,
        name,
        status: 'not_started',
        verificationGate,
      },
      filePath: result.filePath,
      line: result.line,
      phaseDetailPath,
      phaseDetailCreated: phaseDetailPath !== null,
    };

    if (options.json) {
      output(addOutput);
    } else {
      const lines = [`Added phase ${number}: ${name}`];
      if (phaseDetailPath) {
        lines.push(`  Phase detail file: ${phaseDetailPath}`);
      } else if (shouldCreateFile) {
        lines.push('  Phase detail file already exists');
      }
      output(addOutput, lines.join('\n'));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Add command definition
 */
export const addCommand = new Command('add')
  .description('Add a new phase to ROADMAP.md and create phase detail file')
  .argument('<number>', 'Phase number (4 digits, e.g., 0010)')
  .argument('<name>', 'Phase name (kebab-case, e.g., core-engine)')
  .option('--json', 'Output as JSON')
  .option('--gate <text>', 'Verification gate description')
  .option('--user-gate', 'Mark as USER GATE (requires user verification)')
  .option('--no-file', 'Skip creating phase detail file')
  .action(addAction);
