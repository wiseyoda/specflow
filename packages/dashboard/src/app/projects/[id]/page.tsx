"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { ProjectDetailHeader } from "@/components/projects/project-detail-header"
import { ViewTabs } from "@/components/projects/view-tabs"
import { StatusView } from "@/components/projects/status-view"
import { KanbanView } from "@/components/projects/kanban-view"
import { TimelineView } from "@/components/projects/timeline-view"
import { useConnection } from "@/contexts/connection-context"
import { useProjects } from "@/hooks/use-projects"
import { useViewPreference } from "@/hooks/use-view-preference"
import { useWorkflowExecution } from "@/hooks/use-workflow-execution"
import { AlertCircle } from "lucide-react"
import { SessionViewerDrawer } from "@/components/projects/session-viewer-drawer"
import { SessionHistoryList } from "@/components/projects/session-history-list"
import { useSessionHistory } from "@/hooks/use-session-history"
import type { WorkflowIndexEntry } from "@/lib/services/workflow-service"
import {
  toastWorkflowCancelled,
  toastWorkflowError,
  toastAnswersSubmitted,
} from "@/lib/toast-helpers"
import type { ProjectStatus } from "@/lib/action-definitions"
import type { OrchestrationState } from "@specflow/shared"
import type { WorkflowSkill } from "@/hooks/use-workflow-skills"

/**
 * Determine project status from orchestration state
 */
