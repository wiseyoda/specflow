'use client';

/**
 * @deprecated This hook will be removed in a future version.
 *
 * Migration guide:
 * - For workflow data: use useProjectData() from '@/hooks/use-project-data'
 * - For actions: use useWorkflowActions() from '@/hooks/use-workflow-actions'
 *
 * The new architecture uses SSE-pushed workflow events instead of polling,
 * providing real-time updates with less overhead.
 *
 * OLD:
 *   const { execution, start, cancel, submitAnswers } = useWorkflowExecution(projectId);
 *
 * NEW:
 *   const { workflow, currentExecution, isWorkflowActive } = useProjectData(projectId);
 *   const { start, cancel, submitAnswers } = useWorkflowActions(projectId);
 *
 * ---
 * Hook for managing workflow execution state with polling
 *
 * Features:
 * - Fetches current workflow status for a project
 * - Polls every 3 seconds when workflow is active (running/waiting)
 * - Auto-stops polling on terminal states (completed, failed, cancelled)
 * - Provides start, cancel, refresh methods
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowExecution } from '@/lib/services/workflow-service';
import {
  requestNotificationPermission,
  hasRequestedPermission,
  showQuestionNotification,
} from '@/lib/notifications';

const POLL_INTERVAL_MS = 3000; // 3 seconds per PDR

type WorkflowStatus = WorkflowExecution['status'];

// Detached and stale are NOT terminal - the session may still be running
const TERMINAL_STATES: WorkflowStatus[] = ['completed', 'failed', 'cancelled'];
// Detached and stale count as potentially active - continue polling to see if session updates
const ACTIVE_STATES: WorkflowStatus[] = ['running', 'waiting_for_input', 'detached', 'stale'];

interface StartWorkflowOptions {
  /** Optional session ID to resume an existing session */
  resumeSessionId?: string;
}

interface UseWorkflowExecutionResult {
  /** Current workflow execution, or null if none */
  execution: WorkflowExecution | null;
  /** True during initial load */
  isLoading: boolean;
  /** True if workflow is in 'running' state */
  isRunning: boolean;
  /** True if workflow is in 'waiting_for_input' state */
  isWaiting: boolean;
  /** True if workflow is in a terminal state */
  isTerminal: boolean;
  /** Error from last operation */
  error: Error | null;
  /** Start a new workflow with the given skill, optionally resuming an existing session */
  start: (skill: string, options?: StartWorkflowOptions) => Promise<void>;
  /** Cancel the current workflow */
  cancel: () => Promise<void>;
  /** Submit answers to resume a waiting workflow */
  submitAnswers: (answers: Record<string, string>) => Promise<void>;
  /** Manually refresh the execution status */
  refresh: () => Promise<void>;
}

/**
 * Fetch the most recent active or recent workflow for a project
 */
async function fetchWorkflowForProject(
  projectId: string
): Promise<WorkflowExecution | null> {
  const res = await fetch(`/api/workflow/list?projectId=${encodeURIComponent(projectId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow list: ${res.status}`);
  }
  const data = await res.json();
  const executions = data.executions as WorkflowExecution[];

  // Return the most recent execution (already sorted by updatedAt desc)
  // Prefer active workflows over completed ones
  // Priority: waiting_for_input > running > other active states
  // This ensures questions are shown even if multiple workflows exist
  const waiting = executions.find((e) => e.status === 'waiting_for_input');
  if (waiting) return waiting;

  const active = executions.find((e) => ACTIVE_STATES.includes(e.status));
  if (active) return active;

  // Return most recent if within last 30 seconds (for fade effect)
  const recent = executions[0];
  if (recent) {
    const updatedAt = new Date(recent.updatedAt).getTime();
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;
    if (updatedAt > thirtySecondsAgo) {
      return recent;
    }
  }

  return null;
}

/**
 * Fetch a specific workflow execution by ID
 */
