'use client';

/**
 * Hook for fetching and polling Claude session messages.
 *
 * Features:
 * - Fetches session content from API
 * - Polls every 3 seconds when session is active
 * - Auto-discovers active session when sessionId not provided
 * - Auto-stops polling on error or when session completes
 * - Returns messages, metrics, and loading/error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionMessage } from '@/lib/session-parser';

const POLL_INTERVAL_MS = 3000; // 3 seconds to match workflow polling
const DEFAULT_TAIL_LIMIT = 100;

export interface SessionContent {
  messages: SessionMessage[];
  filesModified: number;
  elapsed: number;
  sessionId: string;
}

interface UseSessionMessagesResult {
  /** Session messages (user and assistant only) */
  messages: SessionMessage[];
  /** Number of unique files modified during session */
  filesModified: number;
  /** Milliseconds since session start */
  elapsed: number;
  /** True during initial fetch */
  isLoading: boolean;
  /** True while polling is active */
  isPolling: boolean;
  /** Error from last fetch attempt */
  error: string | null;
  /** Discovered session ID (may differ from prop if auto-discovered) */
  activeSessionId: string | null;
  /** Manually refresh session content */
  refresh: () => Promise<void>;
  /** Stop polling */
  stopPolling: () => void;
}

/**
 * Find the most recently active session for a project
 */
async function findActiveSession(
  projectPath: string
): Promise<string | null> {
  const params = new URLSearchParams({ projectPath });
  const res = await fetch(`/api/session/active?${params}`);

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.sessionId || null;
}

/**
 * Fetch session content from API
 */
async function fetchSessionContent(
  projectPath: string,
  sessionId: string,
  tail: number = DEFAULT_TAIL_LIMIT
): Promise<SessionContent> {
  const params = new URLSearchParams({
    projectPath,
    sessionId,
    tail: String(tail),
  });

  const res = await fetch(`/api/session/content?${params}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch session: ${res.status}`);
  }

  return data as SessionContent;
}

/**
 * Hook for managing session message polling
 *
 * @param projectPath - Absolute path to the project
 * @param sessionId - Claude session ID (from workflow execution), or null to auto-discover
 * @param isActive - Whether to poll for updates (true when workflow is running)
 * @param tailLimit - Number of messages to fetch (default: 100)
 */
export function useSessionMessages(
  projectPath: string | null,
  sessionId: string | null,
  isActive: boolean,
  tailLimit: number = DEFAULT_TAIL_LIMIT
): UseSessionMessagesResult {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [filesModified, setFilesModified] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Clear polling interval
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Fetch session content (using discovered session if provided sessionId is null)
  const refresh = useCallback(async () => {
    if (!projectPath) {
      return;
    }

    // Use provided sessionId or try to discover active session
    let effectiveSessionId = sessionId || activeSessionId;

    if (!effectiveSessionId && isActive) {
      // Try to discover active session
      effectiveSessionId = await findActiveSession(projectPath);
      if (effectiveSessionId) {
        setActiveSessionId(effectiveSessionId);
      }
    }

    if (!effectiveSessionId) {
      return;
    }

    try {
      const content = await fetchSessionContent(projectPath, effectiveSessionId, tailLimit);
      setMessages(content.messages);
      setFilesModified(content.filesModified);
      setElapsed(content.elapsed);
      setActiveSessionId(content.sessionId);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      // Stop polling on error
      stopPolling();
    }
  }, [projectPath, sessionId, activeSessionId, isActive, tailLimit, stopPolling]);

  // Start polling
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;

    isPollingRef.current = true;
    pollIntervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh]);

  // Track if this is the very first load (no messages yet)
  const hasLoadedRef = useRef(false);
  // Track the last loaded session to detect session changes
  const lastSessionIdRef = useRef<string | null>(null);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!projectPath) {
      setMessages([]);
      setFilesModified(0);
      setElapsed(0);
      setError(null);
      setActiveSessionId(null);
      hasLoadedRef.current = false;
      lastSessionIdRef.current = null;
      stopPolling();
      return;
    }

    // Use provided sessionId or nothing yet (will discover on first poll)
    const effectiveSessionId = sessionId;

    // Reset loaded state if session changed
    if (effectiveSessionId !== lastSessionIdRef.current) {
      hasLoadedRef.current = false;
      lastSessionIdRef.current = effectiveSessionId;
    }

    // Only show loading state on true initial load, not on refetch
    // This prevents blank screen when polling callbacks change
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);

    const doInitialFetch = async () => {
      let sid = effectiveSessionId;

      // If no session ID and active, try to discover
      if (!sid && isActive) {
        sid = await findActiveSession(projectPath);
        if (sid) {
          setActiveSessionId(sid);
        }
      }

      if (!sid) {
        setIsLoading(false);
        // Start polling to keep trying to discover
        if (isActive) {
          startPolling();
        }
        return;
      }

      try {
        const content = await fetchSessionContent(projectPath, sid, tailLimit);
        setMessages(content.messages);
        setFilesModified(content.filesModified);
        setElapsed(content.elapsed);
        setActiveSessionId(content.sessionId);
        setIsLoading(false);
        hasLoadedRef.current = true;

        // Start polling if active
        if (isActive) {
          startPolling();
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        setError(message);
        setIsLoading(false);
      }
    };

    doInitialFetch();

    return () => {
      stopPolling();
    };
  }, [projectPath, sessionId, tailLimit, isActive, startPolling, stopPolling]);

  // Handle isActive changes
  useEffect(() => {
    if (isActive && projectPath && !isPollingRef.current) {
      startPolling();
    } else if (!isActive) {
      stopPolling();
    }
  }, [isActive, projectPath, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    messages,
    filesModified,
    elapsed,
    isLoading,
    isPolling: isPollingRef.current,
    error,
    activeSessionId: sessionId || activeSessionId,
    refresh,
    stopPolling,
  };
}
