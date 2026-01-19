'use client';

/**
 * Hook for fetching active workflow executions across all projects
 *
 * Used by ProjectList to display workflow status badges on project cards.
 * Polls every 3 seconds when there are active workflows.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowExecution } from '@/lib/services/workflow-service';

const POLL_INTERVAL_MS = 3000; // 3 seconds per PDR

interface UseWorkflowListResult {
  /** Map of projectId to their most recent workflow execution */
  executions: Map<string, WorkflowExecution>;
  /** True during initial load */
  isLoading: boolean;
  /** Error from last fetch */
  error: Error | null;
  /** Manually refresh all executions */
  refresh: () => Promise<void>;
}

/**
 * Fetch all active workflows (running or waiting_for_input)
 */
async function fetchActiveWorkflows(): Promise<WorkflowExecution[]> {
  const res = await fetch('/api/workflow/list');
  if (!res.ok) {
    throw new Error(`Failed to fetch workflows: ${res.status}`);
  }
  const data = await res.json();
  return data.executions as WorkflowExecution[];
}

/**
 * Hook for managing workflow executions across all projects
 *
 * Features:
 * - Fetches all workflows on mount
 * - Polls every 3 seconds when there are active workflows
 * - Stops polling when no active workflows
 * - Returns map keyed by projectId for easy lookup
 */
export function useWorkflowList(projectIds?: string[]): UseWorkflowListResult {
  const [executions, setExecutions] = useState<Map<string, WorkflowExecution>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if any executions are active (require polling)
  const hasActiveWorkflows = Array.from(executions.values()).some(
    (e) => e.status === 'running' || e.status === 'waiting_for_input'
  );

  // Clear any existing polling interval
  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Fetch and update executions
  const refresh = useCallback(async () => {
    try {
      const allExecutions = await fetchActiveWorkflows();

      // Group by projectId, keeping only the most recent for each
      const executionMap = new Map<string, WorkflowExecution>();

      for (const exec of allExecutions) {
        // Filter by projectIds if provided
        if (projectIds && !projectIds.includes(exec.projectId)) {
          continue;
        }

        const existing = executionMap.get(exec.projectId);
        if (
          !existing ||
          new Date(exec.updatedAt) > new Date(existing.updatedAt)
        ) {
          executionMap.set(exec.projectId, exec);
        }
      }

      // Remove executions that have faded (completed more than 30s ago)
      const now = Date.now();
      for (const [projectId, exec] of executionMap) {
        if (exec.status === 'completed' || exec.status === 'failed' || exec.status === 'cancelled') {
          const updatedAt = new Date(exec.updatedAt).getTime();
          const age = now - updatedAt;
          // Keep for 30s after completion for fade effect
          if (age > 30000) {
            executionMap.delete(projectId);
          }
        }
      }

      setExecutions(executionMap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    }
  }, [projectIds]);

  // Start polling
  const startPolling = useCallback(() => {
    clearPolling();
    pollIntervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh, clearPolling]);

  // Initial fetch on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsLoading(true);
      try {
        await refresh();
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
  }, [refresh, clearPolling]);

  // Start/stop polling based on active workflows
  useEffect(() => {
    if (hasActiveWorkflows) {
      startPolling();
    } else {
      clearPolling();
    }

    return () => {
      clearPolling();
    };
  }, [hasActiveWorkflows, startPolling, clearPolling]);

  return {
    executions,
    isLoading,
    error,
    refresh,
  };
}
