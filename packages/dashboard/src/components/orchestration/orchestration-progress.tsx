'use client';

/**
 * Orchestration Progress Component
 *
 * Main progress display that shows during active orchestration.
 * Combines phase progress, batch progress, decision log, and controls.
 */

import * as React from 'react';
import { Clock, AlertCircle, CheckCircle2, Loader2, HelpCircle, Wrench } from 'lucide-react';
import { PhaseProgressBar } from './phase-progress-bar';
import { BatchProgress } from './batch-progress';
import { DecisionLogPanel } from './decision-log-panel';
import { OrchestrationControls } from './orchestration-controls';
import { MergeReadyPanel } from './merge-ready-panel';
import { RecoveryPanel, type RecoveryOption } from './recovery-panel';
import type {
  OrchestrationPhase,
  DecisionLogEntry,
} from '@specflow/shared';
import type { OrchestrationExecution } from '@/lib/services/orchestration-types';

// =============================================================================
// Types
// =============================================================================

export interface OrchestrationProgressProps {
  /** The orchestration execution state */
  orchestration: OrchestrationExecution;
  /** Callback for pause action */
  onPause?: () => void;
  /** Callback for resume action */
  onResume?: () => void;
  /** Callback for cancel action */
  onCancel?: () => void;
  /** Callback for merge action */
  onMerge?: () => void;
  /** Callback for recovery action (retry/skip/abort) */
  onRecover?: (action: RecoveryOption) => void;
  /** Callback for view session action */
  onViewSession?: () => void;
  /** Whether there's an active session */
  hasActiveSession?: boolean;
  /** Whether controls are disabled */
  controlsDisabled?: boolean;
  /** Whether the current workflow is waiting for user input (FR-072) */
  isWaitingForInput?: boolean;
  /** Whether a recovery action is in progress */
  isRecovering?: boolean;
  /** Which recovery action is loading */
  recoveryAction?: RecoveryOption;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function getSkippedPhases(config: OrchestrationExecution['config']): OrchestrationPhase[] {
  const skipped: OrchestrationPhase[] = [];
  if (config.skipDesign) skipped.push('design');
  if (config.skipAnalyze) skipped.push('analyze');
  return skipped;
}

/**
 * Calculate estimated time remaining based on batch completion rate
 */
function getEstimatedTimeRemaining(orchestration: OrchestrationExecution): string | null {
  // Only show estimate during implement phase with multiple batches
  if (orchestration.currentPhase !== 'implement') return null;
  if (orchestration.batches.total <= 1) return null;

  // Find completed batches and their durations
  const completedBatches = orchestration.batches.items.filter(
    b => (b.status === 'completed' || b.status === 'healed') && b.startedAt && b.completedAt
  );

  if (completedBatches.length === 0) return null;

  // Calculate average batch duration
  let totalDuration = 0;
  for (const batch of completedBatches) {
    const start = new Date(batch.startedAt!).getTime();
    const end = new Date(batch.completedAt!).getTime();
    totalDuration += (end - start);
  }
  const avgBatchDuration = totalDuration / completedBatches.length;

  // Calculate remaining batches
  const remainingBatches = orchestration.batches.items.filter(
    b => b.status === 'pending' || b.status === 'running' || b.status === 'failed'
  ).length;

  if (remainingBatches === 0) return null;

  // Estimate remaining time
  const estimatedMs = avgBatchDuration * remainingBatches;
  return formatDuration(estimatedMs);
}

function getCurrentBatchInfo(orchestration: OrchestrationExecution) {
  const batch = orchestration.batches.items[orchestration.batches.current];
  if (!batch) return null;

  // Calculate overall progress from all batch items
  let overallComplete = 0;
  let overallTotal = 0;
  for (const b of orchestration.batches.items) {
    overallTotal += b.taskIds.length;
    if (b.status === 'completed' || b.status === 'healed') {
      overallComplete += b.taskIds.length;
    }
  }

  // Determine if healing is in progress:
  // Healing is active when batch has failed, has heal attempts, and hasn't exceeded max attempts
  const isHealing = batch.status === 'failed' &&
    batch.healAttempts > 0 &&
    batch.healAttempts <= orchestration.config.maxHealAttempts;

  return {
    currentBatch: orchestration.batches.current + 1,
    totalBatches: orchestration.batches.total,
    sectionName: batch.section,
    tasksComplete: batch.status === 'completed' || batch.status === 'healed' ? batch.taskIds.length : 0,
    totalTasks: batch.taskIds.length,
    overallTasksComplete: overallComplete,
    overallTotalTasks: overallTotal,
    isHealing,
    healAttempt: batch.healAttempts,
    maxHealAttempts: orchestration.config.maxHealAttempts,
  };
}

// =============================================================================
// Main Component
// =============================================================================

export function OrchestrationProgress({
  orchestration,
  onPause,
  onResume,
  onCancel,
  onMerge,
  onRecover,
  onViewSession,
  hasActiveSession = false,
  controlsDisabled = false,
  isWaitingForInput = false,
  isRecovering = false,
  recoveryAction,
}: OrchestrationProgressProps) {
  const elapsedMs = React.useMemo(() => {
    const start = new Date(orchestration.startedAt).getTime();
    const now = orchestration.completedAt
      ? new Date(orchestration.completedAt).getTime()
      : Date.now();
    return now - start;
  }, [orchestration.startedAt, orchestration.completedAt]);

  const isPaused = orchestration.status === 'paused';
  const isWaitingMerge = orchestration.status === 'waiting_merge';
  const isNeedsAttention = orchestration.status === 'needs_attention';
  const isCompleted = orchestration.status === 'completed';
  const isFailed = orchestration.status === 'failed';
  const isCancelled = orchestration.status === 'cancelled';
  const isTerminal = isCompleted || isFailed || isCancelled;

  const skippedPhases = getSkippedPhases(orchestration.config);
  const batchInfo = getCurrentBatchInfo(orchestration);
  const estimatedRemaining = getEstimatedTimeRemaining(orchestration);

  return (
    <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Orchestration Progress
        </h3>
        {isTerminal ? (
          <StatusBadge status={orchestration.status} />
        ) : (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(elapsedMs)}
            </div>
            {estimatedRemaining && (
              <div className="flex items-center gap-1 text-neutral-400">
                <span>~{estimatedRemaining} remaining</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase Progress */}
      <PhaseProgressBar
        currentPhase={orchestration.currentPhase}
        skippedPhases={skippedPhases}
        isPaused={isPaused}
      />

      {/* Batch Progress (during implement phase) */}
      {orchestration.currentPhase === 'implement' && batchInfo && !isTerminal && (
        <BatchProgress {...batchInfo} />
      )}

      {/* User Input Waiting Indicator (FR-072) */}
      {isWaitingForInput && !isTerminal && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg animate-pulse">
          <HelpCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Waiting for input
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">
              The workflow is waiting for your response. Check the session viewer.
            </div>
          </div>
        </div>
      )}

      {/* Healing Indicator (FR-072) */}
      {batchInfo?.isHealing && !isTerminal && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Wrench className="h-4 w-4 text-amber-500 mt-0.5 shrink-0 animate-pulse" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Auto-healing in progress
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Attempting to fix the issue and continue (attempt {batchInfo.healAttempt} of {batchInfo.maxHealAttempts})
            </div>
          </div>
        </div>
      )}

      {/* Merge Ready Panel */}
      {isWaitingMerge && (
        <MergeReadyPanel
          onMerge={onMerge}
          disabled={controlsDisabled}
        />
      )}

      {/* Recovery Panel (needs_attention status) */}
      {isNeedsAttention && orchestration.recoveryContext && (
        <RecoveryPanel
          issue={orchestration.recoveryContext.issue}
          options={orchestration.recoveryContext.options}
          onRecover={onRecover}
          disabled={controlsDisabled}
          isLoading={isRecovering}
          loadingAction={recoveryAction}
        />
      )}

      {/* Error Display */}
      {isFailed && orchestration.errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-700 dark:text-red-300">
            {orchestration.errorMessage}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isCompleted && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Phase completed successfully!
          </span>
        </div>
      )}

      {/* Decision Log */}
      <DecisionLogPanel
        entries={orchestration.decisionLog}
        maxEntries={10}
        defaultCollapsed={true}
      />

      {/* Controls */}
      {!isTerminal && !isWaitingMerge && (
        <OrchestrationControls
          isPaused={isPaused}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onViewSession={onViewSession}
          hasActiveSession={hasActiveSession}
          disabled={controlsDisabled}
        />
      )}

      {/* Cost Display */}
      {orchestration.totalCostUsd > 0 && (
        <div className="text-xs text-neutral-500 text-right">
          Total cost: ${orchestration.totalCostUsd.toFixed(2)}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Status Badge Sub-component
// =============================================================================

function StatusBadge({ status }: { status: OrchestrationExecution['status'] }) {
  const config = {
    completed: {
      icon: CheckCircle2,
      label: 'Completed',
      className: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    },
    failed: {
      icon: AlertCircle,
      label: 'Failed',
      className: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
    },
    cancelled: {
      icon: AlertCircle,
      label: 'Cancelled',
      className: 'text-neutral-600 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800',
    },
    running: {
      icon: Loader2,
      label: 'Running',
      className: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
    },
    paused: {
      icon: Clock,
      label: 'Paused',
      className: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
    },
    waiting_merge: {
      icon: Clock,
      label: 'Merge Ready',
      className: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    },
    needs_attention: {
      icon: AlertCircle,
      label: 'Needs Attention',
      className: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
    },
  }[status] || {
    icon: Clock,
    label: status,
    className: 'text-neutral-600 bg-neutral-100',
  };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
