"use client"

/**
 * UNIFIED DATA CONTEXT - Single source of truth for all real-time data
 *
 * DATA SOURCES:
 * - SSE (pushed): registry, states, tasks, workflows, phases, sessionContent
 *   -> Triggered by file system changes via chokidar watcher
 *   -> Session JSONL files in ~/.claude/projects/ are also file-watched
 *   -> See: lib/watcher.ts, hooks/use-sse.ts
 *
 * ADDING NEW DATA:
 * - File in project directory? -> Add to watcher.ts + SSE events
 * - Session JSONL file? -> Already handled by watcher.ts session watching
 * - NEVER add independent polling hooks
 */

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { useSSE, type ConnectionStatus } from '@/hooks/use-sse';
import type {
  Registry,
  OrchestrationState,
  TasksData,
  WorkflowData,
  PhasesData,
  Project,
  SessionQuestion,
} from '@specflow/shared';
import type {
  SessionMessage,
  TodoItem,
  WorkflowOutput,
  AgentTaskInfo,
} from '@/lib/session-parser';

/**
 * Session content structure (from JSONL parsing)
 * Re-exported for convenience
 */
export type { SessionMessage, TodoItem, WorkflowOutput, AgentTaskInfo };

export interface SessionContent {
  messages: SessionMessage[];
  filesModified: string[];
  elapsedMs: number;
  currentTodos: TodoItem[];
  /** Final structured output from workflow completion (if any) */
  workflowOutput?: WorkflowOutput;
  /** Agent tasks (parallel agents) currently running or recently completed */
  agentTasks?: AgentTaskInfo[];
}

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

  // === Session Content (SSE-pushed from JSONL file watching) ===
  sessionContent: Map<string, SessionContent>;

  // === Session Questions (G4.5: AskUserQuestion tool calls from SSE) ===
  sessionQuestions: Map<string, SessionQuestion[]>;
  clearSessionQuestions: (sessionId: string) => void;

  // === UI State ===
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;

  // === Actions ===
  refetch: () => void;
}

const UnifiedDataContext = createContext<UnifiedDataContextValue | null>(null);

/**
 * Unified Data Provider
 *
 * Wraps SSE hook for file-watched data including session JSONL content.
 * No polling - all data is pushed via SSE from file watchers.
 */
export function UnifiedDataProvider({ children }: { children: ReactNode }) {
  // SSE data (file-watched: registry, states, tasks, workflows, sessions)
  const sseData = useSSE();

  // UI state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const value: UnifiedDataContextValue = {
    // SSE data
    registry: sseData.registry,
    states: sseData.states,
    tasks: sseData.tasks,
    workflows: sseData.workflows,
    phases: sseData.phases,
    connectionStatus: sseData.connectionStatus,

    // Session content (from SSE - pushed by session:message events)
    sessionContent: sseData.sessionContent,

    // Session questions (G4.5: from SSE - pushed by session:question events)
    sessionQuestions: sseData.sessionQuestions,
    clearSessionQuestions: sseData.clearSessionQuestions,

    // UI state
    selectedProject,
    setSelectedProject,

    // Actions
    refetch: sseData.refetch,
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
