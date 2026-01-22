'use client';

/**
 * Recovery Panel
 *
 * Shown when orchestration encounters an error that needs user attention.
 * Provides options to retry, skip, or abort the failed operation.
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw, SkipForward, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// Types
// =============================================================================

export type RecoveryOption = 'retry' | 'skip' | 'abort';

export interface RecoveryPanelProps {
  /** Description of what went wrong */
  issue: string;
  /** Available recovery options */
  options: RecoveryOption[];
  /** Callback when user selects a recovery action */
  onRecover?: (action: RecoveryOption) => void;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Whether recovery is in progress */
  isLoading?: boolean;
  /** Which action is currently loading */
  loadingAction?: RecoveryOption;
}

// =============================================================================
// Main Component
// =============================================================================

export function RecoveryPanel({
  issue,
  options,
  onRecover,
  disabled = false,
  isLoading = false,
  loadingAction,
}: RecoveryPanelProps) {
  const handleAction = (action: RecoveryOption) => {
    if (onRecover && !disabled && !isLoading) {
      onRecover(action);
    }
  };

  return (
    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg space-y-4">
      {/* Status */}
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-orange-900 dark:text-orange-100">
            Action Required
          </h4>
          <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
            {issue}
          </p>
        </div>
      </div>

      {/* Recovery Actions */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {options.includes('retry') && (
          <Button
            onClick={() => handleAction('retry')}
            disabled={disabled || isLoading}
            className="gap-2 bg-orange-600 hover:bg-orange-500 text-white"
          >
            {isLoading && loadingAction === 'retry' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retry
          </Button>
        )}

        {options.includes('skip') && (
          <Button
            variant="outline"
            onClick={() => handleAction('skip')}
            disabled={disabled || isLoading}
            className="gap-2 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30"
          >
            {isLoading && loadingAction === 'skip' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
            Skip
          </Button>
        )}

        {options.includes('abort') && (
          <Button
            variant="outline"
            onClick={() => handleAction('abort')}
            disabled={disabled || isLoading}
            className="gap-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            {isLoading && loadingAction === 'abort' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Abort
          </Button>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-orange-600 dark:text-orange-400 text-center space-y-1">
        <p><strong>Retry</strong> - Attempt the operation again</p>
        <p><strong>Skip</strong> - Skip this step and continue with the next</p>
        <p><strong>Abort</strong> - Stop the orchestration entirely</p>
      </div>
    </div>
  );
}
