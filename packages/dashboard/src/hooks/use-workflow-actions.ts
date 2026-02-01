"use client"

/**
 * Hook for workflow actions (mutations only, no state).
 *
 * Provides functions to start, cancel, and submit answers to workflows.
 * State is managed via SSE events in the unified context.
 *
 * Usage:
 *   const { start, cancel, submitAnswers, isSubmitting } = useWorkflowActions(projectId);
 *
 *   // Start a new workflow
 *   await start('/flow.orchestrate');
 *
 *   // Cancel current workflow
 *   await cancel();
 *
 *   // Submit answers to waiting workflow
 *   await submitAnswers({ '0': 'selected answer' });
 */

import { useState, useCallback } from 'react';
import {
  requestNotificationPermission,
  hasRequestedPermission,
} from '@/lib/notifications';

interface StartWorkflowOptions {
  /** Optional session ID to resume an existing session */
  resumeSessionId?: string;
}

interface UseWorkflowActionsResult {
  /** Start a new workflow with the given skill */
  start: (skill: string, options?: StartWorkflowOptions) => Promise<void>;
  /** Cancel the current workflow */
  cancel: (executionId?: string, sessionId?: string) => Promise<void>;
  /** Submit answers to a waiting workflow */
  submitAnswers: (executionId: string, answers: Record<string, string>) => Promise<void>;
  /** True while a workflow action is in progress */
  isSubmitting: boolean;
  /** Error from last action */
  error: Error | null;
}

/**
 * Start a workflow for a project
 */
async function startWorkflowApi(
  projectId: string,
  skill: string,
  resumeSessionId?: string
): Promise<void> {
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
}

/**
 * Cancel a workflow
 */
async function cancelWorkflowApi(
  projectId: string,
  executionId?: string,
  sessionId?: string
): Promise<void> {
  if (!executionId && !sessionId) {
    return;
  }
  const params = new URLSearchParams();
  if (executionId) params.set('id', executionId);
  if (sessionId) params.set('sessionId', sessionId);
  params.set('projectId', projectId);

  const res = await fetch(`/api/workflow/cancel?${params}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Not found is okay - workflow already cancelled/completed
    if (!data.error?.includes('not found')) {
      throw new Error(data.error || `Failed to cancel workflow: ${res.status}`);
    }
  }
}

/**
 * Submit answers to a waiting workflow
 */
async function submitAnswersApi(
  executionId: string,
  answers: Record<string, string>
): Promise<void> {
  const res = await fetch('/api/workflow/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: executionId, answers }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to submit answers: ${res.status}`);
  }
}

/**
 * Hook for workflow actions
 */
export function useWorkflowActions(projectId: string | null): UseWorkflowActionsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const start = useCallback(
    async (skill: string, options?: StartWorkflowOptions) => {
      if (!projectId) {
        throw new Error('No project selected');
      }

      // Request notification permission on first workflow start
      if (!hasRequestedPermission()) {
        await requestNotificationPermission();
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await startWorkflowApi(projectId, skill, options?.resumeSessionId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Unknown error');
        setError(e);
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectId]
  );

  const cancel = useCallback(
    async (executionId?: string, sessionId?: string) => {
      if (!projectId) {
        throw new Error('No project selected');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await cancelWorkflowApi(projectId, executionId, sessionId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Unknown error');
        setError(e);
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectId]
  );

  const submitAnswers = useCallback(
    async (executionId: string, answers: Record<string, string>) => {
      setIsSubmitting(true);
      setError(null);

      try {
        await submitAnswersApi(executionId, answers);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Unknown error');
        setError(e);
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    start,
    cancel,
    submitAnswers,
    isSubmitting,
    error,
  };
}
