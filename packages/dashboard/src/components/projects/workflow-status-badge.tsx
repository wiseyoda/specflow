'use client';

/**
 * Workflow Status Badge component
 *
 * Shows the current workflow status with distinct visual states:
 * - Running: blue spinner
 * - Waiting: yellow "?" badge
 * - Completed: green checkmark (fades after 30s)
 * - Failed: red X
 * - Cancelled: gray slash
 * - Detached: amber warning (dashboard lost track, session may be running)
 */

import * as React from 'react';
import { Loader2, CheckCircle, XCircle, HelpCircle, Slash, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowExecution } from '@/lib/services/workflow-service';

type WorkflowStatus = WorkflowExecution['status'];

export interface WorkflowStatusBadgeProps {
  /** Current workflow status */
  status: WorkflowStatus;
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
  /** Whether the completed state should fade (controlled externally for T012) */
  isFading?: boolean;
}

const STATUS_CONFIG: Record<
  WorkflowStatus,
  {
    icon: typeof Loader2;
    label: string;
    bgColor: string;
    textColor: string;
    animate?: boolean;
  }
> = {
  running: {
    icon: Loader2,
    label: 'Running',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    animate: true,
  },
  waiting_for_input: {
    icon: HelpCircle,
    label: 'Needs Input',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
  },
  completed: {
    icon: CheckCircle,
    label: 'Complete',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
  },
  cancelled: {
    icon: Slash,
    label: 'Cancelled',
    bgColor: 'bg-neutral-100 dark:bg-neutral-800',
    textColor: 'text-neutral-600 dark:text-neutral-400',
  },
  detached: {
    icon: AlertCircle,
    label: 'Detached',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
};

/**
 * Badge showing workflow execution status
 */
export function WorkflowStatusBadge({
  status,
  showLabel = true,
  size = 'sm',
  className,
  isFading = false,
}: WorkflowStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: 'px-2 py-0.5 text-xs gap-1',
      icon: 'h-3 w-3',
    },
    md: {
      container: 'px-2.5 py-1 text-sm gap-1.5',
      icon: 'h-4 w-4',
    },
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-opacity duration-500',
        config.bgColor,
        config.textColor,
        sizeClasses[size].container,
        isFading && 'opacity-0',
        className
      )}
      role="status"
      aria-label={`Workflow status: ${config.label}`}
    >
      <Icon
        className={cn(
          sizeClasses[size].icon,
          config.animate && 'animate-spin'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * Hook to manage the 30-second fade timer for completed workflows
 *
 * Implementation note: The actual fade is handled by T012.
 * This hook provides the isFading and isHidden states.
 */
export function useWorkflowStatusFade(
  status: WorkflowStatus | undefined,
  completedAt?: string
): { isFading: boolean; isHidden: boolean } {
  const [isFading, setIsFading] = React.useState(false);
  const [isHidden, setIsHidden] = React.useState(false);

  React.useEffect(() => {
    // Only handle completed status
    if (status !== 'completed') {
      setIsFading(false);
      setIsHidden(false);
      return;
    }

    // Calculate time since completion
    const completedTime = completedAt ? new Date(completedAt).getTime() : Date.now();
    const elapsed = Date.now() - completedTime;
    const fadeDelay = 30000; // 30 seconds
    const fadeTransition = 500; // 0.5 second transition

    // If already past fade time, hide immediately
    if (elapsed >= fadeDelay + fadeTransition) {
      setIsHidden(true);
      return;
    }

    // If past fade delay but within transition, start fading
    if (elapsed >= fadeDelay) {
      setIsFading(true);
      const hideTimer = setTimeout(() => {
        setIsHidden(true);
      }, fadeTransition);
      return () => clearTimeout(hideTimer);
    }

    // Schedule fade start
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
      // Schedule hide after transition
      setTimeout(() => {
        setIsHidden(true);
      }, fadeTransition);
    }, fadeDelay - elapsed);

    return () => clearTimeout(fadeTimer);
  }, [status, completedAt]);

  return { isFading, isHidden };
}
