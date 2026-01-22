'use client';

/**
 * Session Controls
 *
 * Pause and Cancel buttons for active sessions.
 * Shows confirmation modal before canceling.
 */

import * as React from 'react';
import { Pause, XCircle, Loader2, AlertTriangle } from 'lucide-react';
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

export interface SessionControlsProps {
  /** Callback for pause action */
  onPause?: () => void;
  /** Callback for cancel action */
  onCancel?: () => void;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Whether an action is in progress */
  isLoading?: boolean;
  /** Whether pause is available (e.g., when part of orchestration) */
  showPause?: boolean;
  /** Compact mode - shows smaller buttons */
  compact?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function SessionControls({
  onPause,
  onCancel,
  disabled = false,
  isLoading = false,
  showPause = false,
  compact = false,
}: SessionControlsProps) {
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);

  const handleCancelConfirm = React.useCallback(() => {
    onCancel?.();
    setShowCancelDialog(false);
  }, [onCancel]);

  const buttonSize = compact ? 'sm' : 'default';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Pause Button (optional) */}
        {showPause && onPause && (
          <Button
            variant="outline"
            size={buttonSize}
            onClick={onPause}
            disabled={disabled || isLoading}
            className={compact ? 'gap-1.5 px-2 py-1 h-7 text-xs' : 'gap-2'}
          >
            {isLoading ? (
              <Loader2 className={`${iconSize} animate-spin`} />
            ) : (
              <Pause className={iconSize} />
            )}
            {!compact && 'Pause'}
          </Button>
        )}

        {/* Cancel Button */}
        <Button
          variant="outline"
          size={buttonSize}
          onClick={() => setShowCancelDialog(true)}
          disabled={disabled || isLoading}
          className={compact
            ? 'gap-1.5 px-2 py-1 h-7 text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50'
            : 'gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50'
          }
        >
          {isLoading ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <XCircle className={iconSize} />
          )}
          {!compact && 'Cancel'}
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
              <DialogTitle>Cancel Session?</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This will <strong>stop the current session</strong> and kill the running Claude process.
              Any unsaved progress in this session will be lost.
            </DialogDescription>
          </DialogHeader>
          {showPause && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
              <strong>Tip:</strong> If you want to stop temporarily, use <strong>Pause</strong> instead.
              You can resume later from where you left off.
            </div>
          )}
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
              Cancel Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
