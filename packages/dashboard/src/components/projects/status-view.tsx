"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, FileText, FolderOpen } from "lucide-react"
import type { OrchestrationState, TasksData } from "@speckit/shared"

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
}

export function StatusView({ project, state, tasksData }: StatusViewProps) {
  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-neutral-400 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          No Orchestration State
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          This project doesn&apos;t have an orchestration state file yet.
          Run <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">speckit init</code> in the project directory.
        </p>
      </div>
    )
  }

  const phase = state.orchestration?.phase
  const health = state.health

  // Use tasks data for progress if available, fall back to state file
  let progressData: { tasks_completed: number; tasks_total: number; percentage: number } | undefined
  if (tasksData && tasksData.totalCount > 0) {
    progressData = {
      tasks_completed: tasksData.completedCount,
      tasks_total: tasksData.totalCount,
      percentage: Math.round((tasksData.completedCount / tasksData.totalCount) * 100),
    }
  } else {
    const stateProgress = (state as Record<string, unknown>).orchestration as Record<string, unknown> | undefined
    const stateProgressData = stateProgress?.progress as { tasks_completed?: number; tasks_total?: number; percentage?: number } | undefined
    if (stateProgressData && stateProgressData.tasks_total && stateProgressData.tasks_total > 0) {
      progressData = {
        tasks_completed: stateProgressData.tasks_completed || 0,
        tasks_total: stateProgressData.tasks_total,
        percentage: stateProgressData.percentage || 0,
      }
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {state.orchestration?.step?.current && (
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                  Step: {state.orchestration.step.current}
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
