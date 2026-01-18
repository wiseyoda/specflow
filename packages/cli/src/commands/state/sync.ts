import { Command } from 'commander';
import { resolve } from 'node:path';
import { readState, writeState, setStateValue } from '../../lib/state.js';
import { registerProject, isRegistered } from '../../lib/registry.js';
import { readRoadmap } from '../../lib/roadmap.js';
import { success, info, warn } from '../../lib/output.js';
import { handleError } from '../../lib/errors.js';
import { getRoadmapPath, pathExists, findProjectRoot } from '../../lib/paths.js';

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
    async (options: { dryRun?: boolean; trustFiles?: boolean; trustState?: boolean }) => {
      try {
        let state = await readState();
        let hasChanges = false;
        const projectPath = resolve(process.cwd());

        // Ensure project is registered in central registry
        if (!isRegistered(state.project.id)) {
          registerProject(state.project.id, state.project.name, projectPath);
          info('Registered project in dashboard');
          hasChanges = true;
        }

        // Check ROADMAP exists
        const roadmapPath = getRoadmapPath();
        if (!pathExists(roadmapPath)) {
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
        const completedPhases = roadmap?.phases.filter(p => p.status === 'complete') ?? [];

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
          existingHistory
            .filter((h) => h.type === 'phase_completed')
            .map((h) => h.phase_number),
        );

        // Find missing phases
        const missingPhases = completedPhases.filter(
          (p) => !existingPhaseNumbers.has(p.number),
        );

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
              info(`  Added: ${p.number} - ${p.name}`);
            }
          } else {
            for (const p of missingPhases) {
              info(`  Would add: ${p.number} - ${p.name}`);
            }
          }
        }

        if (options.dryRun) {
          info('Dry run - no changes made');
          return;
        }

        if (hasChanges) {
          await writeState(state, projectRoot);
          success('State synced with filesystem');
        } else {
          info('State is in sync');
        }
      } catch (err) {
        handleError(err);
      }
    },
  );