async function fetchWorkflowById(
  id: string,
  projectId: string
): Promise<WorkflowExecution | null> {
  const res = await fetch(
    `/api/workflow/status?id=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}`
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch workflow: ${res.status}`);
  }
  const data = await res.json();
  return data.execution as WorkflowExecution;
}

/**
 * Start a workflow for a project
 * @param resumeSessionId - Optional session ID to resume (uses --resume flag)
 */
async function startWorkflow(
  projectId: string,
  skill: string,
  resumeSessionId?: string
): Promise<WorkflowExecution> {
  const body: Record<string, string> = { projectId, skill };
  if (resumeSessionId) {
    body.resumeSessionId = resumeSessionId;
  }
  const res = await fetch('/api/workflow/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to start workflow: ${res.status}`);
  }
  const data = await res.json();
  return data.execution as WorkflowExecution;
}

/**
 * Cancel a workflow
 * @param id - Execution ID (optional if sessionId and projectId provided)
 * @param sessionId - Session ID for fallback cancellation
 * @param projectId - Project ID for fallback cancellation
 */
async function cancelWorkflow(
  id?: string,
  sessionId?: string,
  projectId?: string
): Promise<{ execution?: WorkflowExecution; cancelled?: boolean }> {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (sessionId) params.set('sessionId', sessionId);
  if (projectId) params.set('projectId', projectId);

  const res = await fetch(`/api/workflow/cancel?${params}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to cancel workflow: ${res.status}`);
  }
  return await res.json();
}

/**
 * Submit answers to a waiting workflow
 */
async function answerWorkflow(
  id: string,
  answers: Record<string, string>
): Promise<WorkflowExecution> {
  const res = await fetch('/api/workflow/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, answers }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to submit answers: ${res.status}`);
  }
  const data = await res.json();
  return data.execution as WorkflowExecution;
}

interface UseWorkflowExecutionOptions {
  /** Project name for notifications (optional) */
  projectName?: string;
}

/**
 * Hook for managing workflow execution for a specific project
 */
