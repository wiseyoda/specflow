"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { ViewType } from "@/components/layout/icon-sidebar"
import { DashboardWelcome } from "@/components/views/dashboard-welcome"
import { SessionConsole } from "@/components/views/session-console"
import { TasksKanban } from "@/components/views/tasks-kanban"
import { HistoryTimeline } from "@/components/views/history-timeline"
import { ContextDrawer } from "@/components/layout/context-drawer"
import { OmniBox, OmniBoxHandle } from "@/components/input/omni-box"
import { DecisionToast } from "@/components/input/decision-toast"
import { FailedToast } from "@/components/input/failed-toast"
import { DetachedBanner } from "@/components/input/detached-banner"
import type { WorkflowStatus } from "@/components/design-system"
import { useConnection } from "@/contexts/connection-context"
import { useProjects } from "@/hooks/use-projects"
import { useWorkflowExecution } from "@/hooks/use-workflow-execution"
import { AlertCircle } from "lucide-react"
import { SessionViewerDrawer } from "@/components/projects/session-viewer-drawer"
import { useSessionHistory } from "@/hooks/use-session-history"
import { useSessionMessages } from "@/hooks/use-session-messages"
import { usePhaseHistory } from "@/hooks/use-phase-history"
import { useGitChanges } from "@/hooks/use-git-changes"
import { useGitActivity } from "@/hooks/use-git-activity"
import type { WorkflowIndexEntry } from "@/lib/services/workflow-service"
import {
  toastWorkflowCancelled,
  toastWorkflowError,
} from "@/lib/toast-helpers"
import type { ProjectStatus } from "@/lib/action-definitions"
import type { OrchestrationState, Task } from "@specflow/shared"
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

/**
 * Convert workflow execution status to WorkflowStatus for UI
 */
function getWorkflowStatus(execution: { status?: string } | null): WorkflowStatus {
  if (!execution?.status) return 'idle'
  switch (execution.status) {
    case 'running': return 'running'
    case 'waiting_for_input': return 'waiting'
    case 'failed': return 'failed'
    case 'detached': return 'idle' // Detached is not an error state - show as idle with message
    case 'completed':
    case 'cancelled':
    default: return 'idle'
  }
}

/**
 * Check if workflow is in detached state (dashboard lost track but session may be running)
 */
