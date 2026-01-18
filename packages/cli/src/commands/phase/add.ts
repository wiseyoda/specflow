import { Command } from 'commander';
import { output } from '../../lib/output.js';
import { insertPhaseRow, readRoadmap, type PhaseStatus } from '../../lib/roadmap.js';
import { findProjectRoot } from '../../lib/paths.js';
import { handleError, NotFoundError } from '../../lib/errors.js';

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
}

/**
 * Add action - insert a new phase into ROADMAP.md
 */
export async function addAction(
  number: string,
  name: string,
  options: { json?: boolean; gate?: string; userGate?: boolean },
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
      throw new Error(`Invalid phase number: ${number}. Must be 4 digits (e.g., 0010)`);
    }

    // Check if phase already exists
    const roadmap = await readRoadmap(projectRoot);
    const existingPhase = roadmap.phases.find(p => p.number === number);
    if (existingPhase) {
      throw new Error(`Phase ${number} already exists: ${existingPhase.name}`);
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
      throw new Error('Failed to insert phase into ROADMAP.md table');
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
    };

    if (options.json) {
      output(addOutput);
    } else {
      output(addOutput, `Added phase ${number}: ${name}`);
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Add command definition
 */
export const addCommand = new Command('add')
  .description('Add a new phase to ROADMAP.md')
  .argument('<number>', 'Phase number (4 digits, e.g., 0010)')
  .argument('<name>', 'Phase name (kebab-case, e.g., core-engine)')
  .option('--json', 'Output as JSON')
  .option('--gate <text>', 'Verification gate description')
  .option('--user-gate', 'Mark as USER GATE (requires user verification)')
  .action(addAction);
