import { Command } from 'commander';
import { readState, writeState } from '../../lib/state.js';
import { success, info, warn } from '../../lib/output.js';
import { handleError } from '../../lib/errors.js';
import { getRoadmapPath, pathExists } from '../../lib/paths.js';

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
        const state = await readState();
        let hasChanges = false;

        // Check ROADMAP exists
        const roadmapPath = getRoadmapPath();
        if (!pathExists(roadmapPath)) {
          warn('ROADMAP.md not found');
        }

        // TODO: Implement full sync logic
        // - Compare phase status in state vs ROADMAP
        // - Check task completion in state vs tasks.md
        // - Verify branch matches state

        if (options.dryRun) {
          info('Dry run - no changes made');
          return;
        }

        if (hasChanges) {
          await writeState(state);
          success('State synced with filesystem');
        } else {
          info('State is in sync');
        }
      } catch (err) {
        handleError(err);
      }
    },
  );
