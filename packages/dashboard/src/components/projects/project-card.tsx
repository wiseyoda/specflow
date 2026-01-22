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
import type { OrchestrationState, TasksData } from '@specflow/shared'
import type { ProjectStatus as ActionProjectStatus } from '@/lib/action-definitions'
import type { WorkflowExecution } from '@/lib/services/workflow-service'
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
  /** Active workflow execution for this project */
  workflowExecution?: WorkflowExecution | null
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
 * Check if activity is recent (within last 15 minutes)
 */
function isRecentActivity(isoString: string | null | undefined): boolean {
  if (!isoString) return false
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return diffMs < 15 * 60 * 1000 // 15 minutes
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
  execution: WorkflowExecution | null | undefined
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
  const step = state?.orchestration?.step
  const health = state?.health

  const lastUpdated = getMostRecentTimestamp(state?.last_updated, state?._fileMtime)
  const isActive = isRecentActivity(lastUpdated)
  const phaseComplete = isPhaseComplete(phase?.status)

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

  // Ready to merge - phase is complete AND verify step is done
  const isReadyToMerge =
    phase?.status === 'complete' ||
    (allTasksComplete && step?.status === 'complete' && step?.current === 'verify')

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
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface-100 animate-pulse" />
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
              <StatusPill status={workflowPillStatus} size="sm" />
            )}
            {orchestrationBadge && (
              <span className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded',
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
                  <span className="text-xs text-zinc-500 truncate">
                    {phase?.name?.replace(/-/g, ' ') || 'Unknown phase'}
                  </span>
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
                    <>
                      <span className="text-zinc-600">→</span>
                      <span className="text-xs text-zinc-500 truncate">
                        {nextPhase.name.replace(/-/g, ' ')}
                      </span>
                    </>
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
            <StatusButton
              projectId={project.id}
              projectPath={project.path}
              projectStatus={projectStatus as ActionProjectStatus}
              isAvailable={!isUnavailable}
            />
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

          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
