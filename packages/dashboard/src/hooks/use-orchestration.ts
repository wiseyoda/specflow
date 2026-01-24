'use client';

/**
 * useOrchestration Hook
 *
 * Manages orchestration state with event-driven updates.
 * Uses SSE events (workflow, state changes) to trigger refreshes instead of polling.
 * Provides methods for starting, pausing, resuming, canceling orchestration.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { OrchestrationConfig } from '@specflow/shared';
import type { OrchestrationExecution } from '@/lib/services/orchestration-types';
import type { BatchPlanInfo } from '@/components/orchestration/start-orchestration-modal';
import type { RecoveryOption } from '@/components/orchestration/recovery-panel';
import { useUnifiedData } from '@/contexts/unified-data-context';

// =============================================================================
// Types
// =============================================================================

export interface WorkflowInfo {
  id: string;
  skill: string;
  status: string;
  sessionId?: string;
}

export interface UseOrchestrationOptions {
  /** Project ID */
  projectId: string;
  /** @deprecated No longer used - refreshes are now SSE-driven */
  pollingInterval?: number;
  /** Callback when orchestration status changes */
  onStatusChange?: (status: OrchestrationExecution['status']) => void;
  /** Callback when orchestration completes */
  onComplete?: () => void;
  /** Callback when orchestration fails */
  onError?: (error: string) => void;
  /** Callback when workflow is started (for navigation to session viewer) */
  onWorkflowStart?: (workflow: WorkflowInfo) => void;
}

