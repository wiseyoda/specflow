'use client';

/**
 * Phase Progress Bar
 *
 * Visual indicator showing progress through orchestration phases:
 * Design → Analyze → Implement → Verify → Merge
 */

import * as React from 'react';
import { Check } from 'lucide-react';
import type { OrchestrationPhase } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

export interface PhaseProgressBarProps {
  /** Current phase */
  currentPhase: OrchestrationPhase;
  /** Phases that have been skipped */
  skippedPhases?: OrchestrationPhase[];
  /** Whether orchestration is paused */
  isPaused?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const PHASES: { key: OrchestrationPhase; label: string }[] = [
  { key: 'design', label: 'Design' },
  { key: 'analyze', label: 'Analyze' },
  { key: 'implement', label: 'Implement' },
  { key: 'verify', label: 'Verify' },
  { key: 'merge', label: 'Merge' },
];

// =============================================================================
// Main Component
// =============================================================================

export function PhaseProgressBar({
  currentPhase,
  skippedPhases = [],
  isPaused = false,
}: PhaseProgressBarProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center justify-between w-full">
      {PHASES.map((phase, index) => {
        const isComplete = index < currentIndex || currentPhase === 'complete';
        const isCurrent = index === currentIndex && currentPhase !== 'complete';
        const isSkipped = skippedPhases.includes(phase.key);
        const isPending = index > currentIndex;

        return (
          <React.Fragment key={phase.key}>
            {/* Phase indicator */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  relative flex items-center justify-center w-8 h-8 rounded-full transition-all
                  ${isComplete ? 'bg-green-500 text-white' : ''}
                  ${isCurrent && !isPaused ? 'bg-purple-500 text-white ring-2 ring-purple-300 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900' : ''}
                  ${isCurrent && isPaused ? 'bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900' : ''}
                  ${isSkipped ? 'bg-neutral-300 dark:bg-neutral-600 text-neutral-500' : ''}
                  ${isPending && !isSkipped ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500' : ''}
                `}
              >
                {isComplete ? (
                  <Check className="w-4 h-4" />
                ) : isSkipped ? (
                  <span className="text-xs">—</span>
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
                {/* Pulse animation for current phase */}
                {isCurrent && !isPaused && (
                  <span className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-25" />
                )}
              </div>
              <span
                className={`
                  text-xs font-medium
                  ${isComplete ? 'text-green-600 dark:text-green-400' : ''}
                  ${isCurrent ? 'text-purple-600 dark:text-purple-400' : ''}
                  ${isSkipped ? 'text-neutral-400 line-through' : ''}
                  ${isPending && !isSkipped ? 'text-neutral-400 dark:text-neutral-500' : ''}
                `}
              >
                {phase.label}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {index < PHASES.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 mx-2 transition-colors
                  ${index < currentIndex ? 'bg-green-500' : 'bg-neutral-200 dark:bg-neutral-700'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
