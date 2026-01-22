'use client';

/**
 * Merge Ready Panel
 *
 * Shown when orchestration is paused at merge step (waiting_merge status).
 * Provides Run Merge button for user to trigger merge.
 */

import * as React from 'react';
import { GitMerge, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// Types
// =============================================================================

export interface MergeReadyPanelProps {
  /** Callback for merge action */
  onMerge?: () => void;
  /** Callback for view diff action */
  onViewDiff?: () => void;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Whether merge is in progress */
  isLoading?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function MergeReadyPanel({
  onMerge,
  onViewDiff,
  disabled = false,
  isLoading = false,
}: MergeReadyPanelProps) {
  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
      {/* Status */}
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Merge Ready
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            All tasks complete. Phase verified and ready to merge.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={onMerge}
          disabled={disabled || isLoading}
          className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitMerge className="h-4 w-4" />
          )}
          Run Merge
        </Button>

        {onViewDiff && (
          <Button
            variant="outline"
            onClick={onViewDiff}
            disabled={disabled || isLoading}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View Diff
          </Button>
        )}
      </div>
    </div>
  );
}
