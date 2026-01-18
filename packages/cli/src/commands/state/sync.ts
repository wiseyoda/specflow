import { Command } from 'commander';
import { resolve } from 'node:path';
import { readState, writeState, setStateValue } from '../../lib/state.js';
import { registerProject, isRegistered } from '../../lib/registry.js';
import { readRoadmap } from '../../lib/roadmap.js';
import { output, info, warn } from '../../lib/output.js';
import { getRoadmapPath, pathExists, findProjectRoot } from '../../lib/paths.js';

/**
 * Change entry for state sync output
 */
export interface SyncChange {
  type: 'registered' | 'history_added' | 'phase_synced';
  description: string;
  details?: unknown;
}

/**
 * Output structure for state sync command with --json flag
 */
export interface StateSyncOutput {
  status: 'success' | 'warning' | 'error';
  command: 'state sync';
  dryRun: boolean;
  changes: SyncChange[];
  warnings: string[];
  error?: { message: string; hint: string };
}

/**
 * Format human-readable output for state sync command
 */
function formatHumanReadable(result: StateSyncOutput): string {
  if (result.status === 'error' && result.error) {
    return `Error: ${result.error.message}\nHint: ${result.error.hint}`;
  }
  if (result.dryRun) {
    return 'Dry run - no changes made';
  }
  if (result.changes.length === 0) {
    return 'State is in sync';
  }
  return 'State synced with filesystem';
}

/**
 * Sync state with filesystem (absorbs reconcile.sh functionality)
 *
 * Examples:
 *   specflow state sync              Sync state with filesystem
 *   specflow state sync --dry-run    Preview changes
 *   specflow state sync --trust-files    Filesystem wins on conflicts
 *   specflow state sync --trust-state    State file wins on conflicts
 */
export const sync = new Command('sync')
  .description('Sync state with filesystem')
  .option('--dry-run', 'Preview changes without applying')
  .option('--trust-files', 'Filesystem wins on conflicts')
  .option('--trust-state', 'State file wins on conflicts')
  .action(
    async (options: {
      dryRun?: boolean;
      trustFiles?: boolean;
      trustState?: boolean;
    }) => {
      // Initialize result for JSON output
      const result: StateSyncOutput = {
        status: 'success',
        command: 'state sync',
        dryRun: options.dryRun ?? false,
        changes: [],
        warnings: [],
      };

      try {
        let state = await readState();
        let hasChanges = false;
        const projectPath = resolve(process.cwd());

        // Ensure project is registered in central registry
        if (!isRegistered(state.project.id)) {
          if (!options.dryRun) {
            registerProject(state.project.id, state.project.name, projectPath);
            hasChanges = true;
          }
          result.changes.push({
            type: 'registered',
            description: options.dryRun
              ? 'Would register project in dashboard'
              : 'Registered project in dashboard',
          });
          info(
            options.dryRun
              ? 'Would register project in dashboard'
              : 'Registered project in dashboard',
          );
        }

        // Check ROADMAP exists
        const roadmapPath = getRoadmapPath();
        if (!pathExists(roadmapPath)) {
          result.warnings.push('ROADMAP.md not found');
          result.status = 'warning';
          warn('ROADMAP.md not found');
        }

        // Sync history from ROADMAP - add missing completed phases
        const projectRoot = findProjectRoot() ?? projectPath;
        let roadmap;
        try {
          roadmap = await readRoadmap(projectRoot);
        } catch {
          // ROADMAP not available - skip history sync
          roadmap = null;
        }
        const completedPhases = roadmap?.phases.filter((p) => p.status === 'complete') ?? [];

        // Get existing history phase numbers
        interface HistoryEntry {
          type: string;
          phase_number?: string;
          phase_name?: string;
          branch?: string | null;
          completed_at?: string;
          tasks_completed?: number | string;
          tasks_total?: number | string;
        }
        const existingHistory = (state.actions?.history as HistoryEntry[]) ?? [];
        const existingPhaseNumbers = new Set(
          existingHistory.filter((h) => h.type === 'phase_completed').map((h) => h.phase_number),
        );

        // Find missing phases
        const missingPhases = completedPhases.filter((p) => !existingPhaseNumbers.has(p.number));

        if (missingPhases.length > 0) {
          info(`Found ${missingPhases.length} completed phases missing from history`);

          if (!options.dryRun) {
            // Add missing phases to history
            const newEntries: HistoryEntry[] = missingPhases.map((p) => ({
              type: 'phase_completed',
              phase_number: p.number,
              phase_name: p.name,
              branch: `${p.number}-${p.name}`,
              completed_at: new Date().toISOString(),
              tasks_completed: 0,
              tasks_total: 0,
            }));

            const updatedHistory = [...existingHistory, ...newEntries];
            state = setStateValue(state, 'actions.history', updatedHistory);
            hasChanges = true;

            for (const p of missingPhases) {
              result.changes.push({
                type: 'history_added',
                description: `Added: ${p.number} - ${p.name}`,
                details: { phaseNumber: p.number, phaseName: p.name },
              });
              info(`  Added: ${p.number} - ${p.name}`);
            }
          } else {
            for (const p of missingPhases) {
              result.changes.push({
                type: 'history_added',
                description: `Would add: ${p.number} - ${p.name}`,
                details: { phaseNumber: p.number, phaseName: p.name },
              });
              info(`  Would add: ${p.number} - ${p.name}`);
            }
          }
        }

        if (options.dryRun) {
          output(result, formatHumanReadable(result));
          return;
        }

        if (hasChanges) {
          await writeState(state, projectRoot);
        }

        output(result, formatHumanReadable(result));
      } catch (err) {
        result.status = 'error';
        result.error = {
          message: err instanceof Error ? err.message : 'Unknown error',
          hint: 'Check the error message for details',
        };
        output(result, `Error: ${result.error.message}\nHint: ${result.error.hint}`);
        process.exitCode = 1;
      }
    },
  );
