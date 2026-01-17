"use client"

import { usePolling } from "@/hooks/use-polling"
import { ProjectCard } from "./project-card"
import { EmptyState } from "./empty-state"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Project {
  id: string
  name: string
  path: string
  registered_at: string
  last_seen?: string
  isUnavailable?: boolean
}

interface ProjectsResponse {
  projects: Project[]
  empty?: boolean
  error?: string
  code?: string
}

export function ProjectList() {
  const { data, loading, error, refetch } = usePolling<ProjectsResponse>(
    '/api/projects',
    5000
  )

  if (loading && !data) {
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

  if (error || data?.error) {
    const errorMessage = data?.error || error?.message || 'Unknown error'
    const isRegistryError = data?.code === 'INVALID_REGISTRY'

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Unable to load projects
        </h3>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
          {errorMessage}
        </p>
        {isRegistryError && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Try running <code className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">speckit doctor</code> to fix issues.
          </p>
        )}
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

  if (data?.empty || data?.projects.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-3">
      {data?.projects.map((project) => (
        <ProjectCard key={project.id} project={project} isUnavailable={project.isUnavailable} />
      ))}
    </div>
  )
}