export function useWorkflowExecution(
  projectId: string,
  options?: UseWorkflowExecutionOptions
): UseWorkflowExecutionResult {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track current execution ID for polling
  const executionIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track previous status to detect transitions
  const previousStatusRef = useRef<WorkflowStatus | null>(null);

  // Derived state
  const isRunning = execution?.status === 'running';
  const isWaiting = execution?.status === 'waiting_for_input';
  const isTerminal = execution ? TERMINAL_STATES.includes(execution.status) : false;

  // Clear any existing polling interval
  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Fetch current execution status
  const refresh = useCallback(async () => {
    try {
      let exec: WorkflowExecution | null = null;

      // If we have a known execution ID, fetch it directly
      if (executionIdRef.current) {
        exec = await fetchWorkflowById(executionIdRef.current, projectId);
        if (exec) {
          // Detect transition to waiting_for_input
          const prevStatus = previousStatusRef.current;
          if (
            exec.status === 'waiting_for_input' &&
            prevStatus !== 'waiting_for_input' &&
            options?.projectName
          ) {
            showQuestionNotification(options.projectName);
          }
          previousStatusRef.current = exec.status;

          setExecution(exec);
          // Stop polling if terminal
          if (TERMINAL_STATES.includes(exec.status)) {
            clearPolling();
          }
          return;
        }
      }

      // Otherwise fetch the most recent for the project
      exec = await fetchWorkflowForProject(projectId);

      // Detect transition to waiting_for_input
      if (exec) {
        const prevStatus = previousStatusRef.current;
        if (
          exec.status === 'waiting_for_input' &&
          prevStatus !== 'waiting_for_input' &&
          options?.projectName
        ) {
          showQuestionNotification(options.projectName);
        }
        previousStatusRef.current = exec.status;
      }

      setExecution(exec);
      executionIdRef.current = exec?.id || null;

      // Stop polling if terminal or no execution
      if (!exec || TERMINAL_STATES.includes(exec.status)) {
        clearPolling();
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    }
  }, [projectId, clearPolling, options?.projectName]);

  // Start polling for active workflows
  const startPolling = useCallback(() => {
    clearPolling();
    pollIntervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh, clearPolling]);

  // Start a new workflow
  const start = useCallback(
    async (skill: string, options?: StartWorkflowOptions) => {
      // Validate: check if there's already an active workflow
      // Only running/waiting_for_input states block new workflows
      // cancelled/completed/failed states allow restart
      // detached state allows restart (dashboard lost track, user explicitly wants new workflow)
      // Exception: when resuming a session, we allow starting even if active
      // (the new workflow will link to the same session)
      const blockingStates: WorkflowStatus[] = ['running', 'waiting_for_input'];
      if (
        execution &&
        blockingStates.includes(execution.status) &&
        !options?.resumeSessionId
      ) {
        const err = new Error('A workflow is already running on this project');
        setError(err);
        throw err;
      }

      // Request notification permission on first workflow start
      if (!hasRequestedPermission()) {
        await requestNotificationPermission();
      }

      try {
        setError(null);
        const exec = await startWorkflow(projectId, skill, options?.resumeSessionId);
        setExecution(exec);
        executionIdRef.current = exec.id;
        // Start polling for updates
        startPolling();
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Unknown error'));
        throw e;
      }
    },
    [projectId, startPolling, execution]
  );

  // Cancel the current workflow
  const cancel = useCallback(async () => {
    // Get session ID before clearing state (needed for fallback cancel)
    const sessionId = execution?.sessionId;

    if (!executionIdRef.current && !sessionId) {
      // No execution or session to cancel - just clear local state
      setExecution(null);
      clearPolling();
      return;
    }

    try {
      setError(null);
      // Pass sessionId and projectId for fallback if execution tracking is lost
      const result = await cancelWorkflow(
        executionIdRef.current || undefined,
        sessionId,
        projectId
      );
      if (result.execution) {
        setExecution(result.execution);
      } else {
        // Cancelled by session ID - clear local state
        setExecution(null);
        executionIdRef.current = null;
      }
      clearPolling();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      // If execution/session not found, it's already gone - just clear local state
      if (errorMessage.includes('not found')) {
        setExecution(null);
        executionIdRef.current = null;
        clearPolling();
        setError(null);
        return;
      }
      setError(e instanceof Error ? e : new Error('Unknown error'));
      throw e;
    }
  }, [clearPolling, execution, projectId]);

  // Submit answers
  const submitAnswers = useCallback(
    async (answers: Record<string, string>) => {
      if (!executionIdRef.current) {
        throw new Error('No workflow to answer');
      }
      try {
        setError(null);
        const exec = await answerWorkflow(executionIdRef.current, answers);
        setExecution(exec);
        // Resume polling
        startPolling();
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        // If execution not found, the workflow timed out or was cleaned up
        // Clear the stale state so user can start fresh
        if (errorMessage.includes('not found') || errorMessage.includes('Execution not found')) {
          setExecution(null);
          executionIdRef.current = null;
          clearPolling();
          setError(new Error('Workflow session expired. Please start a new workflow.'));
        } else {
          setError(e instanceof Error ? e : new Error('Unknown error'));
        }
        throw e;
      }
    },
    [startPolling, clearPolling]
  );

  // Initial fetch on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsLoading(true);
      try {
        const exec = await fetchWorkflowForProject(projectId);
        if (!mounted) return;

        setExecution(exec);
        executionIdRef.current = exec?.id || null;

        // Start polling if there's an active workflow
        if (exec && ACTIVE_STATES.includes(exec.status)) {
          startPolling();
        }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e : new Error('Unknown error'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      clearPolling();
    };
  }, [projectId, startPolling, clearPolling]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  return {
    execution,
    isLoading,
    isRunning,
    isWaiting,
    isTerminal,
    error,
    start,
    cancel,
    submitAnswers,
    refresh,
  };
}
