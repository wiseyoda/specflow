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
import { useUnifiedData } from "@/contexts/unified-data-context"
import { useProjects } from "@/hooks/use-projects"
import { useProjectData } from "@/hooks/use-project-data"
import { useWorkflowActions } from "@/hooks/use-workflow-actions"
import { useSessionContentExtended } from "@/hooks/use-session-content"
import { AlertCircle } from "lucide-react"
import { SessionViewerDrawer } from "@/components/projects/session-viewer-drawer"
import { usePhaseHistory } from "@/hooks/use-phase-history"
import { usePhaseDetail } from "@/hooks/use-phase-detail"
import { useGitChanges } from "@/hooks/use-git-changes"
import type { WorkflowIndexEntry } from "@/lib/services/workflow-service"
import {
  toastWorkflowCancelled,
  toastWorkflowError,
} from "@/lib/toast-helpers"
import type { ProjectStatus } from "@/lib/action-definitions"
import type { OrchestrationState, Task } from "@specflow/shared"
import { useWorkflowSkills, type WorkflowSkill } from "@/hooks/use-workflow-skills"
import { useOrchestration } from "@/hooks/use-orchestration"

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

  const { setSelectedProject } = useConnection()
  const { projects, loading: projectsLoading } = useProjects()
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [historySelectedPhase, setHistorySelectedPhase] = useState<string | null>(null)

  // OmniBox ref for focus handling
  const omniBoxRef = useRef<OmniBoxHandle>(null)

  // Find project in list
  const project = projects.find((p) => p.id === projectId)

  // G4.7: Session questions from SSE (AskUserQuestion tool calls)
  const { sessionQuestions, clearSessionQuestions } = useUnifiedData()

  // Project data from SSE (real-time)
  const {
    state,
    tasks: projectTasks,
    workflow,
    currentExecution,
    sessions: sessionHistory,
    isLoading: projectDataLoading,
  } = useProjectData(projectId)

  // Workflow execution state (derived from SSE data)
  const workflowExecution = currentExecution

  // Workflow actions (mutations)
  const {
    start: startWorkflowAction,
    cancel: cancelWorkflowAction,
    submitAnswers: submitAnswersAction,
    isSubmitting: isSubmittingWorkflow,
  } = useWorkflowActions(projectId)
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [isCancellingWorkflow, setIsCancellingWorkflow] = useState(false)

  // Wrapper functions for workflow actions
  const startWorkflow = useCallback(async (skill: string, options?: { resumeSessionId?: string }) => {
    await startWorkflowAction(skill, options)
  }, [startWorkflowAction])

  const cancelWorkflow = useCallback(async () => {
    await cancelWorkflowAction(workflowExecution?.executionId, workflowExecution?.sessionId)
  }, [cancelWorkflowAction, workflowExecution])

  const submitAnswers = useCallback(async (answers: Record<string, string>) => {
    if (!workflowExecution?.executionId) throw new Error('No active workflow')
    await submitAnswersAction(workflowExecution.executionId, answers)
  }, [submitAnswersAction, workflowExecution])

  // Workflow skills for autocomplete
  const { skills: workflowSkills } = useWorkflowSkills()

  // Orchestration state (for pause functionality in session console)
  const {
    orchestration,
    activeSessionId: orchestrationSessionId,  // Session ID from orchestration polling
    pause: pauseOrchestration,
    resume: resumeOrchestration,
    goBackToStep,       // FR-004: Go back to previous step
    isGoingBackToStep,  // FR-004: Loading state for go-back
  } = useOrchestration({ projectId })

  // Check if there's an active orchestration that can be paused
  const hasActiveOrchestration = !!(
    orchestration &&
    ['running', 'paused', 'waiting_merge', 'needs_attention'].includes(orchestration.status)
  )

  // Question drawer state - removed in favor of toast
  const previousStatusRef = useRef<string | null>(null)

  // Multi-question tracking: stores partial answers until all questions are answered
  const [partialAnswers, setPartialAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  // Reset question tracking when workflow questions change (new question set)
  // TODO: T010 - Questions will come via session:question SSE events
  const questionsKey = ''
  useEffect(() => {
    setPartialAnswers({})
    setCurrentQuestionIndex(0)
  }, [questionsKey])

  // Session viewer drawer state
  const [isSessionViewerOpen, setIsSessionViewerOpen] = useState(false)
  // Track which session to view: null = current workflow session, string = historical session
  const [selectedHistoricalSession, setSelectedHistoricalSession] = useState<WorkflowIndexEntry | null>(null)
  // Track which session is selected in the Session console view (separate from drawer)
  const [selectedConsoleSession, setSelectedConsoleSession] = useState<WorkflowIndexEntry | null>(null)

  // Session history is now from useProjectData (SSE-pushed)
  // No need for separate hook - sessionHistory comes from projectData above

  // Refresh function no longer needed - SSE handles real-time updates
  const refreshSessionHistory = useCallback(() => {
    // No-op: SSE provides real-time updates
  }, [])

  // Session messages for live console view
  // Include detached sessions - they may still be receiving writes
  const isWorkflowActive = workflowExecution?.status === 'running' ||
    workflowExecution?.status === 'waiting_for_input' ||
    workflowExecution?.status === 'detached'

  // Determine which session to show in console: selected historical or current workflow
  // Use orchestrationSessionId as fallback - it's populated by polling and available faster than SSE
  const consoleSessionId = selectedConsoleSession?.sessionId ?? workflowExecution?.sessionId ?? orchestrationSessionId ?? null

  // Debug: log consoleSessionId changes
  useEffect(() => {
    console.log(`[Page] consoleSessionId changed:`, {
      consoleSessionId,
      selectedSessionId: selectedConsoleSession?.sessionId,
      workflowSessionId: workflowExecution?.sessionId,
      orchestrationSessionId,
    });
  }, [consoleSessionId, selectedConsoleSession?.sessionId, workflowExecution?.sessionId, orchestrationSessionId]);

  const isConsoleSessionActive = selectedConsoleSession
    ? (selectedConsoleSession.status === 'running' || selectedConsoleSession.status === 'waiting_for_input' || selectedConsoleSession.status === 'detached')
    : isWorkflowActive

  // Session content from SSE (no polling)
  const {
    messages: sessionMessages,
    isLoading: sessionMessagesLoading,
    currentTodos: sessionTodos,
    workflowOutput: sessionWorkflowOutput,
    hasEnded: sessionHasEnded,
  } = useSessionContentExtended(consoleSessionId, project?.path ?? null)

  // Phase history from ROADMAP.md (SSE for real-time updates)
  const {
    phases: phaseHistory,
    activePhase,
    isLoading: phaseHistoryLoading,
  } = usePhaseHistory(projectId, project?.path ?? null)

  // Determine focus phase: active phase if exists, otherwise first pending phase
  const focusPhase = useMemo(() => {
    if (activePhase) return activePhase
    return phaseHistory.find((p) => p.status === 'not_started') ?? null
  }, [activePhase, phaseHistory])

  // Fetch detailed info for the focus phase
  const {
    detail: focusPhaseDetail,
    isLoading: focusPhaseLoading,
  } = usePhaseDetail(
    project?.path ?? null,
    focusPhase?.number ?? null,
    focusPhase?.name
  )

  // Git changes (touched files) - refresh when session messages, tasks, or state change
  // Combine triggers: session messages, task count, and state timestamp
  const gitRefreshTrigger = useMemo(() => {
    const taskCount = projectTasks?.totalCount ?? 0
    const completedCount = projectTasks?.completedCount ?? 0
    const stateTimestamp = state?.orchestration?.phase?.number ?? ''
    return `${sessionMessages.length}-${taskCount}-${completedCount}-${stateTimestamp}`
  }, [sessionMessages.length, projectTasks, state])

  const {
    files: touchedFiles,
    totalAdditions,
    totalDeletions,
  } = useGitChanges(project?.path ?? null, gitRefreshTrigger)

  // Set selected project for command palette context
  useEffect(() => {
    if (project) {
      setSelectedProject(project)
    }
    return () => setSelectedProject(null)
  }, [project, setSelectedProject])

  // state and projectTasks now come from useProjectData above

  // Derive project status for actions menu (must be before early returns)
  const projectStatus = useMemo(() => getProjectStatus(state), [state])

  // Workflow handlers
  const handleWorkflowStart = useCallback(async (skill: string) => {
    setIsStartingWorkflow(true)
    try {
      await startWorkflow(skill)
      // Clear any selected historical session so the new workflow's session is shown
      setSelectedConsoleSession(null)
      // Navigate to session view when workflow starts
      setActiveView('session')
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

  // Auto-refresh session history when a new workflow session becomes available
  // This handles the race condition when orchestration starts a workflow asynchronously
  const prevSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    const currentSessionId = workflowExecution?.sessionId ?? null
    if (currentSessionId && currentSessionId !== prevSessionIdRef.current) {
      // New session appeared - refresh history so it shows in the list
      refreshSessionHistory()
    }
    prevSessionIdRef.current = currentSessionId
  }, [workflowExecution?.sessionId, refreshSessionHistory])

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

  // Handle console session selection (for Session view dropdown)
  const handleConsoleSessionSelect = useCallback((session: WorkflowIndexEntry | null) => {
    setSelectedConsoleSession(session)
  }, [])

  // Handle resuming a historical session with a follow-up message
  const [isResumingSession, setIsResumingSession] = useState(false)
  const handleResumeSession = useCallback(async (sessionId: string, followUp: string) => {
    setIsResumingSession(true)
    try {
      // Start workflow with the follow-up as skill, resuming the session
      // The follow-up message becomes the prompt, and we resume the session
      await startWorkflow(followUp, { resumeSessionId: sessionId })
      // Clear session selections so the console shows the new/resumed workflow session
      setSelectedHistoricalSession(null)
      setSelectedConsoleSession(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toastWorkflowError(message)
      throw error // Re-throw so UI stays in input state
    } finally {
      setIsResumingSession(false)
    }
  }, [startWorkflow])

  // Get workflow status for UI (must be before early returns for hooks consistency)
  // Check if session has ended based on messages (ground truth from JSONL)
  const hasSessionEnded = useMemo(() =>
    sessionMessages.some(m => m.isSessionEnd)
  , [sessionMessages])

  // Derive effective workflow status - override to idle if session has ended
  // Also consider the selected console session (user may have selected a waiting session from dropdown)
  const workflowStatus: WorkflowStatus = useMemo(() => {
    // If user selected a specific session from dropdown, use that session's status
    if (selectedConsoleSession) {
      // Map the session status to WorkflowStatus
      switch (selectedConsoleSession.status) {
        case 'running': return 'running'
        case 'waiting_for_input': return 'waiting'
        case 'failed': return 'failed'
        default: return 'idle'
      }
    }

    const polledStatus = getWorkflowStatus(workflowExecution)
    // If messages show session ended but polling still says running, trust the messages
    if (hasSessionEnded && (polledStatus === 'running' || polledStatus === 'waiting')) {
      return 'idle'
    }
    return polledStatus
  }, [workflowExecution, hasSessionEnded, selectedConsoleSession])

  // Proactively update workflow metadata when session ends externally
  // This ensures the workflow index reflects reality even if user ends session via CLI
  useEffect(() => {
    if (
      hasSessionEnded &&
      workflowExecution?.sessionId === consoleSessionId &&
      (workflowExecution?.status === 'running' || workflowExecution?.status === 'waiting_for_input' || workflowExecution?.status === 'detached')
    ) {
      // Mark as completed (graceful end), not cancelled
      const params = new URLSearchParams({
        sessionId: workflowExecution.sessionId,
        projectId,
        status: 'completed', // Graceful session end
      })
      fetch(`/api/workflow/cancel?${params}`, { method: 'POST' }).catch(() => {
        // Ignore errors - the session is already ended
      })
    }
  }, [hasSessionEnded, workflowExecution?.sessionId, workflowExecution?.status, consoleSessionId, projectId])

  // Get current task from tasks data (in_progress)
  const currentTask: Task | null = useMemo(() =>
    projectTasks?.tasks?.find((t) => t.status === 'in_progress') ?? null
  , [projectTasks])

  // Get next task (first todo task) - shown when no current task
  const nextTask: Task | null = useMemo(() =>
    projectTasks?.tasks?.find((t) => t.status === 'todo') ?? null
  , [projectTasks])

  // Handle decision toast answer - supports multi-question flows
  // Defined before handleOmniBoxSubmit since it's called from there
  // G4.7/G4.8: Questions come via session:question SSE events OR fallback sources
  const handleDecisionAnswer = useCallback(async (answer: string) => {
    // Get questions from SSE map first
    const sseQuestions = consoleSessionId ? sessionQuestions.get(consoleSessionId) : undefined

    // Fallback: compute questions from session messages (same logic as decisionQuestions memo)
    let fallbackQuestions: Array<{ question: string; options: Array<{ label: string; description?: string }> }> = []
    if (!sseQuestions?.length && sessionMessages.length > 0) {
      for (let i = sessionMessages.length - 1; i >= 0; i--) {
        const msg = sessionMessages[i]
        if (msg.role === 'assistant' && msg.questions && msg.questions.length > 0) {
          fallbackQuestions = msg.questions.map((q) => ({
            question: q.question,
            options: q.options.map((opt) => ({ label: opt.label, description: opt.description })),
          }))
          break
        }
      }
    }
    // Second fallback: StructuredOutput questions
    if (!sseQuestions?.length && fallbackQuestions.length === 0 &&
        sessionWorkflowOutput?.status === 'needs_input' && sessionWorkflowOutput.questions) {
      fallbackQuestions = sessionWorkflowOutput.questions.map((q) => ({
        question: q.question,
        options: (q.options || []).map((opt) => ({ label: opt.label, description: opt.description })),
      }))
    }

    const questions = sseQuestions?.length ? sseQuestions : fallbackQuestions

    if (!questions?.length) {
      console.warn('[handleDecisionAnswer] No questions available to answer')
      return
    }

    const totalQuestions = questions.length

    // Store the answer for the current question
    const newAnswers = { ...partialAnswers, [String(currentQuestionIndex)]: answer }
    setPartialAnswers(newAnswers)

    // Check if we've answered all questions
    const answeredCount = Object.keys(newAnswers).length

    if (answeredCount >= totalQuestions) {
      // All questions answered - submit all answers together
      // For fallback questions (no active execution), resume the session with the answer
      const sessionId = selectedConsoleSession?.sessionId ?? workflowExecution?.sessionId ?? consoleSessionId

      try {
        // Try submitAnswers first (works for active workflow executions)
        await submitAnswers(newAnswers)
        // G4.8: Clear questions from map after user answers
        if (consoleSessionId) {
          clearSessionQuestions(consoleSessionId)
        }
        // Reset state after successful submission
        setPartialAnswers({})
        setCurrentQuestionIndex(0)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        // If execution tracking was lost OR this is a historical session, resume with the answer
        const shouldFallbackToResume = errorMessage.includes('expired') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('No active workflow')

        if (sessionId && shouldFallbackToResume) {
          console.log('[handleDecisionAnswer] Falling back to session resume with answer:', sessionId)
          try {
            // Format answers for resumption prompt
            const answerSummary = Object.entries(newAnswers)
              .map(([idx, ans]) => `${idx}: ${ans}`)
              .join(', ')
            await startWorkflow(`My answers: ${answerSummary}`, { resumeSessionId: sessionId })
          } catch (resumeError) {
            const resumeErrorMessage = resumeError instanceof Error ? resumeError.message : 'Unknown error'
            toastWorkflowError(`Failed to resume session: ${resumeErrorMessage}`)
          }
        } else if (!sessionId && shouldFallbackToResume) {
          toastWorkflowError('Unable to resume session - session ID not found')
        } else {
          toastWorkflowError(errorMessage)
        }
        // G4.8: Clear questions on error too
        if (consoleSessionId) {
          clearSessionQuestions(consoleSessionId)
        }
        // Reset state on error too
        setPartialAnswers({})
        setCurrentQuestionIndex(0)
      }
    } else {
      // More questions to answer - advance to next question
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }, [consoleSessionId, sessionQuestions, clearSessionQuestions, workflowExecution, submitAnswers, startWorkflow, partialAnswers, currentQuestionIndex, sessionMessages, sessionWorkflowOutput, selectedConsoleSession])

  // Handle OmniBox submit
  const handleOmniBoxSubmit = useCallback(async (message: string) => {
    // G6.11: If orchestration is paused, auto-resume when user sends a command
    if (orchestration?.status === 'paused') {
      try {
        await resumeOrchestration()
        console.log('[page] Auto-resumed orchestration on user input')
      } catch (error) {
        console.error('[page] Failed to auto-resume orchestration:', error)
      }
    }

    // G4.7: If waiting for input and we have questions, use the decision handler
    const hasQuestions = consoleSessionId && (sessionQuestions.get(consoleSessionId)?.length ?? 0) > 0
    if (workflowStatus === 'waiting' && hasQuestions) {
      await handleDecisionAnswer(message)
      return
    }

    // Check if this is a slash command (starts with /) or plain message
    const isSlashCommand = message.trim().startsWith('/')

    // If there's an active running session and user sends a plain message,
    // resume that session with the message (intervene/guide behavior)
    if (workflowStatus === 'running' && workflowExecution?.sessionId && !isSlashCommand) {
      try {
        await startWorkflow(message, { resumeSessionId: workflowExecution.sessionId })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toastWorkflowError(errorMessage)
      }
      return
    }

    // If user has explicitly selected a session (from dropdown), resume that session
    // This applies to ANY input (plain text or slash command)
    if (selectedConsoleSession?.sessionId) {
      try {
        // Cancel stale workflow state if needed (includes detached - may still have active session)
        if (workflowExecution?.status === 'running' || workflowExecution?.status === 'waiting_for_input' || workflowExecution?.status === 'detached') {
          await cancelWorkflow()
        }
        await startWorkflow(message, { resumeSessionId: selectedConsoleSession.sessionId })
        // Clear selected session so console shows the new workflow's session
        setSelectedConsoleSession(null)
        // Navigate to session view
        setActiveView('session')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toastWorkflowError(errorMessage)
      }
      return
    }

    // If viewing current workflow session (not selected from dropdown) and plain text,
    // resume with that session
    if (consoleSessionId && !isSlashCommand) {
      try {
        // Cancel stale workflow state if needed
        if (workflowExecution?.status === 'running' || workflowExecution?.status === 'waiting_for_input' || workflowExecution?.status === 'detached') {
          await cancelWorkflow()
        }
        await startWorkflow(message, { resumeSessionId: consoleSessionId })
        // Navigate to session view
        setActiveView('session')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toastWorkflowError(errorMessage)
      }
      return
    }

    // If no session context and user sends plain message, show error
    if (!isSlashCommand) {
      toastWorkflowError('No session selected. Use a /command to start a new workflow.')
      return
    }

    // If session has ended but hook still thinks workflow is active,
    // cancel it first to clear the stale state
    if (hasSessionEnded && (workflowExecution?.status === 'running' || workflowExecution?.status === 'waiting_for_input' || workflowExecution?.status === 'detached')) {
      await cancelWorkflow()
    }

    // Start a new workflow (slash command)
    handleWorkflowStart(message)
  }, [workflowStatus, workflowExecution, handleDecisionAnswer, startWorkflow, handleWorkflowStart, hasSessionEnded, cancelWorkflow, consoleSessionId, selectedConsoleSession, setActiveView, orchestration, resumeOrchestration])

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

  // Handle ending a session by ID (from session console Cancel button)
  const handleEndSession = useCallback(async (sessionId: string) => {
    try {
      const params = new URLSearchParams({
        sessionId,
        projectId,
      })
      await fetch(`/api/workflow/cancel?${params}`, { method: 'POST' })
      // Clear selected session if it was the one we cancelled
      if (selectedConsoleSession?.sessionId === sessionId) {
        setSelectedConsoleSession(null)
      }
      // Refresh session history to reflect the cancelled status
      refreshSessionHistory()
    } catch (error) {
      console.error('Failed to end session:', error)
    }
  }, [projectId, selectedConsoleSession, refreshSessionHistory])

  // Handle pausing a session (pauses orchestration if active)
  const handlePauseSession = useCallback(async (_sessionId: string) => {
    if (hasActiveOrchestration) {
      await pauseOrchestration()
      refreshSessionHistory()
    }
  }, [hasActiveOrchestration, pauseOrchestration, refreshSessionHistory])

  // G4.6/G4.7: Build questions for decision toast from SSE sessionQuestions
  // Fall back to extracting questions from session messages if SSE questions not available
  const decisionQuestions = useMemo(() => {
    if (!consoleSessionId) return []

    // First, try SSE questions (real-time)
    const sseQuestions = sessionQuestions.get(consoleSessionId)
    if (sseQuestions && sseQuestions.length > 0) {
      return sseQuestions.map((q) => ({
        question: q.question,
        options: q.options.map((opt) => ({
          label: opt.label,
          description: opt.description,
        })),
      }))
    }

    // Fallback: Extract questions from session messages
    // This handles the case where user navigates to a waiting session
    // after the SSE event was already processed
    if (sessionMessages.length > 0) {
      // Find the last assistant message with questions
      for (let i = sessionMessages.length - 1; i >= 0; i--) {
        const msg = sessionMessages[i]
        // Check for AskUserQuestion tool call questions
        if (msg.role === 'assistant' && msg.questions && msg.questions.length > 0) {
          return msg.questions.map((q) => ({
            question: q.question,
            options: q.options.map((opt) => ({
              label: opt.label,
              description: opt.description,
            })),
          }))
        }
      }
    }

    // Second fallback: Check sessionWorkflowOutput for StructuredOutput questions
    // In CLI mode, Claude uses StructuredOutput with status: 'needs_input'
    if (sessionWorkflowOutput?.status === 'needs_input' && sessionWorkflowOutput.questions) {
      return sessionWorkflowOutput.questions.map((q) => ({
        question: q.question,
        options: (q.options || []).map((opt) => ({
          label: opt.label,
          description: opt.description,
        })),
      }))
    }

    return []
  }, [consoleSessionId, sessionQuestions, sessionMessages, sessionWorkflowOutput])

  // Show question loading state when status is waiting but questions haven't loaded yet
  const isQuestionsLoading = workflowStatus === 'waiting' && decisionQuestions.length === 0 && sessionMessagesLoading

  // Handle clicking the "Waiting" badge - navigate to session view to show questions
  const handleStatusClick = useCallback(() => {
    if (workflowStatus === 'waiting') {
      // Ensure we're on the session view so the toast is visible
      if (activeView !== 'session') {
        setActiveView('session')
      }
      // Focus the OmniBox for easy response input
      omniBoxRef.current?.focus()
    }
  }, [workflowStatus, activeView, setActiveView])

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
            focusPhase={focusPhaseDetail}
            focusPhaseLoading={focusPhaseLoading}
            isFocusPhaseActive={!!activePhase}
            projectId={projectId}
            projectName={project?.name}
            onStartWorkflow={handleWorkflowStart}
            onViewHistory={(phaseNumber) => {
              setHistorySelectedPhase(phaseNumber ?? null)
              setActiveView('history')
            }}
            onNavigateToSession={(sessionId) => {
              // If a specific session ID is provided, find it in history and select it
              if (sessionId) {
                const session = sessionHistory.find(s => s.sessionId === sessionId)
                if (session) {
                  setSelectedConsoleSession(session)
                } else {
                  // Session not in history yet - clear selection and it should appear via workflowExecution
                  setSelectedConsoleSession(null)
                  refreshSessionHistory()
                }
              } else {
                // No session ID - clear selected session so the new workflow's session is shown when it becomes available
                setSelectedConsoleSession(null)
                // Refresh session history to pick up the new session
                refreshSessionHistory()
              }
              setActiveView('session')
            }}
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
            sessionHistory={sessionHistory}
            selectedSession={selectedConsoleSession}
            currentSessionId={workflowExecution?.sessionId}
            onSelectSession={handleConsoleSessionSelect}
            onEndSession={handleEndSession}
            onPauseSession={handlePauseSession}
            onResumeSession={resumeOrchestration}
            canPause={hasActiveOrchestration}
            isPaused={orchestration?.status === 'paused'}
            projectId={projectId}
            currentTodos={sessionTodos}
            workflowOutput={sessionWorkflowOutput}
            sessionEnded={sessionHasEnded}
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
        return (
          <HistoryTimeline
            state={state}
            phases={phases}
            projectPath={project.path}
            initialSelectedPhase={historySelectedPhase}
          />
        )
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
      projectId={projectId}
      projectPath={project.path}
      onGoBackToStep={goBackToStep}
      isGoingBackToStep={isGoingBackToStep}
      isWorkflowRunning={workflowStatus === 'running'}
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
          onStatusClick={handleStatusClick}
          disabled={isStartingWorkflow}
          skills={workflowSkills.map(s => ({
            id: s.id,
            name: s.name,
            command: s.command,
            description: s.description,
          }))}
        />
      </div>

      {/* Decision Toast - shown when waiting for input (or loading questions) */}
      {workflowStatus === 'waiting' && (decisionQuestions.length > 0 || isQuestionsLoading) && (
        <DecisionToast
          questions={decisionQuestions}
          currentIndex={currentQuestionIndex}
          onAnswer={handleDecisionAnswer}
          onCustomAnswer={handleOmniBoxSubmit}
          onDismiss={handleDismiss}
          isLoading={isQuestionsLoading}
        />
      )}

      {/* Failed Toast - shown when workflow failed (not detached) */}
      {/* TODO: T010 - Error details will come via SSE events */}
      {workflowStatus === 'failed' && !isWorkflowDetached(workflowExecution) && (
        <FailedToast
          error={'An unexpected error occurred'}
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
            ? (selectedHistoricalSession.status === 'running' || selectedHistoricalSession.status === 'waiting_for_input' || selectedHistoricalSession.status === 'detached')
            : (workflowExecution?.status === 'running' || workflowExecution?.status === 'waiting_for_input' || workflowExecution?.status === 'detached')
        }
        onResumeSession={handleResumeSession}
        isResuming={isResumingSession}
      />
    </AppLayout>
  )
}
