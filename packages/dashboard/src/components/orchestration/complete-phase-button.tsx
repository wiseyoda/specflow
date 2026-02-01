'use client';

/**
 * Complete Phase Button
 *
 * Primary action button for starting orchestration.
 * Opens the StartOrchestrationModal when clicked.
 */

import * as React from 'react';
import { Layers, ArrowRight, GitMerge, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StartOrchestrationModal, type BatchPlanInfo, type PreflightInfo } from './start-orchestration-modal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useOrchestration } from '@/hooks/use-orchestration';
import type { OrchestrationConfig } from '@specflow/shared';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface CompletePhaseButtonRef {
  /** Programmatically trigger the modal to open */
  openModal: () => void;
}

export interface CompletePhaseButtonProps {
  /** Project ID */
  projectId: string;
  /** Project name for display */
  projectName: string;
  /** Current phase name/number */
  phaseName: string;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Variant: primary (large with description) or compact (smaller) */
  variant?: 'primary' | 'compact';
  /** Additional class names */
  className?: string;
  /** Callback when orchestration is started */
  onStart?: () => void;
  /** Callback to navigate to session viewer */
  onNavigateToSession?: (sessionId?: string) => void;
}

// =============================================================================
// Main Component
// =============================================================================

export const CompletePhaseButton = React.forwardRef<CompletePhaseButtonRef, CompletePhaseButtonProps>(function CompletePhaseButton({
  projectId,
  projectName,
  phaseName,
  disabled = false,
  variant = 'primary',
  className,
  onStart,
  onNavigateToSession,
}, ref) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [isMerging, setIsMerging] = React.useState(false);
  const [batchPlan, setBatchPlan] = React.useState<BatchPlanInfo | null>(null);
  const [preflight, setPreflight] = React.useState<PreflightInfo | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);
  // Track whether we're waiting to navigate after starting orchestration
  const [pendingNavigation, setPendingNavigation] = React.useState(false);
  const navigationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { orchestration, activeSessionId, start, triggerMerge, error: orchestrationError } = useOrchestration({
    projectId,
  });

  // Effect: Navigate to session viewer once session ID becomes available
  React.useEffect(() => {
    if (pendingNavigation && onNavigateToSession) {
      if (activeSessionId) {
        // Session is now available, navigate with the session ID
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
          navigationTimeoutRef.current = null;
        }
        onNavigateToSession(activeSessionId);
        setPendingNavigation(false);
      } else {
        // Set a fallback timeout to navigate even without session ID after 5 seconds
        // This handles edge cases where session takes too long to spawn
        if (!navigationTimeoutRef.current) {
          navigationTimeoutRef.current = setTimeout(() => {
            if (pendingNavigation) {
              onNavigateToSession();
              setPendingNavigation(false);
            }
            navigationTimeoutRef.current = null;
          }, 5000);
        }
      }
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
  }, [pendingNavigation, activeSessionId, onNavigateToSession]);

  // Orchestration is truly blocked only when running or paused (not waiting_merge)
  const hasActiveOrchestration = !!(orchestration &&
    ['running', 'paused'].includes(orchestration.status));

  // Check if we're waiting for merge - this is a continuable state
  const isWaitingForMerge = orchestration?.status === 'waiting_merge';

  // Fetch batch plan when modal opens
  const handleOpenModal = React.useCallback(async () => {
    setModalOpen(true);
    setIsLoadingPlan(true);
    setPlanError(null);
    setBatchPlan(null);
    setPreflight(null);

    try {
      // Fetch batch plan preview from API
      const response = await fetch(
        `/api/workflow/orchestrate/status?projectId=${encodeURIComponent(projectId)}&preview=true`
      );

      if (!response.ok) {
        const data = await response.json();
        // If 404, project might not have tasks - we'll let the modal show anyway
        if (response.status !== 404) {
          setPlanError(data.error || 'Failed to load batch plan');
        }
      } else {
        const data = await response.json();
        if (data.batchPlan) {
          setBatchPlan(data.batchPlan);
        }
        if (data.preflight) {
          setPreflight(data.preflight);
        }
      }
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to load batch plan');
    } finally {
      setIsLoadingPlan(false);
    }
  }, [projectId]);

  // Handle button click - either open merge dialog or start modal
  const handleClick = React.useCallback(() => {
    if (isWaitingForMerge) {
      // Show merge confirmation dialog instead of full modal
      setMergeDialogOpen(true);
    } else {
      // Open the full orchestration modal
      handleOpenModal();
    }
  }, [isWaitingForMerge, handleOpenModal]);

  // Handle merge confirmation
  const handleMergeConfirm = React.useCallback(async () => {
    setIsMerging(true);
    try {
      await triggerMerge();
      setMergeDialogOpen(false);
      onStart?.();
      // Set pending navigation - effect will navigate when session ID is available
      if (onNavigateToSession) {
        setPendingNavigation(true);
      }
    } catch {
      // Error is handled by useOrchestration
    } finally {
      setIsMerging(false);
    }
  }, [triggerMerge, onStart, onNavigateToSession]);

  // Expose openModal via ref for programmatic triggering (e.g., from command palette)
  React.useImperativeHandle(ref, () => ({
    openModal: handleClick,
  }), [handleClick]);

  const handleConfirm = React.useCallback(async (config: OrchestrationConfig) => {
    setIsStarting(true);
    try {
      await start(config);
      setModalOpen(false);
      onStart?.();
      // Set pending navigation - effect will navigate when session ID is available
      if (onNavigateToSession) {
        setPendingNavigation(true);
      }
    } catch {
      // Error is handled by useOrchestration
      // Only keep modal open on error so user can retry
      return;
    } finally {
      setIsStarting(false);
    }
  }, [start, onStart, onNavigateToSession]);

  const isDisabled = disabled || hasActiveOrchestration;

  if (variant === 'compact') {
    return (
      <>
        <Button
          onClick={handleClick}
          disabled={isDisabled}
          size="sm"
          className={cn(
            'gap-2',
            isWaitingForMerge
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white'
              : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white',
            className
          )}
        >
          {isWaitingForMerge ? (
            <>
              <GitMerge className="h-4 w-4" />
              Continue Merge
            </>
          ) : (
            <>
              <Layers className="h-4 w-4" />
              Complete Phase
            </>
          )}
        </Button>

        <StartOrchestrationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          projectName={projectName}
          phaseName={phaseName}
          batchPlan={batchPlan}
          preflight={preflight}
          isLoadingPlan={isLoadingPlan}
          planError={planError || orchestrationError}
          onConfirm={handleConfirm}
          isStarting={isStarting}
        />

        <ConfirmationDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          title="Ready to Merge"
          description="All tasks are complete and verified. Proceed with merge?"
          items={[
            'Run /flow.merge to close the phase',
            'Push changes to remote branch',
            'Create pull request and merge to main',
          ]}
          confirmLabel="Run Merge"
          onConfirm={handleMergeConfirm}
          isLoading={isMerging}
        />

        {/* Creating Session Interstitial */}
        <Dialog open={pendingNavigation} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[360px]" hideCloseButton>
            <DialogHeader className="items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
                <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
              </div>
              <DialogTitle>Creating Session</DialogTitle>
              <DialogDescription>
                Starting orchestration workflow...
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Primary variant - large button with description
  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          'w-full p-4 rounded-lg border transition-all text-left group',
          isWaitingForMerge
            ? 'bg-gradient-to-r from-blue-600/10 to-blue-500/10 border-blue-500/30 hover:from-blue-600/20 hover:to-blue-500/20 hover:border-blue-500/50'
            : 'bg-gradient-to-r from-purple-600/10 to-purple-500/10 border-purple-500/30 hover:from-purple-600/20 hover:to-purple-500/20 hover:border-purple-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isWaitingForMerge ? 'bg-blue-500/20' : 'bg-purple-500/20'
            )}>
              {isWaitingForMerge ? (
                <GitMerge className="h-5 w-5 text-blue-400" />
              ) : (
                <Layers className="h-5 w-5 text-purple-400" />
              )}
            </div>
            <div>
              <div className="font-semibold text-neutral-100 flex items-center gap-2">
                {isWaitingForMerge ? 'Continue Merge' : 'Complete Phase'}
                {hasActiveOrchestration && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/30 text-purple-300">
                    In Progress
                  </span>
                )}
                {isWaitingForMerge && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/30 text-blue-300">
                    Ready
                  </span>
                )}
              </div>
              <div className="text-sm text-neutral-400">
                {isWaitingForMerge
                  ? 'Verified and ready to merge to main'
                  : 'Automatically execute all steps to complete phase'}
              </div>
            </div>
          </div>
          <ArrowRight className={cn(
            'h-5 w-5 text-neutral-500 transition-colors',
            isWaitingForMerge ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400'
          )} />
        </div>
      </button>

      <StartOrchestrationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projectName={projectName}
        phaseName={phaseName}
        batchPlan={batchPlan}
        preflight={preflight}
        isLoadingPlan={isLoadingPlan}
        planError={planError || orchestrationError}
        onConfirm={handleConfirm}
        isStarting={isStarting}
      />

      <ConfirmationDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        title="Ready to Merge"
        description="All tasks are complete and verified. Proceed with merge?"
        items={[
          'Run /flow.merge to close the phase',
          'Push changes to remote branch',
          'Create pull request and merge to main',
        ]}
        confirmLabel="Run Merge"
        onConfirm={handleMergeConfirm}
        isLoading={isMerging}
      />

      {/* Creating Session Interstitial */}
      <Dialog open={pendingNavigation} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[360px]" hideCloseButton>
          <DialogHeader className="items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
              <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
            </div>
            <DialogTitle>Creating Session</DialogTitle>
            <DialogDescription>
              Starting orchestration workflow...
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
});
