'use client'

import Link from 'next/link'
import {
  FolderGit2,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle2,
  CircleDashed,
  Settings2,
  XCircle,
  GitMerge,
  GitBranch,
  Layers,
  Loader2,
  Wrench,
  HelpCircle,
} from 'lucide-react'
import { GlassCard, StatusPill } from '@/components/design-system'
import type { WorkflowStatus } from '@/components/design-system/status-pill'
import { StatusButton } from '@/components/projects/action-button'
import { ActionsMenu } from '@/components/projects/actions-menu'
import { cn } from '@/lib/utils'
import type { OrchestrationState, TasksData, WorkflowIndexEntry } from '@specflow/shared'
import type { ProjectStatus as ActionProjectStatus } from '@/lib/action-definitions'
import type { OrchestrationExecution } from '@specflow/shared'

/**
 * Project initialization status
 */
type ProjectStatus =
  | 'not_initialized' // No .specflow/ or no orchestration-state.json
  | 'initializing' // Has state but health.status is "initializing"
  | 'needs_setup' // Has state but no orchestration object
  | 'ready' // Has state with orchestration, health is good
  | 'warning' // Has state but health status is warning
  | 'error' // Has state but health status is error

interface Project {
  id: string
  name: string
  path: string
  registered_at: string
  last_seen?: string
}

interface ProjectCardProps {
  project: Project
  state?: OrchestrationState | null
  tasks?: TasksData | null
  isUnavailable?: boolean
  isDiscovered?: boolean
  /** Active workflow execution for this project (from SSE) */
  workflowExecution?: WorkflowIndexEntry | null
  /** Active orchestration execution for this project */
  activeOrchestration?: OrchestrationExecution | null
  /** Callback to start a workflow */
  onWorkflowStart?: (skill: string) => Promise<void>
  /** Next phase from roadmap (when no active phase) */
  nextPhase?: { number: string; name: string } | null
}

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return ''

  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/**
 * Activity indicator state based on workflow/orchestration status
 */
type ActivityIndicator = 'running' | 'waiting' | 'merge' | 'error' | 'stale' | null

/**
 * Determine activity indicator based on workflow and orchestration state
 */
function getActivityIndicator(
  workflowExecution: WorkflowIndexEntry | null | undefined,
  activeOrchestration: OrchestrationExecution | null | undefined
): ActivityIndicator {
  const workflowStatus = workflowExecution?.status
  const orchestrationStatus = activeOrchestration?.status

  // Error state (workflow or orchestration failed)
  if (workflowStatus === 'failed' || orchestrationStatus === 'failed') {
    return 'error'
  }

  // Running state (actively executing)
  if (workflowStatus === 'running' || orchestrationStatus === 'running') {
    return 'running'
  }

  // Waiting for user input
  if (
    workflowStatus === 'waiting_for_input' ||
    orchestrationStatus === 'paused' ||
    orchestrationStatus === 'needs_attention'
  ) {
    return 'waiting'
  }

  // Ready to merge
  if (orchestrationStatus === 'waiting_merge') {
    return 'merge'
  }

  // Stale/detached (lost tracking)
  if (workflowStatus === 'stale' || workflowStatus === 'detached') {
    return 'stale'
  }

  // Idle (completed, cancelled, or no activity)
  return null
}

/**
 * Get activity indicator styles
 */
function getActivityIndicatorStyles(indicator: ActivityIndicator): {
  className: string
  animate: boolean
} | null {
  switch (indicator) {
    case 'running':
      return { className: 'bg-success', animate: true }
    case 'waiting':
      return { className: 'bg-amber-500', animate: false }
    case 'merge':
      return { className: 'bg-purple-500', animate: false }
    case 'error':
      return { className: 'bg-danger', animate: false }
    case 'stale':
      return { className: 'bg-zinc-500', animate: false }
    default:
      return null
  }
}

/**
 * Get the most recent timestamp from multiple sources
 */
