import { output } from '../../lib/output.js';
import { readState } from '../../lib/state.js';
import { addToBacklog, type DeferredItem } from '../../lib/backlog.js';
import { findProjectRoot } from '../../lib/paths.js';
import { handleError, NotFoundError, ValidationError } from '../../lib/errors.js';

/**
 * Phase defer output
 */
export interface PhaseDeferOutput {
  action: 'deferred';
  items: Array<{
    description: string;
    source: string;
    priority?: string;
  }>;
  count: number;
  message: string;
}

/**
 * Defer items to project backlog
 */
async function deferItems(
  items: string[],
  options: { priority?: string; reason?: string },
  projectRoot: string,
): Promise<PhaseDeferOutput> {
  // Read current state to get phase context
  const state = await readState(projectRoot);
  const { phase } = state.orchestration;

  // Determine source - current phase or "manual"
  const source = phase.number ? `Phase ${phase.number}` : 'Manual';

  // Build deferred items
  const deferredItems: DeferredItem[] = items.map(description => ({
    description,
    source,
    reason: options.reason,
    targetPhase: 'Backlog',
  }));

  // Add to backlog
  await addToBacklog(deferredItems, phase.number || 'manual', projectRoot);

  return {
    action: 'deferred',
    items: deferredItems.map(i => ({
      description: i.description,
      source: i.source,
      priority: options.priority,
    })),
    count: deferredItems.length,
    message: `${deferredItems.length} item(s) added to BACKLOG.md`,
  };
}

/**
 * Format human-readable output
 */
function formatHumanReadable(result: PhaseDeferOutput): string {
  const lines: string[] = [];

  lines.push(`Added ${result.count} item(s) to BACKLOG.md:`);
  lines.push('');

  for (const item of result.items) {
    lines.push(`  - ${item.description}`);
  }

  lines.push('');
  lines.push('View backlog: cat BACKLOG.md');

  return lines.join('\n');
}

/**
 * Phase defer action
 */
export async function deferAction(
  items: string[],
  options: { json?: boolean; priority?: string; reason?: string },
): Promise<void> {
  try {
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      throw new NotFoundError('SpecFlow project', 'Not in a SpecFlow project directory');
    }

    if (items.length === 0) {
      throw new ValidationError(
        'No items provided',
        'Usage: specflow phase defer "item 1" "item 2"',
      );
    }

    const result = await deferItems(items, options, projectRoot);

    if (options.json) {
      output(result);
    } else {
      output(result, formatHumanReadable(result));
    }
  } catch (err) {
    handleError(err);
  }
}
