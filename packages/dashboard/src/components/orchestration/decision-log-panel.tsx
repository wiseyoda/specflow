'use client';

/**
 * Decision Log Panel
 *
 * Collapsible panel showing orchestration decision log entries.
 * Useful for debugging state machine transitions.
 */

import * as React from 'react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { DecisionLogEntry } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

export interface DecisionLogPanelProps {
  /** Decision log entries */
  entries: DecisionLogEntry[];
  /** Maximum entries to show */
  maxEntries?: number;
  /** Initially collapsed */
  defaultCollapsed?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function DecisionLogPanel({
  entries,
  maxEntries = 10,
  defaultCollapsed = true,
}: DecisionLogPanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  // Show most recent entries first, limited to maxEntries
  const displayEntries = React.useMemo(
    () => [...entries].reverse().slice(0, maxEntries),
    [entries, maxEntries]
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          )}
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Decision Log
          </span>
        </div>
        <span className="text-xs text-neutral-400">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </button>

      {/* Entries */}
      {!isCollapsed && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-48 overflow-y-auto">
          {displayEntries.map((entry, index) => (
            <div
              key={`${entry.timestamp}-${index}`}
              className="px-3 py-2 text-xs"
            >
              <div className="flex items-start gap-2">
                <Clock className="h-3 w-3 text-neutral-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 font-mono">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                      {entry.decision}
                    </span>
                  </div>
                  <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {entry.reason}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {entries.length > maxEntries && (
            <div className="px-3 py-2 text-xs text-neutral-400 text-center">
              Showing {maxEntries} of {entries.length} entries
            </div>
          )}
        </div>
      )}
    </div>
  );
}
