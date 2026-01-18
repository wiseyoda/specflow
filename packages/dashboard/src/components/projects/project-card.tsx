"use client"

import Link from "next/link"
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
  GitMerge
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ActionButton, StatusButton } from "@/components/projects/action-button"
import { cn } from "@/lib/utils"
import type { OrchestrationState, TasksData } from "@specflow/shared"
import type { ProjectStatus as ActionProjectStatus } from "@/lib/action-definitions"

/**
 * Project initialization status
 */
type ProjectStatus =
  | "not_initialized"  // No .specify/ or no orchestration-state.json
  | "initializing"     // Has state but health.status is "initializing"
  | "needs_setup"      // Has state but no orchestration object
  | "ready"            // Has state with orchestration, health is good
  | "warning"          // Has state but health status is warning
  | "error"            // Has state but health status is error

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
}

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return ""

  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/**
 * Check if activity is recent (within last 15 minutes)
 * This reflects typical work sessions - being in a step for 15+ min is normal
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
 * Get step status styling based on step name
 */
function getStepStyles(step: string | null | undefined): string {
  if (!step) return "text-neutral-500 dark:text-neutral-400"

  const normalizedStep = step.toLowerCase()

  if (normalizedStep === "complete" || normalizedStep === "completed") {
    // Complete is done - green
    return "text-green-600 dark:text-green-400"
  }

  if (normalizedStep === "verify") {
    // Verify needs attention - amber
    return "text-amber-600 dark:text-amber-400"
  }

  if (normalizedStep === "implement" || normalizedStep === "implementing") {
    return "text-blue-600 dark:text-blue-400"
  }

  // Default for other steps (discover, specify, plan, etc.)
  return "text-neutral-500 dark:text-neutral-400"
}

/**
 * Check if phase is complete
 */
function isPhaseComplete(phaseStatus: string | null | undefined): boolean {
  if (!phaseStatus) return false
  const normalized = phaseStatus.toLowerCase()
  return normalized === "complete" || normalized === "completed"
}

/**
 * Determine overall project status based on state
 */
function getProjectStatus(state: OrchestrationState | null | undefined): ProjectStatus {
  // No state file at all
  if (!state) {
    return "not_initialized"
  }

  // Has state but health is error
  if (state.health?.status === "error") {
    return "error"
  }

  // Has state but health has warnings
  if (state.health?.status === "warning") {
    return "warning"
  }

  // Has state but still initializing (setup in progress)
  if (state.health?.status === "initializing") {
    return "initializing"
  }

  // Has orchestration object at all - means it's been set up
  // Even if phase is empty/null, the project has been initialized
  if (state.orchestration) {
    // Has phase info - definitely ready
    const phase = state.orchestration.phase
    if (phase?.number || phase?.name) {
      return "ready"
    }
    // Has orchestration but no current phase - could be between phases or just starting
    // Still consider it "ready" since the project is initialized
    return "ready"
  }

  // Has state file but no orchestration object - needs setup
  return "needs_setup"
}

/**
 * Get status badge configuration
 */
function getStatusBadge(status: ProjectStatus): {
  label: string
  icon: typeof CircleDashed
  className: string
  description: string
} {
  switch (status) {
    case "not_initialized":
      return {
        label: "Not Initialized",
        icon: CircleDashed,
        className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
        description: "Run specflow init to set up"
      }
    case "initializing":
      return {
        label: "Initializing",
        icon: Settings2,
        className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        description: "Setup in progress..."
      }
    case "needs_setup":
      return {
        label: "Needs Setup",
        icon: Settings2,
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        description: "Run discovery or create roadmap"
      }
    case "error":
      return {
        label: "Error",
        icon: XCircle,
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        description: "Run specflow doctor to diagnose"
      }
    case "ready":
    default:
      return {
        label: "Ready",
        icon: CheckCircle2,
        className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        description: "Project is set up and ready"
      }
  }
}

export function ProjectCard({ project, state, tasks, isUnavailable = false }: ProjectCardProps) {
  const phase = state?.orchestration?.phase
  const nextPhase = state?.orchestration?.next_phase
  const step = state?.orchestration?.step
  const health = state?.health

  // Use the most recent of: last_updated field OR file modification time
  // _fileMtime is more reliable as it reflects any file write
  const lastUpdated = getMostRecentTimestamp(state?.last_updated, state?._fileMtime)

  const isActive = isRecentActivity(lastUpdated)
  const phaseComplete = isPhaseComplete(phase?.status)

  // Health status
  const hasHealthWarning = health?.status === "warning"
  const healthStatus = health?.status

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

  // Ready to merge: either state says so, or all tasks are complete
  const isReadyToMerge = phase?.status === 'ready_to_merge' || allTasksComplete

  return (
    <Link href={`/projects/${project.id}`}>
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50",
          isUnavailable && "opacity-60"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <FolderGit2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {project.name}
                </h3>
                {isUnavailable && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                    <AlertCircle className="h-3 w-3" />
                    Unavailable
                  </span>
                )}
              </div>
              {projectStatus === "ready" ? (
                <div className="flex items-center gap-2 mt-0.5">
                  {(phase?.number || phase?.name) ? (
                    <>
                      <span className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded",
                        phaseComplete
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      )}>
                        {phase?.number || "—"}
                      </span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-300 truncate">
                        {phase?.name?.replace(/-/g, " ") || "Unknown phase"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready to start
                      </span>
                      {nextPhase?.number && (
                        <>
                          <span className="text-neutral-400">→</span>
                          <span className={cn(
                            "text-xs font-medium px-1.5 py-0.5 rounded",
                            "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                          )}>
                            {nextPhase.number}
                          </span>
                          <span className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                            {nextPhase.name?.replace(/-/g, " ")}
                          </span>
                        </>
                      )}
                    </>
                  )}
                  {phaseComplete ? (
                    <>
                      <span className="text-neutral-400">·</span>
                      <span className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        COMPLETE
                      </span>
                    </>
                  ) : isReadyToMerge ? (
                    <>
                      <span className="text-neutral-400">·</span>
                      <span className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1">
                        <GitMerge className="h-3 w-3" />
                        READY TO MERGE
                      </span>
                    </>
                  ) : step?.current && (
                    <>
                      <span className="text-neutral-400">·</span>
                      <span className={cn(
                        "text-xs uppercase tracking-wide font-medium",
                        getStepStyles(step.current)
                      )}>
                        {step.current}
                      </span>
                    </>
                  )}
                  {hasHealthWarning && (
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded",
                    statusBadge.className
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {statusBadge.label}
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                    {statusBadge.description}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Task progress bar */}
              {hasTasks && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        progressPercent === 100
                          ? "bg-green-500"
                          : progressPercent > 50
                            ? "bg-blue-500"
                            : "bg-amber-500"
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {completedTasks}/{totalTasks}
                  </span>
                </div>
              )}
              {lastUpdated && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  phaseComplete
                    ? "text-green-600 dark:text-green-400"
                    : "text-neutral-400"
                )}>
                  {phaseComplete ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  <span>
                    {phaseComplete ? "Completed " : ""}{formatRelativeTime(lastUpdated)}
                  </span>
                </div>
              )}
              <StatusButton
                projectId={project.id}
                projectPath={project.path}
                projectStatus={projectStatus as ActionProjectStatus}
                isAvailable={!isUnavailable}
              />
              <ActionButton
                projectId={project.id}
                projectPath={project.path}
                projectStatus={projectStatus as ActionProjectStatus}
                isAvailable={!isUnavailable}
                schemaVersion={state?.schema_version}
              />
              <ChevronRight className="h-5 w-5 text-neutral-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
