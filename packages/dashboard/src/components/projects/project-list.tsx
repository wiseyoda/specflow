"use client"

import { useMemo } from "react"
import { useProjects } from "@/hooks/use-projects"
import { useConnection } from "@/contexts/connection-context"
import { ProjectCard } from "./project-card"
import { EmptyState } from "./empty-state"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  const { states, tasks } = useConnection()

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
          <div
            key={i}
            className="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Unable to load projects
        </h3>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
          {error.message}
        </p>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Try running <code className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">specflow doctor</code> to fix issues.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  if (projects.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-3">
      {sortedProjects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          state={states.get(project.id)}
          tasks={tasks.get(project.id)}
          isUnavailable={project.isUnavailable}
        />
      ))}
    </div>
  )
}