function getMostRecentTimestamp(...timestamps: (string | null | undefined)[]): string | null {
  const validDates = timestamps
    .filter((ts): ts is string => !!ts)
    .map((ts) => ({ ts, date: new Date(ts) }))
    .filter(({ date }) => !isNaN(date.getTime()))

  if (validDates.length === 0) return null

  return validDates.reduce((latest, current) =>
    current.date > latest.date ? current : latest
  ).ts
}

/**
 * Get step badge styling based on step name
 * Steps: design → analyze → implement → verify → complete
 */
function getStepBadge(step: string | null | undefined): {
  label: string
  className: string
} | null {
  if (!step) return null

  const normalizedStep = step.toLowerCase()

  switch (normalizedStep) {
    case 'design':
      return { label: 'Design', className: 'bg-purple-500/15 text-purple-400' }
    case 'analyze':
      return { label: 'Analyze', className: 'bg-blue-500/15 text-blue-400' }
    case 'implement':
      return { label: 'Implement', className: 'bg-amber-500/15 text-amber-400' }
    case 'verify':
      return { label: 'Verify', className: 'bg-cyan-500/15 text-cyan-400' }
    case 'complete':
    case 'completed':
      return { label: 'Complete', className: 'bg-success/15 text-success' }
    default:
      return { label: step, className: 'bg-zinc-500/15 text-zinc-400' }
  }
}

/**
 * Check if phase is complete
 */
function isPhaseComplete(phaseStatus: string | null | undefined): boolean {
  if (!phaseStatus) return false
  const normalized = phaseStatus.toLowerCase()
  return normalized === 'complete' || normalized === 'completed'
}

/**
 * Determine overall project status based on state
 */
function getProjectStatus(state: OrchestrationState | null | undefined): ProjectStatus {
  if (!state) {
    return 'not_initialized'
  }

  if (state.health?.status === 'error') {
    return 'error'
  }

  if (state.health?.status === 'warning') {
    return 'warning'
  }

  // If there's active orchestration data, treat as ready even if health.status is "initializing"
  // (health.status can be stale while orchestration is actively in progress)
  if (state.orchestration?.phase?.number || state.orchestration?.step?.current) {
    return 'ready'
  }

  if (state.health?.status === 'initializing') {
    return 'initializing'
  }

  if (state.orchestration) {
    return 'ready'
  }

  return 'needs_setup'
}

/**
 * Get status badge configuration for non-ready states
 */
function getStatusBadge(status: ProjectStatus): {
  label: string
  icon: typeof CircleDashed
  className: string
} {
  switch (status) {
    case 'not_initialized':
      return {
        label: 'Not Initialized',
        icon: CircleDashed,
        className: 'bg-surface-300 text-surface-500',
      }
    case 'initializing':
      return {
        label: 'Initializing',
        icon: Settings2,
        className: 'bg-accent/20 text-accent-light',
      }
    case 'needs_setup':
      return {
        label: 'Needs Setup',
        icon: Settings2,
        className: 'bg-warning/20 text-warning',
      }
    case 'error':
      return {
        label: 'Error',
        icon: XCircle,
        className: 'bg-danger/20 text-danger',
      }
    case 'warning':
      return {
        label: 'Warning',
        icon: AlertTriangle,
        className: 'bg-warning/20 text-warning',
      }
    case 'ready':
    default:
      return {
        label: 'Ready',
        icon: CheckCircle2,
        className: 'bg-success/20 text-success',
      }
  }
}

/**
 * Map workflow execution status to StatusPill status
 */
function getWorkflowPillStatus(
  execution: WorkflowIndexEntry | null | undefined
): WorkflowStatus {
  if (!execution?.status) return 'idle'
  switch (execution.status) {
    case 'running':
      return 'running'
    case 'waiting_for_input':
      return 'waiting'
    case 'failed':
      return 'failed'
    default:
      return 'idle'
  }
}

/**
 * Get orchestration badge configuration
 */
