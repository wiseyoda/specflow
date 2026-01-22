'use client';

/**
 * Orchestration Badge
 *
 * Badge shown on project cards when orchestration is active.
 * Different styling from regular workflow badges.
 */

import * as React from 'react';
import { Layers, Loader2, CheckCircle2, AlertCircle, Clock, Pause } from 'lucide-react';
import type { OrchestrationStatus } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

export interface OrchestrationBadgeProps {
  /** Current orchestration status */
  status: OrchestrationStatus;
  /** Current batch number (1-indexed) */
  currentBatch?: number;
  /** Total batches */
  totalBatches?: number;
  /** Compact mode (just icon) */
  compact?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function OrchestrationBadge({
  status,
  currentBatch,
  totalBatches,
  compact = false,
}: OrchestrationBadgeProps) {
  const config = getStatusConfig(status, currentBatch, totalBatches);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${config.bgClass}`}
        title={config.label}
      >
        <config.icon className={`h-3 w-3 ${config.iconClass}`} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${config.bgClass} ${config.textClass}`}
    >
      <config.icon className={`h-3 w-3 ${config.iconClass}`} />
      {config.label}
    </span>
  );
}

// =============================================================================
// Helper Function
// =============================================================================

function getStatusConfig(
  status: OrchestrationStatus,
  currentBatch?: number,
  totalBatches?: number
) {
  switch (status) {
    case 'running':
      return {
        icon: Loader2,
        iconClass: 'animate-spin',
        label: currentBatch && totalBatches
          ? `Batch ${currentBatch}/${totalBatches}`
          : 'Running',
        bgClass: 'bg-purple-100 dark:bg-purple-900/30',
        textClass: 'text-purple-700 dark:text-purple-300',
      };

    case 'paused':
      return {
        icon: Pause,
        iconClass: '',
        label: 'Paused',
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
        textClass: 'text-amber-700 dark:text-amber-300',
      };

    case 'waiting_merge':
      return {
        icon: Clock,
        iconClass: '',
        label: 'Merge Ready',
        bgClass: 'bg-blue-100 dark:bg-blue-900/30',
        textClass: 'text-blue-700 dark:text-blue-300',
      };

    case 'completed':
      return {
        icon: CheckCircle2,
        iconClass: '',
        label: 'Complete',
        bgClass: 'bg-green-100 dark:bg-green-900/30',
        textClass: 'text-green-700 dark:text-green-300',
      };

    case 'failed':
      return {
        icon: AlertCircle,
        iconClass: '',
        label: 'Failed',
        bgClass: 'bg-red-100 dark:bg-red-900/30',
        textClass: 'text-red-700 dark:text-red-300',
      };

    case 'cancelled':
      return {
        icon: AlertCircle,
        iconClass: '',
        label: 'Cancelled',
        bgClass: 'bg-neutral-100 dark:bg-neutral-800',
        textClass: 'text-neutral-600 dark:text-neutral-400',
      };

    default:
      return {
        icon: Layers,
        iconClass: '',
        label: status,
        bgClass: 'bg-neutral-100 dark:bg-neutral-800',
        textClass: 'text-neutral-600 dark:text-neutral-400',
      };
  }
}
