"use client"

import { createContext, useContext, type ReactNode } from 'react';
import { useSSE, type ConnectionStatus } from '@/hooks/use-sse';
import type { Registry, OrchestrationState } from '@speckit/shared';

interface ConnectionContextValue {
  registry: Registry | null;
  states: Map<string, OrchestrationState>;
  connectionStatus: ConnectionStatus;
  refetch: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const value = useSSE();

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}
