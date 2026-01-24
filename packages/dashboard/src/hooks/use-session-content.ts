"use client"

/**
 * Hook for getting session content from unified context.
 *
 * Session content is pushed via SSE from JSONL file watchers for ACTIVE sessions.
 * For HISTORICAL sessions, we fall back to fetching via API.
 *
 * Usage:
 *   const content = useSessionContent(sessionId, projectPath);
 *
 *   if (content) {
 *     console.log(content.messages);
 *   }
 */

import { useMemo, useEffect, useState, useRef } from 'react';
import { useUnifiedData, type SessionContent } from '@/contexts/unified-data-context';

/**
 * Hook for getting session content from SSE or API fallback
 *
 * @param sessionId - Claude session ID (or null)
 * @param projectPath - Absolute path to the project (used for API fallback)
 * @returns Session content or null if not available
 */
export function useSessionContent(
  sessionId: string | null,
  projectPath: string | null
): SessionContent | null {
  const { sessionContent } = useUnifiedData();
  const [apiFallback, setApiFallback] = useState<SessionContent | null>(null);
  const fetchedRef = useRef<string | null>(null);

  // Check if content is available from SSE
  const sseContent = useMemo(() => {
    if (!sessionId) return null;
    const content = sessionContent.get(sessionId) ?? null;
    // Debug: log when content is looked up
    if (sessionId) {
      console.log(`[useSessionContent] Looking up sessionId=${sessionId}, found=${!!content}, sessionContent.size=${sessionContent.size}`);
    }
    return content;
  }, [sessionId, sessionContent]);

  // Fallback: fetch from API for historical sessions
  useEffect(() => {
    // Don't fetch if we have SSE content
    if (sseContent) {
      setApiFallback(null);
      return;
    }

    // Don't fetch without required params
    if (!sessionId || !projectPath) {
      setApiFallback(null);
      return;
    }

    // Don't re-fetch the same session
    if (fetchedRef.current === sessionId) {
      return;
    }

    // Fetch historical session content
    const fetchContent = async () => {
      try {
        fetchedRef.current = sessionId;
        const response = await fetch(
          `/api/session/content?projectPath=${encodeURIComponent(projectPath)}&sessionId=${encodeURIComponent(sessionId)}&tail=500`
        );
        if (response.ok) {
          const data = await response.json();
          setApiFallback({
            messages: data.messages,
            filesModified: data.filesModified ? Array(data.filesModified).fill('') : [],
            elapsedMs: data.elapsed || 0,
            currentTodos: data.currentTodos || [],
            workflowOutput: data.workflowOutput,
            agentTasks: data.agentTasks,
          });
        }
      } catch (error) {
        console.error('[useSessionContent] API fallback error:', error);
      }
    };

    fetchContent();
  }, [sessionId, projectPath, sseContent]);

  // Return SSE content if available, otherwise API fallback
  return sseContent ?? apiFallback;
}

/**
 * Extended result for components that need more metadata
 */
interface UseSessionContentExtendedResult {
  /** Session content or null */
  content: SessionContent | null;
  /** Messages from the session */
  messages: SessionContent['messages'];
  /** Files modified in the session */
  filesModified: string[];
  /** Elapsed time in milliseconds */
  elapsed: number;
  /** Current todo items */
  currentTodos: SessionContent['currentTodos'];
  /** Whether the session has ended */
  hasEnded: boolean;
  /** True if content is loading (first fetch) */
  isLoading: boolean;
  /** Final structured output from workflow completion */
  workflowOutput: SessionContent['workflowOutput'];
}

/**
 * Extended hook with more metadata for session content
 */
export function useSessionContentExtended(
  sessionId: string | null,
  projectPath: string | null
): UseSessionContentExtendedResult {
  const content = useSessionContent(sessionId, projectPath);

  return useMemo(
    () => ({
      content,
      messages: content?.messages ?? [],
      filesModified: content?.filesModified ?? [],
      elapsed: content?.elapsedMs ?? 0,
      currentTodos: content?.currentTodos ?? [],
      hasEnded: content?.messages.some(m => m.isSessionEnd) ?? false,
      isLoading: sessionId !== null && content === null,
      workflowOutput: content?.workflowOutput,
    }),
    [content, sessionId]
  );
}
