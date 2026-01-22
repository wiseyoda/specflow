'use client';

/**
 * Start Orchestration Modal
 *
 * Configuration modal shown before starting orchestration.
 * Displays detected batch count and configuration options.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Layers, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText, ListChecks, ClipboardList } from 'lucide-react';
import { OrchestrationConfigForm } from './orchestration-config-form';
import { DEFAULT_ORCHESTRATION_CONFIG } from '@specflow/shared';
import type { OrchestrationConfig } from '@specflow/shared';

// =============================================================================
// Types
// =============================================================================

export interface BatchPlanInfo {
  summary: string;
  batchCount: number;
  taskCount: number;
  usedFallback: boolean;
}

export interface PreflightInfo {
  hasSpec: boolean;
  hasPlan: boolean;
  hasTasks: boolean;
  tasksTotal: number;
  tasksComplete: number;
  phaseNumber: number | null;
  phaseName: string | null;
  /** Phase status from specflow: 'not_started' means phase needs to be opened */
  phaseStatus?: string | null;
  /** Next action from specflow: 'start_phase' means no active phase */
  nextAction?: string | null;
}

export interface StartOrchestrationModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The project name to display */
  projectName: string;
  /** The phase name/number to display */
  phaseName: string;
  /** Batch plan info (from API) */
  batchPlan: BatchPlanInfo | null;
  /** Pre-flight status info (from API) */
  preflight: PreflightInfo | null;
  /** Whether batch plan is loading */
  isLoadingPlan?: boolean;
  /** Error loading batch plan */
  planError?: string | null;
  /** Callback when confirmed */
  onConfirm: (config: OrchestrationConfig) => void;
  /** Whether the orchestration is being started */
  isStarting?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function StartOrchestrationModal({
  open,
  onOpenChange,
  projectName,
  phaseName,
  batchPlan,
  preflight,
  isLoadingPlan = false,
  planError = null,
  onConfirm,
  isStarting = false,
}: StartOrchestrationModalProps) {
  const [config, setConfig] = React.useState<OrchestrationConfig>({
    ...DEFAULT_ORCHESTRATION_CONFIG,
  });

  // Reset config when modal opens
  React.useEffect(() => {
    if (open) {
      setConfig({ ...DEFAULT_ORCHESTRATION_CONFIG });
    }
  }, [open]);

  // Detect if phase needs to be opened first (no active phase)
  const needsPhaseOpen = preflight?.nextAction === 'start_phase' || preflight?.phaseStatus === 'not_started';

  const handleCancel = React.useCallback(() => {
    if (!isStarting) {
      onOpenChange(false);
    }
  }, [isStarting, onOpenChange]);

  const handleConfirm = React.useCallback(() => {
    // If phase needs to be opened, force design to run (can't skip it)
    const effectiveConfig = needsPhaseOpen
      ? { ...config, skipDesign: false, skipAnalyze: false }
      : config;
    onConfirm(effectiveConfig);
  }, [config, needsPhaseOpen, onConfirm]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isStarting) {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isStarting, handleCancel]);

  // Can start if: not loading and no error
  // Even with 0 incomplete tasks, user may want to run verify/merge
  const canStart = !isLoadingPlan && !planError;

  return (
    <Dialog open={open} onOpenChange={isStarting ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (isStarting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-500" />
            Complete Phase
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <span className="block font-medium text-neutral-800 dark:text-neutral-200">
                {phaseName}
              </span>

              {/* Pre-flight Status */}
              {!isLoadingPlan && preflight && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                      preflight.hasSpec
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-neutral-500/10 text-neutral-500'
                    }`}
                  >
                    {preflight.hasSpec ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Spec
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                      preflight.hasPlan
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-neutral-500/10 text-neutral-500'
                    }`}
                  >
                    {preflight.hasPlan ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Plan
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                      preflight.hasTasks
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-neutral-500/10 text-neutral-500'
                    }`}
                  >
                    {preflight.hasTasks ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Tasks
                  </span>
                  {preflight.tasksTotal > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <ListChecks className="h-3 w-3" />
                      {preflight.tasksComplete}/{preflight.tasksTotal} complete
                    </span>
                  )}
                </div>
              )}

              {/* Batch Detection Status */}
              {isLoadingPlan ? (
                <span className="flex items-center gap-2 text-neutral-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Detecting batches...
                </span>
              ) : planError ? (
                <span className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-3 w-3" />
                  {planError}
                </span>
              ) : needsPhaseOpen ? (
                <div className="flex items-start gap-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <Layers className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-medium">Phase not started yet.</span>
                    <span className="block text-blue-500/80 dark:text-blue-400/80">
                      Orchestration will open the phase and run design to create spec, plan, and tasks.
                    </span>
                  </div>
                </div>
              ) : batchPlan ? (
                <div className="space-y-2">
                  <span className="text-neutral-500">
                    Detected {batchPlan.batchCount} batch{batchPlan.batchCount !== 1 ? 'es' : ''} from
                    tasks.md
                  </span>

                  {/* Prominent fallback warning */}
                  {batchPlan.usedFallback && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-medium">No sections detected.</span>
                        <span className="block text-amber-500/80 dark:text-amber-400/80">
                          Using {batchPlan.taskCount > 15 ? '15-task' : 'single'} batch fallback.
                          Add <code className="px-1 bg-amber-500/20 rounded">## Section Name</code> headers to tasks.md for better batching.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {planError ? (
            <div className="text-center py-8 text-neutral-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm">{planError}</p>
            </div>
          ) : (
            <OrchestrationConfigForm
              config={config}
              onChange={setConfig}
              disabled={isStarting || isLoadingPlan}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isStarting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isStarting || !canStart}
            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
          >
            {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Orchestration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
