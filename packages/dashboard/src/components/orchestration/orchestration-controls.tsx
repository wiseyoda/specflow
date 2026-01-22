'use client';

/**
 * Orchestration Controls
 *
 * Pause/Resume and Cancel buttons during active orchestration.
 */

import * as React from 'react';
import { Pause, Play, XCircle, Loader2, Terminal, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// =============================================================================
// Types
// =============================================================================

export interface OrchestrationControlsProps {
  /** Whether orchestration is paused */
  isPaused: boolean;
  /** Callback for pause action */
  onPause?: () => void;
  /** Callback for resume action */
  onResume?: () => void;
  /** Callback for cancel action */
  onCancel?: () => void;
  /** Callback for view session action */
  onViewSession?: () => void;
  /** Whether there's an active session (green if true, gray if false) */
  hasActiveSession?: boolean;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Whether an action is in progress */
  isLoading?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function OrchestrationControls({
  isPaused,
  onPause,
  onResume,
  onCancel,
  onViewSession,
  hasActiveSession = false,
  disabled = false,
  isLoading = false,
}: OrchestrationControlsProps) {
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);

  const handleCancelConfirm = React.useCallback(() => {
    onCancel?.();
    setShowCancelDialog(false);
  }, [onCancel]);

  return (
    <>
      <div className="flex items-center justify-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
        {/* View Session Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onViewSession}
          className={`gap-2 ${
            hasActiveSession
              ? 'border-green-500/50 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
              : 'text-neutral-500'
          }`}
        >
          <Terminal className="h-4 w-4" />
          View Session
        </Button>

        {/* Pause/Resume Button */}
        {isPaused ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onResume}
            disabled={disabled || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Resume
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onPause}
            disabled={disabled || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Pause
          </Button>
        )}

        {/* Cancel Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelDialog(true)}
          disabled={disabled || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Cancel
        </Button>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle>Cancel Orchestration?</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This will <strong>permanently stop</strong> the orchestration and kill the running Claude process.
              You will not be able to resume from this point.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
            <strong>Tip:</strong> If you just want to stop temporarily, use <strong>Pause</strong> instead.
            You can resume a paused orchestration later.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Running
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancel Orchestration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
