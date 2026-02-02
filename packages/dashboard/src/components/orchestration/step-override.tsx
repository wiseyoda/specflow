'use client';

/**
 * Step Override Component (FR-004)
 *
 * Allows users to go back to a previous step in the orchestration.
 * Displays clickable steps that can be selected to restart from.
 */

import * as React from 'react';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import type { OrchestrationPhase } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

export interface StepOverrideProps {
  /** Current phase */
  currentPhase: OrchestrationPhase;
  /** Callback when a step is clicked to go back */
  onGoBack: (step: string) => void;
  /** Whether the action is disabled (e.g., during workflow execution) */
  disabled?: boolean;
  /** Whether an action is in progress */
  isLoading?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STEPS: { key: string; label: string }[] = [
  { key: 'design', label: 'Design' },
  { key: 'analyze', label: 'Analyze' },
  { key: 'implement', label: 'Implement' },
  { key: 'verify', label: 'Verify' },
];

// =============================================================================
// Main Component
// =============================================================================

export function StepOverride({
  currentPhase,
  onGoBack,
  disabled = false,
  isLoading = false,
}: StepOverrideProps) {
  const [selectedStep, setSelectedStep] = React.useState<string | null>(null);
  const currentIndex = STEPS.findIndex((s) => s.key === currentPhase);

  // Only show for steps that we can go back to
  const availableSteps = STEPS.filter((_, index) => index < currentIndex);

  if (availableSteps.length === 0) {
    return null; // Nothing to go back to
  }

  const handleClick = (step: string) => {
    if (disabled || isLoading) return;
    setSelectedStep(step);
  };

  const handleConfirm = () => {
    if (selectedStep) {
      onGoBack(selectedStep);
      setSelectedStep(null);
    }
  };

  const handleCancel = () => {
    setSelectedStep(null);
  };

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 bg-white dark:bg-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        <ArrowLeft className="w-4 h-4 text-neutral-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Go Back To Step
        </span>
      </div>

      {selectedStep ? (
        // Confirmation state
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Go back to <strong className="text-purple-600 dark:text-purple-400">{selectedStep}</strong>?
          </span>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isLoading ? (
              <span className="animate-spin">...</span>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                Confirm
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-300 dark:hover:bg-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      ) : (
        // Step selection
        <div className="flex flex-wrap gap-2">
          {availableSteps.map((step) => (
            <button
              key={step.key}
              onClick={() => handleClick(step.key)}
              disabled={disabled || isLoading}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-full transition-all
                ${disabled || isLoading
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-purple-100 dark:hover:bg-purple-900 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer'
                }
              `}
            >
              {step.label}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Click a step to restart from that point. Any work after that step will need to be re-done.
      </p>
    </div>
  );
}
