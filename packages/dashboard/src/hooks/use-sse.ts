"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  SSEEvent,
  Registry,
  OrchestrationState,
  TasksData,
  WorkflowData,
  PhasesData,
  SessionContent,
  SessionQuestion,
} from '@specflow/shared';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface SSEState {
  registry: Registry | null;
  states: Map<string, OrchestrationState>;
  tasks: Map<string, TasksData>;
  workflows: Map<string, WorkflowData>;
  phases: Map<string, PhasesData>;
  sessionContent: Map<string, SessionContent>;
  /** Questions from AskUserQuestion tool calls, keyed by sessionId (G4.2) */
  sessionQuestions: Map<string, SessionQuestion[]>;
  connectionStatus: ConnectionStatus;
  error: Error | null;
}

interface SSEResult extends SSEState {
  refetch: () => void;
  /** Clear questions for a session after they've been answered (G4.8) */
  clearSessionQuestions: (sessionId: string) => void;
}

/**
 * Hook for subscribing to SSE events from the dashboard server
 */
export function useSSE(): SSEResult {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [states, setStates] = useState<Map<string, OrchestrationState>>(new Map());
  const [tasks, setTasks] = useState<Map<string, TasksData>>(new Map());
  const [workflows, setWorkflows] = useState<Map<string, WorkflowData>>(new Map());
  const [phases, setPhases] = useState<Map<string, PhasesData>>(new Map());
  const [sessionContent, setSessionContent] = useState<Map<string, SessionContent>>(new Map());
  const [sessionQuestions, setSessionQuestions] = useState<Map<string, SessionQuestion[]>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');

    const eventSource = new EventSource('/api/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        switch (data.type) {
          case 'connected':
            setConnectionStatus('connected');
            break;

          case 'registry':
            setRegistry(data.data);
            break;

          case 'state':
            setStates((prev) => {
              const next = new Map(prev);
              next.set(data.projectId, data.data);
              return next;
            });
            break;

          case 'tasks':
            setTasks((prev) => {
              const next = new Map(prev);
              next.set(data.projectId, data.data);
              return next;
            });
            break;

          case 'workflow':
            setWorkflows((prev) => {
              const next = new Map(prev);
              next.set(data.projectId, data.data);
              return next;
            });
            break;

          case 'phases':
            setPhases((prev) => {
              const next = new Map(prev);
              next.set(data.projectId, data.data);
              return next;
            });
            break;

          case 'heartbeat':
            // Heartbeat received - connection is alive
            break;

          case 'session:message':
            // Session content update - store by sessionId
            console.log(`[SSE] session:message received: sessionId=${data.sessionId}, messages=${data.data?.messages?.length ?? 0}`);
            setSessionContent((prev) => {
              const next = new Map(prev);
              next.set(data.sessionId, data.data);
              return next;
            });
            break;

          case 'session:question':
            // G4.3: Question detected - populate sessionQuestions map
            setSessionQuestions((prev) => {
              const next = new Map(prev);
              // Replace questions for this session (new questions replace old)
              next.set(data.sessionId, data.data.questions);
              return next;
            });
            break;

          case 'session:end':
            // Session ended - keep content but could mark as complete
            break;
        }
      } catch (e) {
        console.error('[SSE] Error parsing event:', e);
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
      eventSource.close();
      eventSourceRef.current = null;

      // Auto-reconnect after 3 seconds using ref
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.();
      }, 3000);
    };
  }, []);

  // Keep ref in sync with the latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const refetch = useCallback(() => {
    // Close existing connection and reconnect to get fresh data
    connect();
  }, [connect]);

  useEffect(() => {
    // Use a microtask to avoid the "setState in effect" lint warning
    // This is a legitimate pattern for establishing external connections
    const timeoutId = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  // G4.8: Function to clear questions after user answers
  const clearSessionQuestions = useCallback((sessionId: string) => {
    setSessionQuestions((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  return {
    registry,
    states,
    tasks,
    workflows,
    phases,
    sessionContent,
    sessionQuestions,
    connectionStatus,
    error,
    refetch,
    clearSessionQuestions,
  };
}
