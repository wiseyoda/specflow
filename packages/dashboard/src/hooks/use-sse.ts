"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import type { SSEEvent, Registry, OrchestrationState } from '@speckit/shared';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface SSEState {
  registry: Registry | null;
  states: Map<string, OrchestrationState>;
  connectionStatus: ConnectionStatus;
  error: Error | null;
}

interface SSEResult extends SSEState {
  refetch: () => void;
}

/**
 * Hook for subscribing to SSE events from the dashboard server
 */
export function useSSE(): SSEResult {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [states, setStates] = useState<Map<string, OrchestrationState>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

          case 'heartbeat':
            // Heartbeat received - connection is alive
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

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, []);

  const refetch = useCallback(() => {
    // Close existing connection and reconnect to get fresh data
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
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

  return {
    registry,
    states,
    connectionStatus,
    error,
    refetch,
  };
}