function getProjectStatus(state: OrchestrationState | null | undefined): ProjectStatus {
  if (!state) return "not_initialized"
  if (state.health?.status === "error") return "error"
  if (state.health?.status === "warning") return "warning"
  if (state.health?.status === "initializing") return "initializing"
  if (state.orchestration) return "ready"
  return "needs_setup"
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const { states, tasks, setSelectedProject } = useConnection()
  const { projects, loading: projectsLoading } = useProjects()
  const [activeView, setActiveView] = useViewPreference(projectId)

  // Find project in list
  const project = projects.find((p) => p.id === projectId)

  // Workflow execution state
  const {
    execution: workflowExecution,
    start: startWorkflow,
    cancel: cancelWorkflow,
    submitAnswers,
  } = useWorkflowExecution(projectId, { projectName: project?.name })
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [isCancellingWorkflow, setIsCancellingWorkflow] = useState(false)

  // Question drawer state
  const [isQuestionDrawerOpen, setIsQuestionDrawerOpen] = useState(false)
  const previousStatusRef = useRef<string | null>(null)

  // Session viewer drawer state
  const [isSessionViewerOpen, setIsSessionViewerOpen] = useState(false)
  // Track which session to view: null = current workflow session, string = historical session
  const [selectedHistoricalSession, setSelectedHistoricalSession] = useState<WorkflowIndexEntry | null>(null)

  // Session history for this project
  const {
    sessions: sessionHistory,
    isLoading: sessionHistoryLoading,
    error: sessionHistoryError,
    refresh: refreshSessionHistory,
  } = useSessionHistory(project?.path ?? null)

  // Set selected project for command palette context
  useEffect(() => {
    if (project) {
      setSelectedProject(project)
    }
    return () => setSelectedProject(null)
  }, [project, setSelectedProject])

  // Get orchestration state for this project
  const state = states.get(projectId)

  // Get tasks for this project
  const projectTasks = tasks.get(projectId)

  // Derive project status for actions menu (must be before early returns)
  const projectStatus = useMemo(() => getProjectStatus(state), [state])

  // Workflow handlers
  const handleWorkflowStart = useCallback(async (skill: string) => {
    setIsStartingWorkflow(true)
    try {
      await startWorkflow(skill)
    } finally {
      setIsStartingWorkflow(false)
    }
  }, [startWorkflow])

  const handleWorkflowCancel = useCallback(async () => {
    setIsCancellingWorkflow(true)
    try {
      await cancelWorkflow()
      toastWorkflowCancelled()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toastWorkflowError(message)
    } finally {
      setIsCancellingWorkflow(false)
    }
  }, [cancelWorkflow])

  const handleWorkflowStartFromCard = useCallback((skill: WorkflowSkill) => {
    handleWorkflowStart(skill.command)
  }, [handleWorkflowStart])

  // Auto-open question drawer when questions arrive
  useEffect(() => {
    const prevStatus = previousStatusRef.current
    const currentStatus = workflowExecution?.status

    // Detect transition to waiting_for_input
    if (
      currentStatus === 'waiting_for_input' &&
      prevStatus !== 'waiting_for_input'
    ) {
      setIsQuestionDrawerOpen(true)
    }

    previousStatusRef.current = currentStatus ?? null
  }, [workflowExecution?.status])

  // Handle question badge click
  const handleQuestionBadgeClick = useCallback(() => {
    setIsQuestionDrawerOpen(true)
  }, [])

  // Handle session button click (from header - shows current workflow)
  const handleSessionClick = useCallback(() => {
    setSelectedHistoricalSession(null) // Clear historical selection, show current
    setIsSessionViewerOpen(true)
  }, [])

  // Handle historical session click (from session history list)
  const handleHistoricalSessionClick = useCallback((session: WorkflowIndexEntry) => {
    setSelectedHistoricalSession(session)
    setIsSessionViewerOpen(true)
  }, [])

  // Handle resuming a historical session with a follow-up message
  const [isResumingSession, setIsResumingSession] = useState(false)
  const handleResumeSession = useCallback(async (sessionId: string, followUp: string) => {
    setIsResumingSession(true)
    try {
      // Start workflow with the follow-up as skill, resuming the session
      // The follow-up message becomes the prompt, and we resume the session
      await startWorkflow(followUp, { resumeSessionId: sessionId })
      // Clear selected historical session since we're now in a new workflow
      setSelectedHistoricalSession(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toastWorkflowError(message)
      throw error // Re-throw so UI stays in input state
    } finally {
      setIsResumingSession(false)
    }
  }, [startWorkflow])

  // Handle answer submission
  const handleSubmitAnswers = useCallback(async (answers: Record<string, string>) => {
    try {
      await submitAnswers(answers)
      setIsQuestionDrawerOpen(false)
      toastAnswersSubmitted()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toastWorkflowError(message)
      throw error // Re-throw so drawer stays open
    }
  }, [submitAnswers])

  // Loading state
  if (projectsLoading) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          {/* Header skeleton */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
            <div className="animate-pulse space-y-2">
              <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="px-6 py-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="animate-pulse flex gap-2">
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="flex-1 p-6">
            <div className="animate-pulse grid grid-cols-2 gap-4">
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  // Project not found
  if (!project) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-neutral-400 mb-4" />
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Project Not Found
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              The project with ID &quot;{projectId}&quot; could not be found.
            </p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to project list
            </button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <ProjectDetailHeader
          project={project}
          projectStatus={projectStatus}
          schemaVersion={state?.schema_version}
          isAvailable={!project.isUnavailable}
          workflowExecution={workflowExecution}
          isStartingWorkflow={isStartingWorkflow}
          onWorkflowStart={handleWorkflowStart}
          onQuestionBadgeClick={handleQuestionBadgeClick}
          onSessionClick={handleSessionClick}
        />

        <ViewTabs activeView={activeView} onViewChange={setActiveView} />

        <div className="flex-1 overflow-auto p-6">
          {activeView === "status" && (
            <StatusView
              project={project}
              state={state}
              tasksData={projectTasks}
              workflowExecution={workflowExecution}
              isStartingWorkflow={isStartingWorkflow}
              isCancellingWorkflow={isCancellingWorkflow}
              onWorkflowStart={handleWorkflowStartFromCard}
              onWorkflowCancel={handleWorkflowCancel}
              onSubmitAnswers={handleSubmitAnswers}
              isQuestionDrawerOpen={isQuestionDrawerOpen}
              onQuestionDrawerOpenChange={setIsQuestionDrawerOpen}
              sessionHistory={sessionHistory}
              sessionHistoryLoading={sessionHistoryLoading}
              sessionHistoryError={sessionHistoryError}
              selectedSessionId={selectedHistoricalSession?.sessionId ?? null}
              onSessionClick={handleHistoricalSessionClick}
              onRefreshSessionHistory={refreshSessionHistory}
            />
          )}
          {activeView === "kanban" && (
            <KanbanView tasksData={projectTasks} state={state} />
          )}
          {activeView === "timeline" && (
            <TimelineView project={project} state={state} />
          )}
        </div>

        {/* Session Viewer Drawer */}
        <SessionViewerDrawer
          open={isSessionViewerOpen}
          onOpenChange={(open) => {
            setIsSessionViewerOpen(open)
            if (!open) setSelectedHistoricalSession(null) // Clear selection on close
          }}
          projectPath={project.path}
          sessionId={selectedHistoricalSession?.sessionId ?? workflowExecution?.sessionId ?? null}
          isActive={
            selectedHistoricalSession
              ? (selectedHistoricalSession.status === 'running' || selectedHistoricalSession.status === 'waiting_for_input')
              : (workflowExecution?.status === 'running' || workflowExecution?.status === 'waiting_for_input')
          }
          onResumeSession={handleResumeSession}
          isResuming={isResumingSession}
        />
      </div>
    </MainLayout>
  )
}
