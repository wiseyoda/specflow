"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
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
import { useWorkflowExecution } from "@/hooks/use-workflow-execution"
import { AlertCircle } from "lucide-react"
import { toastWorkflowCancelled, toastWorkflowError } from "@/lib/toast-helpers"
import type { ProjectStatus } from "@/lib/action-definitions"
import type { OrchestrationState } from "@specflow/shared"
import type { WorkflowSkill } from "@/lib/workflow-skills"

/**
 * Determine project status from orchestration state
 */
function getProjectStatus(state: OrchestrationState | null | undefined): ProjectStatus {
  if (!state) return "not_initialized"
  if (state.health?.status === "error") return "error"
  if (state.health?.status === "warning") return "warning"
  if (state.health?.status === "initializing") return "initializing"
  if (state.orchestration) return "ready"
  return "needs_setup"
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const { states, tasks, setSelectedProject } = useConnection()
  const { projects, loading: projectsLoading } = useProjects()
  const [activeView, setActiveView] = useViewPreference(projectId)

  // Workflow execution state
  const {
    execution: workflowExecution,
    start: startWorkflow,
    cancel: cancelWorkflow,
  } = useWorkflowExecution(projectId)
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [isCancellingWorkflow, setIsCancellingWorkflow] = useState(false)

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

  // Derive project status for actions menu (must be before early returns)
  const projectStatus = useMemo(() => getProjectStatus(state), [state])

  // Workflow handlers
  const handleWorkflowStart = useCallback(async (skill: string) => {
    setIsStartingWorkflow(true)
    try {
      await startWorkflow(skill)
    } finally {
      setIsStartingWorkflow(false)
    }
  }, [startWorkflow])

  const handleWorkflowCancel = useCallback(async () => {
    setIsCancellingWorkflow(true)
    try {
      await cancelWorkflow()
      toastWorkflowCancelled()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toastWorkflowError(message)
    } finally {
      setIsCancellingWorkflow(false)
    }
  }, [cancelWorkflow])

  const handleWorkflowStartFromCard = useCallback((skill: WorkflowSkill) => {
    handleWorkflowStart(skill.command)
  }, [handleWorkflowStart])

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
        <ProjectDetailHeader
          project={project}
          projectStatus={projectStatus}
          schemaVersion={state?.schema_version}
          isAvailable={!project.isUnavailable}
          workflowExecution={workflowExecution}
          isStartingWorkflow={isStartingWorkflow}
          onWorkflowStart={handleWorkflowStart}
        />

        <ViewTabs activeView={activeView} onViewChange={setActiveView} />

        <div className="flex-1 overflow-auto p-6">
          {activeView === "status" && (
            <StatusView
              project={project}
              state={state}
              tasksData={projectTasks}
              workflowExecution={workflowExecution}
              isStartingWorkflow={isStartingWorkflow}
              isCancellingWorkflow={isCancellingWorkflow}
              onWorkflowStart={handleWorkflowStartFromCard}
              onWorkflowCancel={handleWorkflowCancel}
            />
          )}
          {activeView === "kanban" && (
            <KanbanView tasksData={projectTasks} state={state} />
          )}
          {activeView === "timeline" && (
            <TimelineView project={project} state={state} />
          )}
        </div>
      </div>
    </MainLayout>
  )
}
