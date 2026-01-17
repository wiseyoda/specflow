"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { ProjectDetailHeader } from "@/components/projects/project-detail-header"
import { ViewTabs } from "@/components/projects/view-tabs"
import { StatusView } from "@/components/projects/status-view"
import { KanbanView } from "@/components/projects/kanban-view"
import { TimelineView } from "@/components/projects/timeline-view"
import { useConnection } from "@/contexts/connection-context"
import { useProjects } from "@/hooks/use-projects"
import { useViewPreference } from "@/hooks/use-view-preference"
import { AlertCircle } from "lucide-react"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const { states, tasks, setSelectedProject } = useConnection()
  const { projects, loading: projectsLoading } = useProjects()
  const [activeView, setActiveView] = useViewPreference(projectId)

  // Find project in list
  const project = projects.find((p) => p.id === projectId)

  // Set selected project for command palette context
  useEffect(() => {
    if (project) {
      setSelectedProject(project)
    }
    return () => setSelectedProject(null)
  }, [project, setSelectedProject])

  // Get orchestration state for this project
  const state = states.get(projectId)

  // Get tasks for this project
  const projectTasks = tasks.get(projectId)

  // Loading state
  if (projectsLoading) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          {/* Header skeleton */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
            <div className="animate-pulse space-y-2">
              <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="px-6 py-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="animate-pulse flex gap-2">
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="flex-1 p-6">
            <div className="animate-pulse grid grid-cols-2 gap-4">
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  // Project not found
  if (!project) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-neutral-400 mb-4" />
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Project Not Found
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              The project with ID &quot;{projectId}&quot; could not be found.
            </p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to project list
            </button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <ProjectDetailHeader project={project} />

        <ViewTabs activeView={activeView} onViewChange={setActiveView} />

        <div className="flex-1 overflow-auto p-6">
          {activeView === "status" && (
            <StatusView project={project} state={state} tasksData={projectTasks} />
          )}
          {activeView === "kanban" && (
            <KanbanView tasksData={projectTasks} />
          )}
          {activeView === "timeline" && (
            <TimelineView project={project} state={state} />
          )}
        </div>
      </div>
    </MainLayout>
  )
}
