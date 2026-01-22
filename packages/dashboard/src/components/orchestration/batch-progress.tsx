'use client';

/**
 * Batch Progress Component
 *
 * Shows current batch progress during implement phase.
 * Displays batch name, task counts, and progress bar.
 */

import * as React from 'react';
import { Wrench } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface BatchProgressProps {
  /** Current batch index (1-indexed for display) */
  currentBatch: number;
  /** Total number of batches */
  totalBatches: number;
  /** Section/batch name */
  sectionName: string;
  /** Tasks complete in this batch */
  tasksComplete: number;
  /** Total tasks in this batch */
  totalTasks: number;
  /** Overall tasks complete (across all batches) */
  overallTasksComplete: number;
  /** Overall total tasks */
  overallTotalTasks: number;
  /** Whether healing is in progress */
  isHealing?: boolean;
  /** Current heal attempt */
  healAttempt?: number;
  /** Max heal attempts */
  maxHealAttempts?: number;
}

// =============================================================================
// Main Component
// =============================================================================

export function BatchProgress({
  currentBatch,
  totalBatches,
  sectionName,
  tasksComplete,
  totalTasks,
  overallTasksComplete,
  overallTotalTasks,
  isHealing = false,
  healAttempt = 0,
  maxHealAttempts = 1,
}: BatchProgressProps) {
  const percentage = overallTotalTasks > 0
    ? Math.round((overallTasksComplete / overallTotalTasks) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Batch header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {isHealing ? (
              <span className="text-amber-500">
                Auto-healing batch {currentBatch}...
              </span>
            ) : (
              <>
                Implementing batch {currentBatch} of {totalBatches}
              </>
            )}
          </span>
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {overallTasksComplete}/{overallTotalTasks} tasks ({percentage}%)
        </span>
      </div>

      {/* Section name */}
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        {sectionName}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full transition-all duration-500
            ${isHealing ? 'bg-amber-500' : 'bg-gradient-to-r from-purple-600 to-purple-400'}
          `}
          style={{ width: `${percentage}%` }}
        />
        {/* Pulse animation when active */}
        {!isHealing && (
          <div
            className="absolute inset-y-0 left-0 bg-purple-400 rounded-full animate-pulse opacity-50"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>

      {/* Healing info */}
      {isHealing && healAttempt > 0 && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          Heal attempt: {healAttempt} of {maxHealAttempts}
        </div>
      )}
    </div>
  );
}
