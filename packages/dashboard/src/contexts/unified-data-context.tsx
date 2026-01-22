"use client"

/**
 * UNIFIED DATA CONTEXT - Single source of truth for all real-time data
 *
 * DATA SOURCES:
 * - SSE (pushed): registry, states, tasks, workflows, phases
 *   -> Triggered by file system changes via chokidar watcher
 *   -> See: lib/watcher.ts, hooks/use-sse.ts
 *
 * - Polling (pulled): sessionContent
 *   -> Session JSONL files live in ~/.claude/projects/ (external)
 *   -> See: lib/session-polling-manager.ts
 *
 * ADDING NEW DATA:
 * - File in project directory? -> Add to watcher.ts + SSE events
 * - External file/API? -> Add to session-polling-manager.ts
 * - NEVER add independent polling hooks
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useSSE, type ConnectionStatus } from '@/hooks/use-sse';
import {
  sessionPollingManager,
  type SessionContent,
  type SessionUpdateEvent,
} from '@/lib/session-polling-manager';
import type {
  Registry,
  OrchestrationState,
  TasksData,
  WorkflowData,
  PhasesData,
  Project,
} from '@specflow/shared';

/**
 * Unified data context value interface
 */
interface UnifiedDataContextValue {
  // === SSE-Pushed Data (Real-time, file-watched) ===
  registry: Registry | null;
  states: Map<string, OrchestrationState>;
  tasks: Map<string, TasksData>;
  workflows: Map<string, WorkflowData>;
  phases: Map<string, PhasesData>;
  connectionStatus: ConnectionStatus;

  // === Polled Data (Session content only) ===
  sessionContent: Map<string, SessionContent>;

  // === UI State ===
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;

  // === Actions ===
  refetch: () => void;
  subscribeToSession: (sessionId: string, projectPath: string) => void;
  unsubscribeFromSession: (sessionId: string) => void;
}

const UnifiedDataContext = createContext<UnifiedDataContextValue | null>(null);

/**
 * Unified Data Provider
 *
 * Wraps SSE hook for file-watched data and integrates session polling manager.
 */
export function UnifiedDataProvider({ children }: { children: ReactNode }) {
  // SSE data (file-watched: registry, states, tasks, workflows)
  const sseData = useSSE();

  // UI state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Session content (polled)
  const [sessionContent, setSessionContent] = useState<Map<string, SessionContent>>(
    new Map()
  );

  // Subscribe to session polling updates
  useEffect(() => {
    const unsubscribe = sessionPollingManager.addListener(
      (event: SessionUpdateEvent) => {
        setSessionContent(prev => {
          const next = new Map(prev);
          next.set(event.sessionId, event.content);
          return next;
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Session subscription management
  const subscribeToSession = useCallback(
    (sessionId: string, projectPath: string) => {
      sessionPollingManager.subscribe(sessionId, projectPath);

      // Load cached content if available
      const cached = sessionPollingManager.getCache(sessionId);
      if (cached) {
        setSessionContent(prev => {
          const next = new Map(prev);
          next.set(sessionId, cached);
          return next;
        });
      }
    },
    []
  );

  const unsubscribeFromSession = useCallback((sessionId: string) => {
    sessionPollingManager.unsubscribe(sessionId);
  }, []);

  const value: UnifiedDataContextValue = {
    // SSE data
    registry: sseData.registry,
    states: sseData.states,
    tasks: sseData.tasks,
    workflows: sseData.workflows,
    phases: sseData.phases,
    connectionStatus: sseData.connectionStatus,

    // Polled data
    sessionContent,

    // UI state
    selectedProject,
    setSelectedProject,

    // Actions
    refetch: sseData.refetch,
    subscribeToSession,
    unsubscribeFromSession,
  };

  return (
    <UnifiedDataContext.Provider value={value}>
      {children}
    </UnifiedDataContext.Provider>
  );
}

/**
 * Hook to access unified data context
 */
export function useUnifiedData(): UnifiedDataContextValue {
  const context = useContext(UnifiedDataContext);
  if (!context) {
    throw new Error('useUnifiedData must be used within a UnifiedDataProvider');
  }
  return context;
}