export interface UseOrchestrationReturn {
  /** Current orchestration state (null if none active) */
  orchestration: OrchestrationExecution | null;
  /** Active workflow session ID (for navigation to session viewer) */
  activeSessionId: string | null;
  /** Whether fetching status */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Batch plan info for modal */
  batchPlan: BatchPlanInfo | null;
  /** Whether batch plan is loading */
  isLoadingPlan: boolean;
  /** Whether the current workflow is waiting for user input (FR-072) */
  isWaitingForInput: boolean;
  /** Whether a recovery action is in progress */
  isRecovering: boolean;
  /** Which recovery action is currently loading */
  recoveryAction: RecoveryOption | null;
  /** Start orchestration with config */
  start: (config: OrchestrationConfig) => Promise<void>;
  /** Pause orchestration */
  pause: () => Promise<void>;
  /** Resume orchestration */
  resume: () => Promise<void>;
  /** Cancel orchestration */
  cancel: () => Promise<void>;
  /** Trigger merge */
  triggerMerge: () => Promise<void>;
  /** Handle recovery action (retry/skip/abort) */
  recover: (action: RecoveryOption) => Promise<void>;
  /** Fetch batch plan */
  fetchBatchPlan: () => Promise<void>;
  /** Refresh status */
  refresh: () => Promise<void>;
  /** Go back to a previous step (FR-004) */
  goBackToStep: (step: string) => Promise<void>;
  /** Whether going back to step is in progress */
  isGoingBackToStep: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useOrchestration({
  projectId,
  // pollingInterval is deprecated - SSE-driven refresh
  onStatusChange,
  onComplete,
  onError,
  onWorkflowStart,
}: UseOrchestrationOptions): UseOrchestrationReturn {
  const [orchestration, setOrchestration] = useState<OrchestrationExecution | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchPlan, setBatchPlan] = useState<BatchPlanInfo | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAction, setRecoveryAction] = useState<RecoveryOption | null>(null);
  const [isGoingBackToStep, setIsGoingBackToStep] = useState(false);

  const lastStatusRef = useRef<OrchestrationExecution['status'] | null>(null);

  // SSE data for event-driven refresh (T028: replaces polling)
  const { workflows, states } = useUnifiedData();

  // Use refs for callbacks to avoid recreating fetchStatus on every render
  const onStatusChangeRef = useRef(onStatusChange);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onWorkflowStartRef = useRef(onWorkflowStart);

  // Update refs when callbacks change
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    onWorkflowStartRef.current = onWorkflowStart;
  }, [onStatusChange, onComplete, onError, onWorkflowStart]);

  // Fetch orchestration status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workflow/orchestrate/status?projectId=${encodeURIComponent(projectId)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch status');
      }

      const data = await response.json();
      const newOrchestration = data.orchestration as OrchestrationExecution | null;

      setOrchestration(newOrchestration);
      setError(null);

      // Track active session ID from workflow info
      setActiveSessionId(data.workflow?.sessionId ?? null);

      // Check if workflow is waiting for input (FR-072)
      setIsWaitingForInput(data.workflow?.status === 'waiting_for_input');

      // Handle status change callbacks
      if (newOrchestration) {
        const newStatus = newOrchestration.status;
        if (lastStatusRef.current !== newStatus) {
          lastStatusRef.current = newStatus;
          onStatusChangeRef.current?.(newStatus);

          if (newStatus === 'completed') {
            onCompleteRef.current?.();
          } else if (newStatus === 'failed') {
            onErrorRef.current?.(newOrchestration.errorMessage || 'Orchestration failed');
          }
        }
      } else {
        lastStatusRef.current = null;
      }

      return newOrchestration;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, [projectId]); // Only depends on projectId now

  // Refresh status
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
    setIsLoading(false);
  }, [fetchStatus]);

  // Fetch batch plan
  const fetchBatchPlan = useCallback(async () => {
    setIsLoadingPlan(true);
    setBatchPlan(null);

    try {
      // We need to call a preview endpoint or parse locally
      // For now, we'll start without a preview and let the start endpoint validate
      // In a full implementation, we'd have a preview endpoint
      setIsLoadingPlan(false);
    } catch (err) {
      setIsLoadingPlan(false);
      const message = err instanceof Error ? err.message : 'Failed to load batch plan';
      setError(message);
    }
  }, []);

  // Start orchestration
  const start = useCallback(
    async (config: OrchestrationConfig) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/workflow/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, config }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to start orchestration');
        }

        // Update batch plan from response
        if (data.batchPlan) {
          setBatchPlan(data.batchPlan);
        }

        // Notify about orchestration start (for navigation to session viewer)
        // The runner will spawn the workflow shortly after
        if (data.workflow && onWorkflowStartRef.current) {
          onWorkflowStartRef.current(data.workflow);
        }

        // Initial refresh to get orchestration state
        await refresh();

        // Poll for sessionId - it becomes available after CLI spawns and returns first output
        // This can take 30+ seconds for complex workflows. Poll for up to 90 seconds.
        // IMPORTANT: We await this to keep isLoading=true until session is found
        const maxAttempts = 90;
        const pollInterval = 1000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          try {
            const statusResponse = await fetch(
              `/api/workflow/orchestrate/status?projectId=${encodeURIComponent(projectId)}`
            );
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.workflow?.sessionId) {
                setActiveSessionId(statusData.workflow.sessionId);
                setOrchestration(statusData.orchestration);
                setIsLoading(false);
                return; // Found sessionId, stop polling
              }
              // Also update orchestration state during polling so UI shows progress
              if (statusData.orchestration) {
                setOrchestration(statusData.orchestration);
              }
            }
          } catch {
            // Continue polling on error
          }
        }

        // Polling timed out without finding session - still set loading false
        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        onErrorRef.current?.(message);
        setIsLoading(false);
      }
    },
    [projectId, refresh]
  );

  // Pause orchestration
  const pause = useCallback(async () => {
    if (!orchestration) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/workflow/orchestrate/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, id: orchestration.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to pause');
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orchestration, projectId, refresh]);

  // Resume orchestration
  const resume = useCallback(async () => {
    if (!orchestration) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/workflow/orchestrate/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, id: orchestration.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resume');
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orchestration, projectId, refresh]);

  // Cancel orchestration
  const cancel = useCallback(async () => {
    if (!orchestration) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/workflow/orchestrate/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, id: orchestration.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orchestration, projectId, refresh]);

  // Trigger merge
  const triggerMerge = useCallback(async () => {
    if (!orchestration) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/workflow/orchestrate/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, id: orchestration.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger merge');
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orchestration, projectId, refresh]);

  // Handle recovery action (retry/skip/abort)
  const recover = useCallback(async (action: RecoveryOption) => {
    if (!orchestration) return;

    setIsRecovering(true);
    setRecoveryAction(action);
    try {
      const response = await fetch('/api/workflow/orchestrate/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, id: orchestration.id, action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to recover');
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsRecovering(false);
      setRecoveryAction(null);
    }
  }, [orchestration, projectId, refresh]);

  // Go back to a previous step (FR-004)
  const goBackToStep = useCallback(async (step: string) => {
    if (!orchestration) return;

    setIsGoingBackToStep(true);
    try {
      const response = await fetch('/api/workflow/orchestrate/go-back', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, id: orchestration.id, step }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to go back to step');
      }

      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsGoingBackToStep(false);
    }
  }, [orchestration, projectId, refresh]);

  // T028: Event-driven refresh via SSE instead of polling
  // When workflow or state SSE events come in, refresh orchestration status
  // This replaces the previous setInterval polling
  const lastWorkflowRef = useRef<unknown>(null);
  const lastStateRef = useRef<unknown>(null);

  useEffect(() => {
    // Only react if orchestration is active
    if (!orchestration) return;
    if (!['running', 'paused', 'waiting_merge', 'needs_attention'].includes(orchestration.status)) return;

    // Check if workflow data changed
    const currentWorkflow = workflows.get(projectId);
    const workflowChanged = currentWorkflow !== lastWorkflowRef.current;

    // Check if state data changed
    const currentState = states.get(projectId);
    const stateChanged = currentState !== lastStateRef.current;

    // Refresh on either change
    if (workflowChanged || stateChanged) {
      lastWorkflowRef.current = currentWorkflow;
      lastStateRef.current = currentState;
      fetchStatus();
    }
  }, [orchestration, projectId, workflows, states, fetchStatus]);

  // Initial fetch on mount (only once)
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchStatus();
    }
  }, [fetchStatus]);

  return {
    orchestration,
    activeSessionId,
    isLoading,
    error,
    batchPlan,
    isLoadingPlan,
    isWaitingForInput,
    isRecovering,
    recoveryAction,
    isGoingBackToStep,
    start,
    pause,
    resume,
    cancel,
    triggerMerge,
    recover,
    goBackToStep,
    fetchBatchPlan,
    refresh,
  };
}
