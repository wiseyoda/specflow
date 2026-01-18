"use client"

import { KanbanColumn } from "./kanban-column"
import { FileText, CircleDashed } from "lucide-react"
import type { TasksData, OrchestrationState } from "@specflow/shared"
import { groupTasksByStatus } from "@/lib/task-parser"

interface KanbanViewProps {
  tasksData?: TasksData | null
  state?: OrchestrationState | null
}

export function KanbanView({ tasksData, state }: KanbanViewProps) {
  // Check if there's no active phase (phase.number and phase.name are null)
  const hasActivePhase = state?.orchestration?.phase?.number || state?.orchestration?.phase?.name

  if (!tasksData || tasksData.tasks.length === 0) {
    // Show different message based on whether there's an active phase
    if (!hasActivePhase) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CircleDashed className="h-12 w-12 text-neutral-400 mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            No Active Phase
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
            Start a phase to see tasks in the Kanban view.
            Run <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">specflow phase open</code> to begin.
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-neutral-400 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          No Tasks Found
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          This phase doesn&apos;t have a tasks.md file yet.
          Run <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">/flow.design</code> to generate tasks.
        </p>
      </div>
    )
  }

  const grouped = groupTasksByStatus(tasksData.tasks)

  return (
    <div className="h-full">
      {/* Summary Bar */}
      <div className="flex items-center justify-between mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        <span>
          {tasksData.completedCount} of {tasksData.totalCount} tasks completed
        </span>
        <span className="text-xs">
          Last updated: {new Date(tasksData.lastUpdated).toLocaleTimeString()}
        </span>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "400px" }}>
        <KanbanColumn
          title="To Do"
          tasks={grouped.todo}
          variant="todo"
        />
        <KanbanColumn
          title="In Progress"
          tasks={grouped.in_progress}
          variant="in_progress"
        />
        <KanbanColumn
          title="Done"
          tasks={grouped.done}
          variant="done"
        />
      </div>
    </div>
  )
}
