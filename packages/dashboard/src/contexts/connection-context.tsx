"use client"

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSSE, type ConnectionStatus } from '@/hooks/use-sse';
import type { Registry, OrchestrationState, TasksData, Project } from '@speckit/shared';

interface ConnectionContextValue {
  registry: Registry | null;
  states: Map<string, OrchestrationState>;
  tasks: Map<string, TasksData>;
  connectionStatus: ConnectionStatus;
  refetch: () => void;
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const sseValue = useSSE();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const value: ConnectionContextValue = {
    ...sseValue,
    selectedProject,
    setSelectedProject,
  };

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
