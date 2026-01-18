"use client"

import { KanbanColumn } from "./kanban-column"
import { FileText } from "lucide-react"
import type { TasksData } from "@specflow/shared"
import { groupTasksByStatus } from "@/lib/task-parser"

interface KanbanViewProps {
  tasksData?: TasksData | null
}

export function KanbanView({ tasksData }: KanbanViewProps) {
  if (!tasksData || tasksData.tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-neutral-400 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          No Tasks Found
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          This project doesn&apos;t have a tasks.md file yet.
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
