'use client';

/**
 * Hook for fetching session history for a project.
 *
 * Features:
 * - Fetches session index from API
 * - Polls every 5 seconds when enabled
 * - Returns list of sessions with metadata
 * - Loading and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowIndexEntry } from '@/lib/services/workflow-service';

const POLL_INTERVAL_MS = 5000; // 5 seconds

interface UseSessionHistoryResult {
  /** List of sessions for the project */
  sessions: WorkflowIndexEntry[];
  /** True during initial fetch */
  isLoading: boolean;
  /** Error from last fetch attempt */
  error: string | null;
  /** Manually refresh session list */
  refresh: () => Promise<void>;
}

/**
 * Fetch session history from API
 */
async function fetchSessionHistory(
  projectPath: string
): Promise<WorkflowIndexEntry[]> {
  const params = new URLSearchParams({ projectPath });
  const res = await fetch(`/api/session/history?${params}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch history: ${res.status}`);
  }

  return data.sessions || [];
}

/**
 * Hook for managing session history
 *
 * @param projectPath - Absolute path to the project
 * @param enablePolling - Whether to poll for updates (default: true)
 */
export function useSessionHistory(
  projectPath: string | null,
  enablePolling: boolean = true
): UseSessionHistoryResult {
  const [sessions, setSessions] = useState<WorkflowIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!projectPath) {
      setSessions([]);
      return;
    }

    // Only show loading on initial fetch
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await fetchSessionHistory(projectPath);
      setSessions(result);
      hasLoadedRef.current = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  // Clear polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Start polling
  const startPolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh, stopPolling]);

  // Fetch on mount and start polling
  useEffect(() => {
    if (!projectPath) {
      setSessions([]);
      hasLoadedRef.current = false;
      stopPolling();
      return;
    }

    refresh();

    if (enablePolling) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [projectPath, enablePolling, refresh, startPolling, stopPolling]);

  return {
    sessions,
    isLoading,
    error,
    refresh,
  };
}