function getOrchestrationBadge(orchestration: OrchestrationExecution | null | undefined): {
  label: string
  icon: typeof Loader2
  className: string
} | null {
  if (!orchestration) return null
  if (['completed', 'failed', 'cancelled'].includes(orchestration.status)) return null

  const { status, batches, currentPhase } = orchestration
  const batchInfo = currentPhase === 'implement'
    ? ` (${batches.current + 1}/${batches.total})`
    : ''

  switch (status) {
    case 'running':
      return {
        label: `Completing${batchInfo}`,
        icon: Loader2,
        className: 'bg-purple-500/20 text-purple-400',
      }
    case 'paused':
      return {
        label: 'Paused',
        icon: Clock,
        className: 'bg-amber-500/20 text-amber-400',
      }
    case 'waiting_merge':
      return {
        label: 'Merge Ready',
        icon: GitMerge,
        className: 'bg-blue-500/20 text-blue-400',
      }
    default:
      return null
  }
}

export function ProjectCard({
  project,
  state,
  tasks,
  isUnavailable = false,
  isDiscovered = false,
  workflowExecution,
  activeOrchestration,
  onWorkflowStart,
  nextPhase,
}: ProjectCardProps) {
  const phase = state?.orchestration?.phase
  const health = state?.health

  // Current step: prefer live orchestration data over stale state file
  const currentStep = activeOrchestration?.currentPhase ?? state?.orchestration?.step?.current

  // Last updated: prioritize workflow activity, then tasks, then state file
  const lastUpdated = getMostRecentTimestamp(
    workflowExecution?.updatedAt,
    workflowExecution?.startedAt,
    tasks?.lastUpdated,
    state?.last_updated,
    state?._fileMtime
  )
  const phaseComplete = isPhaseComplete(phase?.status)

  // Activity indicator based on workflow/orchestration state
  const activityIndicator = getActivityIndicator(workflowExecution, activeOrchestration)
  const activityStyles = getActivityIndicatorStyles(activityIndicator)

  // Workflow status handling
  const workflowPillStatus = getWorkflowPillStatus(workflowExecution)
  const hasActiveWorkflow =
    workflowExecution?.status === 'running' ||
    workflowExecution?.status === 'waiting_for_input'

  // Orchestration status
  const orchestrationBadge = getOrchestrationBadge(activeOrchestration)
  const hasActiveOrchestration = !!orchestrationBadge

  // Health status
  const hasHealthWarning = health?.status === 'warning'

  // Project status (4 states)
  const projectStatus = getProjectStatus(state)
  const statusBadge = getStatusBadge(projectStatus)
  const StatusIcon = statusBadge.icon

  // Task progress
  const totalTasks = tasks?.totalCount ?? 0
  const completedTasks = tasks?.completedCount ?? 0
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const hasTasks = totalTasks > 0
  const allTasksComplete = hasTasks && completedTasks === totalTasks

  // Ready to merge - orchestration says so, or phase complete, or all tasks done in verify
  const isReadyToMerge =
    activeOrchestration?.status === 'waiting_merge' ||
    phase?.status === 'complete' ||
    (allTasksComplete && currentStep === 'verify')

  // Branch name
  const branchName = phase?.branch ?? 'main'

  return (
    <Link href={`/projects/${project.id}`}>
      <div
        className={cn(
          'group relative flex items-center gap-4 px-4 py-3 rounded-xl',
          'bg-surface-100/80 border border-surface-300/40',
          'hover:bg-surface-200/60 hover:border-surface-300/60',
          'transition-all duration-200',
          isUnavailable && 'opacity-60',
          isDiscovered && 'opacity-50 border-dashed'
        )}
      >
        {/* Project icon with gradient and activity indicator */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br from-surface-200 to-surface-300/50',
              'group-hover:from-accent/10 group-hover:to-purple-500/10',
              'transition-all duration-200'
            )}
          >
            <FolderGit2
              className={cn(
                'h-5 w-5 text-surface-400',
                'group-hover:text-accent transition-colors'
              )}
            />
          </div>
          {activityStyles && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-100',
                activityStyles.className,
                activityStyles.animate && 'animate-pulse'
              )}
            />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Project name, branch, and workflow status */}
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-200 group-hover:text-white truncate transition-colors">
              {project.name}
            </h3>
            {branchName !== 'main' && (
              <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-200/50 text-[10px] text-zinc-500 max-w-40 truncate">
                <GitBranch className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{branchName}</span>
              </span>
            )}
            {workflowPillStatus !== 'idle' && !hasActiveOrchestration && (
              <span className="hidden sm:block">
                <StatusPill status={workflowPillStatus} size="sm" />
              </span>
            )}
            {orchestrationBadge && (
              <span className={cn(
                'hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded',
                orchestrationBadge.className
              )}>
                <orchestrationBadge.icon className={cn(
                  'h-2.5 w-2.5',
                  orchestrationBadge.icon === Loader2 && 'animate-spin'
                )} />
                {orchestrationBadge.label}
              </span>
            )}
            {isUnavailable && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-warning/15 text-warning rounded">
                <AlertCircle className="h-2.5 w-2.5" />
                Unavailable
              </span>
            )}
          </div>

          {/* Phase info row */}
          <div className="flex items-center gap-2 mt-1">
            {projectStatus === 'ready' ? (
              phase?.number || phase?.name ? (
                <>
                  <span
                    className={cn(
                      'text-[10px] font-mono px-1.5 py-0.5 rounded',
                      phaseComplete
                        ? 'bg-success/15 text-success'
                        : 'bg-accent/15 text-accent'
                    )}
                  >
                    {phase?.number || '—'}
                  </span>
                  <span className="hidden sm:inline text-xs text-zinc-500 truncate">
                    {phase?.name?.replace(/-/g, ' ') || 'Unknown phase'}
                  </span>
                  {/* Step indicator */}
                  {!phaseComplete && !isReadyToMerge && currentStep && (() => {
                    const stepBadge = getStepBadge(currentStep)
                    return stepBadge ? (
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide',
                        stepBadge.className
                      )}>
                        {stepBadge.label}
                      </span>
                    ) : null
                  })()}
                  {phaseComplete && (
                    <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                  )}
                  {isReadyToMerge && !phaseComplete && (
                    <GitMerge className="h-3 w-3 text-accent flex-shrink-0" />
                  )}
                  {hasHealthWarning && (
                    <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
                  )}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Ready
                  </span>
                  {nextPhase && (
                    <span className="hidden sm:flex items-center gap-2">
                      <span className="text-zinc-600">→</span>
                      <span className="text-xs text-zinc-500 truncate">
                        {nextPhase.name.replace(/-/g, ' ')}
                      </span>
                    </span>
                  )}
                </>
              )
            ) : (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded',
                  statusBadge.className
                )}
              >
                <StatusIcon className="h-2.5 w-2.5" />
                {statusBadge.label}
              </span>
            )}

          </div>
        </div>

        {/* Right side - progress, branch, and time */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Task progress */}
          {hasTasks && (
            <div className="hidden md:flex items-center gap-2">
              <div className="w-16 h-1 bg-surface-300/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    progressPercent === 100 ? 'bg-success' : 'bg-accent'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 tabular-nums w-8">
                {completedTasks}/{totalTasks}
              </span>
            </div>
          )}

          {/* Last updated */}
          {lastUpdated && (
            <span className="hidden sm:block text-[10px] text-zinc-600 tabular-nums">
              {formatRelativeTime(lastUpdated)}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
            <span className="hidden sm:block">
              <StatusButton
                projectId={project.id}
                projectPath={project.path}
                projectStatus={projectStatus as ActionProjectStatus}
                isAvailable={!isUnavailable}
              />
            </span>
            <ActionsMenu
              projectId={project.id}
              projectName={project.name}
              projectPath={project.path}
              projectStatus={projectStatus as ActionProjectStatus}
              phaseName={phase?.name ? `${phase.number}: ${phase.name}` : phase?.number ?? undefined}
              schemaVersion={state?.schema_version}
              isAvailable={!isUnavailable}
              hasActiveWorkflow={hasActiveWorkflow}
              onWorkflowStart={onWorkflowStart}
            />
          </div>

          <ChevronRight className="hidden sm:block h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
