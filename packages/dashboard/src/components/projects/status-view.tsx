"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, FileText, FolderOpen, AlertCircle, Loader2 } from "lucide-react"
import { WorkflowStatusCard } from "@/components/projects/workflow-status-card"
import type { OrchestrationState, TasksData } from "@specflow/shared"
import type { WorkflowExecution } from "@/lib/services/workflow-service"
import type { WorkflowSkill } from "@/lib/workflow-skills"

// Staleness thresholds in minutes
const STALE_THRESHOLD_MINUTES = 5
const STALE_THRESHOLD_IMPLEMENT_MINUTES = 30 // Longer threshold during implement (tasks take time)

interface Project {
  id: string
  name: string
  path: string
  registered_at: string
}

interface StatusViewProps {
  project: Project
  state?: OrchestrationState | null
  tasksData?: TasksData | null
  /** Active workflow execution */
  workflowExecution?: WorkflowExecution | null
  /** Whether a workflow is being started */
  isStartingWorkflow?: boolean
  /** Whether a workflow is being cancelled */
  isCancellingWorkflow?: boolean
  /** Callback to start a workflow */
  onWorkflowStart?: (skill: WorkflowSkill) => void
  /** Callback to cancel the workflow */
  onWorkflowCancel?: () => void
}

export function StatusView({
  project,
  state,
  tasksData,
  workflowExecution,
  isStartingWorkflow,
  isCancellingWorkflow,
  onWorkflowStart,
  onWorkflowCancel,
}: StatusViewProps) {
  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-neutral-400 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          No Orchestration State
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          This project doesn&apos;t have an orchestration state file yet.
          Run <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">specflow state init</code> in the project directory.
        </p>
      </div>
    )
  }

  const phase = state.orchestration?.phase
  const step = state.orchestration?.step
  const implement = state.orchestration?.implement
  const health = state.health

  // Calculate working tasks count
  const workingTasksCount = tasksData?.tasks?.filter((t) => t.status === 'in_progress').length ?? 0
  const currentTasksFromState = (implement?.current_tasks as string[] | undefined)?.length ?? 0

  // Check for failed state
  const isStepFailed = step?.status === 'failed'

  // Check for stale state (in_progress for more than threshold)
  // During implement, also check tasks.md updates since that's where activity happens
  const isStaleState = (() => {
    if (step?.status !== 'in_progress') return false

    // Get the most recent update time from multiple sources
    const stateUpdate = (state as Record<string, unknown>)._fileMtime || state.last_updated
    const tasksUpdate = tasksData?.lastUpdated

    // Find most recent activity
    const timestamps = [stateUpdate, tasksUpdate].filter((t): t is string => !!t)
    if (timestamps.length === 0) return false

    const mostRecentTime = Math.max(...timestamps.map(t => new Date(t).getTime()))
    const now = Date.now()
    const diffMinutes = (now - mostRecentTime) / 1000 / 60

    // Use longer threshold during implement step (tasks take time)
    const threshold = step?.current === 'implement'
      ? STALE_THRESHOLD_IMPLEMENT_MINUTES
      : STALE_THRESHOLD_MINUTES

    return diffMinutes > threshold
  })()

  // Check if there's an active phase
  const hasActivePhase = phase?.number || phase?.name

  // Use tasks data for progress - only show progress when we can actually read tasks.md
  // Don't fall back to state.orchestration.progress since it can be stale from a previous phase
  let progressData: { tasks_completed: number; tasks_total: number; percentage: number } | undefined
  if (tasksData && tasksData.totalCount > 0) {
    progressData = {
      tasks_completed: tasksData.completedCount,
      tasks_total: tasksData.totalCount,
      percentage: Math.round((tasksData.completedCount / tasksData.totalCount) * 100),
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Alerts */}
      {isStepFailed && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              Step Failed: {step?.current || 'Unknown'}
            </p>
            <p className="text-sm text-red-600 dark:text-red-300">
              Run <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">specflow check --fix</code> for recovery options
            </p>
          </div>
        </div>
      )}

      {isStaleState && !isStepFailed && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Possibly Stale: {step?.current || 'Unknown'}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-300">
              Step shows in_progress but hasn&apos;t updated recently. Run <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">specflow check --fix</code> to reset.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Workflow Status Card */}
      <WorkflowStatusCard
        execution={workflowExecution ?? null}
        isStarting={isStartingWorkflow}
        isCancelling={isCancellingWorkflow}
        onStart={onWorkflowStart}
        onCancel={onWorkflowCancel}
      />

      {/* Phase Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Current Phase
          </CardTitle>
        </CardHeader>
        <CardContent>
          {phase ? (
            <>
              <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                {phase.name || "Unknown"}
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Phase {phase.id || phase.name}
                {phase.status && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {phase.status}
                  </span>
                )}
              </div>
              {step?.current && (
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 flex items-center gap-2">
                  Step: {step.current}
                  {step.status === 'in_progress' && !isStaleState && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Running
                    </span>
                  )}
                  {step.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <XCircle className="h-3 w-3" />
                      Failed
                    </span>
                  )}
                  {step.status === 'complete' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Complete
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-neutral-500 dark:text-neutral-400">No active phase</div>
          )}
        </CardContent>
      </Card>

      {/* Health Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <HealthIcon status={health?.status ?? undefined} />
            Health Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
            {health?.status || "Unknown"}
          </div>
          {health?.last_check && (
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Last check: {new Date(health.last_check).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Task Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {progressData ? (
            <>
              <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                {progressData.tasks_completed} / {progressData.tasks_total}
              </div>
              <div className="mt-2">
                <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${progressData.percentage}%` }}
                  />
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {progressData.percentage}% complete
                </div>
              </div>
              {/* Working tasks indicator */}
              {(workingTasksCount > 0 || currentTasksFromState > 0) && (
                <div className="mt-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {workingTasksCount || currentTasksFromState} task{(workingTasksCount || currentTasksFromState) !== 1 ? 's' : ''} in progress
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-neutral-500 dark:text-neutral-400">No tasks tracked</div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Project Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">Path</dt>
              <dd className="font-mono text-xs text-neutral-900 dark:text-neutral-100 truncate">
                {project.path}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">Registered</dt>
              <dd className="text-neutral-900 dark:text-neutral-100">
                {new Date(project.registered_at).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">Project ID</dt>
              <dd className="font-mono text-xs text-neutral-600 dark:text-neutral-400 truncate">
                {project.id}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

function HealthIcon({ status }: { status?: string }) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Activity className="h-4 w-4" />
  }
}