function isWorkflowDetached(execution: { status?: string } | null): boolean {
  return execution?.status === 'detached'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const { states, tasks, setSelectedProject } = useConnection()
  const { projects, loading: projectsLoading } = useProjects()
  const [activeView, setActiveView] = useState<ViewType>('dashboard')

  // OmniBox ref for focus handling
  const omniBoxRef = useRef<OmniBoxHandle>(null)

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

  // Question drawer state - removed in favor of toast
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

  // Session messages for live console view
  // Include detached sessions - they may still be receiving writes
  const isWorkflowActive = workflowExecution?.status === 'running' ||
    workflowExecution?.status === 'waiting_for_input' ||
    workflowExecution?.status === 'detached'
  const {
    messages: sessionMessages,
    isLoading: sessionMessagesLoading,
  } = useSessionMessages(
    project?.path ?? null,
    workflowExecution?.sessionId ?? null,
    isWorkflowActive
  )

  // Phase history from ROADMAP.md
  const {
    phases: phaseHistory,
    isLoading: phaseHistoryLoading,
  } = usePhaseHistory(project?.path ?? null)

  // Git changes (touched files)
  const {
    files: touchedFiles,
    totalAdditions,
    totalDeletions,
  } = useGitChanges(project?.path ?? null)

  // Git activity (recent commits)
  const {
    activities: recentActivity,
  } = useGitActivity(project?.path ?? null, 20)

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

  // Track status changes for toast display
  useEffect(() => {
    previousStatusRef.current = workflowExecution?.status ?? null
  }, [workflowExecution?.status])

  // Handle OmniBox focus
  const handleFocusOmniBox = useCallback(() => {
    omniBoxRef.current?.focus()
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

  // Get workflow status for UI (must be before early returns for hooks consistency)
  const workflowStatus = getWorkflowStatus(workflowExecution)

  // Get current task from tasks data (in_progress)
  const currentTask: Task | null = useMemo(() =>
    projectTasks?.tasks?.find((t) => t.status === 'in_progress') ?? null
  , [projectTasks])

  // Get next task (first todo task) - shown when no current task
  const nextTask: Task | null = useMemo(() =>
    projectTasks?.tasks?.find((t) => t.status === 'todo') ?? null
  , [projectTasks])

  // Handle OmniBox submit
  const handleOmniBoxSubmit = useCallback((message: string) => {
    // If waiting for input, submit as answer
    if (workflowStatus === 'waiting' && workflowExecution?.output?.questions?.length) {
      // For simplicity, use the message as answer to first question
      submitAnswers({ '0': message })
    } else {
      // Otherwise start a new workflow with the message
      handleWorkflowStart(message)
    }
  }, [workflowStatus, workflowExecution, submitAnswers, handleWorkflowStart])

  // Handle decision toast answer
  const handleDecisionAnswer = useCallback((answer: string) => {
    if (workflowExecution?.output?.questions?.length) {
      submitAnswers({ '0': answer })
    }
  }, [workflowExecution, submitAnswers])

  // Handle failed toast retry
  const handleRetry = useCallback(() => {
    // Re-start the last workflow
    if (workflowExecution?.skill) {
      handleWorkflowStart(workflowExecution.skill)
    }
  }, [workflowExecution, handleWorkflowStart])

  // Handle failed toast dismiss
  const handleDismiss = useCallback(() => {
    // Cancel the failed workflow to clear state
    cancelWorkflow()
  }, [cancelWorkflow])

  // Build questions for decision toast
  const decisionQuestions = useMemo(() => {
    if (!workflowExecution?.output?.questions) return []
    return workflowExecution.output.questions.map((q) => ({
      question: q.question,
      options: q.options?.map((opt) => ({
        label: opt.label,
        description: opt.description,
      })) ?? [],
    }))
  }, [workflowExecution?.output?.questions])

  // Loading state
  if (projectsLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-surface-200 rounded" />
            <div className="h-32 bg-surface-200 rounded" />
            <div className="h-32 bg-surface-200 rounded" />
            <div className="h-32 bg-surface-200 rounded" />
          </div>
        </div>
      </AppLayout>
    )
  }

  // Project not found
  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-surface-400 mb-4" />
          <h2 className="text-lg font-medium text-white mb-2">
            Project Not Found
          </h2>
          <p className="text-sm text-surface-500 mb-4">
            The project with ID &quot;{projectId}&quot; could not be found.
          </p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-accent hover:underline"
          >
            Return to project list
          </button>
        </div>
      </AppLayout>
    )
  }

  // Map internal view names to match existing component expectations
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardWelcome
            state={state}
            tasksData={projectTasks}
            onStartWorkflow={handleWorkflowStart}
            isStartingWorkflow={isStartingWorkflow}
          />
        )
      case 'session':
        return (
          <SessionConsole
            messages={sessionMessages}
            isLoading={sessionMessagesLoading}
            isProcessing={workflowStatus === 'running'}
            workflowStatus={workflowStatus}
            onStartWorkflow={() => handleWorkflowStart('implement')}
            onViewDashboard={() => setActiveView('dashboard')}
          />
        )
      case 'tasks':
        return <TasksKanban tasksData={projectTasks} state={state} />
      case 'history':
        // Transform phase history to HistoryTimeline format
        const phases = phaseHistory.map((p) => ({
          number: p.number,
          name: p.name,
          status: p.status === 'complete' ? 'completed' as const
            : p.status === 'in_progress' ? 'in_progress' as const
            : p.status === 'blocked' ? 'failed' as const
            : 'pending' as const,
          artifacts: ['spec.md', 'plan.md', 'tasks.md'],
        }))
        return <HistoryTimeline state={state} phases={phases} projectPath={project.path} />
      default:
        return null
    }
  }

  // Extract branch name from state
  const branchName = state?.orchestration?.phase?.branch ?? undefined

  // Context drawer content
  const contextDrawerContent = (
    <ContextDrawer
      state={state}
      tasksData={projectTasks}
      currentTask={currentTask}
      nextTask={nextTask}
      touchedFiles={touchedFiles}
      totalAdditions={totalAdditions}
      totalDeletions={totalDeletions}
      recentActivity={recentActivity}
    />
  )

  return (
    <AppLayout
      projectPath={project.path}
      branchName={branchName}
      workflowStatus={workflowStatus}
      workflowStartTime={workflowExecution?.startedAt ? new Date(workflowExecution.startedAt) : null}
      activeView={activeView}
      onViewChange={setActiveView}
      contextDrawer={contextDrawerContent}
      onFocusOmniBox={handleFocusOmniBox}
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 relative overflow-auto">
          {renderContent()}
        </div>

        {/* OmniBox at bottom */}
        <OmniBox
          ref={omniBoxRef}
          status={workflowStatus}
          onSubmit={handleOmniBoxSubmit}
          disabled={isStartingWorkflow}
        />
      </div>

      {/* Decision Toast - shown when waiting for input */}
      {workflowStatus === 'waiting' && decisionQuestions.length > 0 && (
        <DecisionToast
          questions={decisionQuestions}
          onAnswer={handleDecisionAnswer}
          onCustomAnswer={handleOmniBoxSubmit}
        />
      )}

      {/* Failed Toast - shown when workflow failed (not detached) */}
      {workflowStatus === 'failed' && !isWorkflowDetached(workflowExecution) && (
        <FailedToast
          error={workflowExecution?.error ?? 'An unexpected error occurred'}
          onRetry={handleRetry}
          onDismiss={handleDismiss}
        />
      )}

      {/* Detached Banner - shown when dashboard lost track but session may still be running */}
      {isWorkflowDetached(workflowExecution) && (
        <DetachedBanner
          sessionId={workflowExecution?.sessionId}
          onViewSession={() => {
            setActiveView('session')
          }}
        />
      )}

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
    </AppLayout>
  )
}
