'use client';

/**
 * Complete Phase Button
 *
 * Primary action button for starting orchestration.
 * Opens the StartOrchestrationModal when clicked.
 */

import * as React from 'react';
import { Layers, ArrowRight, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onNavigateToSession?: () => void;
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

  const { orchestration, start, triggerMerge, error: orchestrationError } = useOrchestration({
    projectId,
    onWorkflowStart: () => {
      // Navigate to session viewer when workflow starts
      if (onNavigateToSession) {
        onNavigateToSession();
      }
    },
  });

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
    } catch {
      // Error is handled by useOrchestration
    } finally {
      setIsMerging(false);
    }
  }, [triggerMerge, onStart]);

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
    } catch {
      // Error is handled by useOrchestration
    } finally {
      setIsStarting(false);
    }
  }, [start, onStart]);

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
    </>
  );
});
