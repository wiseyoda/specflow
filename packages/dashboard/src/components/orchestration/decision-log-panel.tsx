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
  /** Maximum entries to show when expanded */
  maxEntries?: number;
  /** Initially collapsed */
  defaultCollapsed?: boolean;
  /** Number of entries to show as preview when collapsed (0 to hide) */
  previewCount?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format timestamp as relative time (e.g., "2m ago", "1h ago")
 */
function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();

    // Handle future dates or invalid dates
    if (diffMs < 0 || isNaN(diffMs)) {
      return 'now';
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return diffSeconds <= 5 ? 'now' : `${diffSeconds}s ago`;
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    // For older entries, show the date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
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
  previewCount = 3,
}: DecisionLogPanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  // Show most recent entries first, limited to maxEntries
  const displayEntries = React.useMemo(
    () => [...entries].reverse().slice(0, maxEntries),
    [entries, maxEntries]
  );

  // Preview entries shown when collapsed
  const previewEntries = React.useMemo(
    () => displayEntries.slice(0, previewCount),
    [displayEntries, previewCount]
  );

  if (entries.length === 0) {
    return null;
  }

  // Render a single entry row
  const renderEntry = (entry: DecisionLogEntry, index: number) => (
    <div
      key={`${entry.timestamp}-${index}`}
      className="px-3 py-2 text-xs"
    >
      <div className="flex items-start gap-2">
        <Clock className="h-3 w-3 text-neutral-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-mono">
              {formatRelativeTime(entry.timestamp)}
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
  );

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

      {/* Preview entries (shown when collapsed) */}
      {isCollapsed && previewCount > 0 && previewEntries.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          {previewEntries.map(renderEntry)}
          {entries.length > previewCount && (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="w-full px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Show {Math.min(entries.length, maxEntries) - previewCount} more...
            </button>
          )}
        </div>
      )}

      {/* Full entries (shown when expanded) */}
      {!isCollapsed && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-48 overflow-y-auto">
          {displayEntries.map(renderEntry)}
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
