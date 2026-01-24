'use client'

import { useMemo, useCallback } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { useConnection } from '@/contexts/connection-context'
import { useProjectPhases } from '@/hooks/use-project-phases'
import { ProjectCard } from './project-card'
import { EmptyState } from './empty-state'
import { GlassCard } from '@/components/design-system'
import { AlertCircle, RefreshCw, FolderGit2 } from 'lucide-react'
import {
  toastWorkflowStarted,
  toastWorkflowError,
  toastWorkflowAlreadyRunning,
} from '@/lib/toast-helpers'

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
function getMostRecentTimestamp(...timestamps: (string | null | undefined)[]): Date | null {
  const validDates = timestamps
    .filter((ts): ts is string => !!ts)
    .map((ts) => new Date(ts))
    .filter((date) => !isNaN(date.getTime()))

  if (validDates.length === 0) return null

  return validDates.reduce((latest, current) =>
    current > latest ? current : latest
  )
}

export function ProjectList() {
  const { projects, loading, error, refetch } = useProjects()
  const { states, tasks, workflows, refetch: refreshWorkflows } = useConnection()

  // Fetch phase info for all projects (next phase from roadmap)
  const { phases: projectPhases } = useProjectPhases(projects)

  // Create workflow start handler for a specific project
  const createWorkflowStartHandler = useCallback(
    (projectId: string) => {
      return async (skill: string) => {
        try {
          const res = await fetch('/api/workflow/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, skill }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            if (data.error?.includes('already running')) {
              toastWorkflowAlreadyRunning()
            } else {
              throw new Error(data.error || `Failed: ${res.status}`)
            }
            return
          }
          toastWorkflowStarted(skill)
          // Refresh workflow list to show the new execution
          refreshWorkflows()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          toastWorkflowError(message)
          throw error
        }
      }
    },
    [refreshWorkflows]
  )

  // Sort projects: active first, then by most recent activity
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const stateA = states.get(a.id)
      const stateB = states.get(b.id)

      const lastUpdatedA = getMostRecentTimestamp(stateA?.last_updated, stateA?._fileMtime)
      const lastUpdatedB = getMostRecentTimestamp(stateB?.last_updated, stateB?._fileMtime)

      const isActiveA = isRecentActivity(lastUpdatedA?.toISOString())
      const isActiveB = isRecentActivity(lastUpdatedB?.toISOString())

      // Active projects first
      if (isActiveA && !isActiveB) return -1
      if (!isActiveA && isActiveB) return 1

      // Then by most recent activity
      if (lastUpdatedA && lastUpdatedB) {
        return lastUpdatedB.getTime() - lastUpdatedA.getTime()
      }
      if (lastUpdatedA) return -1
      if (lastUpdatedB) return 1

      // Fall back to alphabetical
      return a.name.localeCompare(b.name)
    })
  }, [projects, states])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} className="p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-300" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-surface-300" />
                <div className="h-3 w-48 rounded bg-surface-300" />
              </div>
              <div className="w-20 h-1.5 rounded bg-surface-300" />
            </div>
          </GlassCard>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/20 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-danger" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Unable to load projects</h3>
        <p className="text-sm text-surface-400 max-w-sm mb-2">{error.message}</p>
        <p className="text-sm text-surface-500 mb-4">
          Try running{' '}
          <code className="px-1.5 py-0.5 bg-surface-200 rounded text-xs font-mono text-accent-light">
            specflow status
          </code>{' '}
          to check for issues.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center mb-4">
          <FolderGit2 className="h-8 w-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
        <p className="text-sm text-surface-400 max-w-sm">
          Register a project to get started. Run{' '}
          <code className="px-1.5 py-0.5 bg-surface-200 rounded text-xs font-mono text-accent-light">
            specflow init
          </code>{' '}
          in your project directory.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortedProjects.map((project) => {
        const phaseInfo = projectPhases.get(project.id)
        return (
          <ProjectCard
            key={project.id}
            project={project}
            state={states.get(project.id)}
            tasks={tasks.get(project.id)}
            isUnavailable={project.isUnavailable}
            isDiscovered={project.isDiscovered}
            workflowExecution={workflows.get(project.id)?.currentExecution}
            onWorkflowStart={createWorkflowStartHandler(project.id)}
            nextPhase={phaseInfo?.nextPhase}
          />
        )
      })}
    </div>
  )
}
