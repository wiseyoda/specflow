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
} from 'lucide-react'
import { GlassCard, StatusPill } from '@/components/design-system'
import type { WorkflowStatus } from '@/components/design-system/status-pill'
import { StatusButton } from '@/components/projects/action-button'
import { ActionsMenu } from '@/components/projects/actions-menu'
import { cn } from '@/lib/utils'
import type { OrchestrationState, TasksData } from '@specflow/shared'
import type { ProjectStatus as ActionProjectStatus } from '@/lib/action-definitions'
import type { WorkflowExecution } from '@/lib/services/workflow-service'

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
  /** Callback to start a workflow */
  onWorkflowStart?: (skill: string) => Promise<void>
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

export function ProjectCard({
  project,
  state,
  tasks,
  isUnavailable = false,
  isDiscovered = false,
  workflowExecution,
  onWorkflowStart,
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

  // Ready to merge
  const isReadyToMerge =
    phase?.status === 'ready_to_merge' ||
    phase?.status === 'verified' ||
    (allTasksComplete && step?.status === 'complete' && step?.current === 'verify')

  // Branch name
  const branchName = phase?.branch ?? 'main'

  return (
    <Link href={`/projects/${project.id}`}>
      <GlassCard
        className={cn(
          'p-4 transition-all hover:bg-surface-200/50 hover:border-surface-300',
          isUnavailable && 'opacity-60',
          isDiscovered && 'opacity-50 border-dashed'
        )}
      >
        <div className="flex items-center gap-4">
          {/* Project icon with activity indicator */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-surface-200 flex items-center justify-center">
              <FolderGit2 className="h-5 w-5 text-surface-400" />
            </div>
            {isActive && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success animate-glow-pulse" />
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Project name row */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white truncate">{project.name}</h3>

              {/* Workflow status pill - only show when active */}
              {workflowPillStatus !== 'idle' && (
                <StatusPill status={workflowPillStatus} size="sm" />
              )}

              {isUnavailable && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-warning/20 text-warning rounded">
                  <AlertCircle className="h-3 w-3" />
                  Unavailable
                </span>
              )}
            </div>

            {/* Phase/Status row */}
            {projectStatus === 'ready' ? (
              <div className="flex items-center gap-2 text-sm">
                {phase?.number || phase?.name ? (
                  <>
                    <span
                      className={cn(
                        'text-xs font-mono px-1.5 py-0.5 rounded',
                        phaseComplete
                          ? 'bg-success/20 text-success'
                          : 'bg-accent/20 text-accent-light'
                      )}
                    >
                      {phase?.number || '—'}
                    </span>
                    <span className="text-surface-400 truncate">
                      {phase?.name?.replace(/-/g, ' ') || 'Unknown phase'}
                    </span>

                    {/* Progress percentage */}
                    {hasTasks && (
                      <>
                        <span className="text-surface-500">•</span>
                        <span className="text-surface-500 tabular-nums">
                          {Math.round(progressPercent)}%
                        </span>
                      </>
                    )}

                    {/* Status indicators */}
                    {phaseComplete ? (
                      <>
                        <span className="text-surface-500">•</span>
                        <span className="text-xs text-success uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Complete
                        </span>
                      </>
                    ) : isReadyToMerge ? (
                      <>
                        <span className="text-surface-500">•</span>
                        <span className="text-xs text-accent uppercase tracking-wide flex items-center gap-1">
                          <GitMerge className="h-3 w-3" />
                          Ready to merge
                        </span>
                      </>
                    ) : (
                      step?.current && (
                        <>
                          <span className="text-surface-500">•</span>
                          <span className="text-xs text-surface-400 uppercase tracking-wide">
                            {step.current}
                          </span>
                        </>
                      )
                    )}

                    {hasHealthWarning && (
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/20 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready to start
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
                    statusBadge.className
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusBadge.label}
                </span>
              </div>
            )}

            {/* Branch row */}
            <div className="flex items-center gap-2 mt-1 text-xs text-surface-500">
              <GitBranch className="h-3 w-3" />
              <span className="truncate">{branchName}</span>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Task progress bar */}
            {hasTasks && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      progressPercent === 100
                        ? 'bg-success'
                        : progressPercent > 50
                          ? 'bg-accent'
                          : 'bg-warning'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-surface-500 tabular-nums">
                  {completedTasks}/{totalTasks}
                </span>
              </div>
            )}

            {/* Last updated */}
            {lastUpdated && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  phaseComplete ? 'text-success' : 'text-surface-500'
                )}
              >
                {phaseComplete ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                <span>{formatRelativeTime(lastUpdated)}</span>
              </div>
            )}

            <StatusButton
              projectId={project.id}
              projectPath={project.path}
              projectStatus={projectStatus as ActionProjectStatus}
              isAvailable={!isUnavailable}
            />

            <div onClick={(e) => e.preventDefault()}>
              <ActionsMenu
                projectId={project.id}
                projectName={project.name}
                projectPath={project.path}
                projectStatus={projectStatus as ActionProjectStatus}
                schemaVersion={state?.schema_version}
                isAvailable={!isUnavailable}
                hasActiveWorkflow={hasActiveWorkflow}
                onWorkflowStart={onWorkflowStart}
              />
            </div>

            <ChevronRight className="h-5 w-5 text-surface-500" />
          </div>
        </div>
      </GlassCard>
    </Link>
  )
}
