"use client"

import { TaskCard } from "./task-card"
import type { Task } from "@specflow/shared"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  title: string
  tasks: Task[]
  variant: "todo" | "in_progress" | "done"
}

const variantStyles = {
  todo: {
    header: "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
    container: "bg-neutral-50 dark:bg-neutral-800/50",
  },
  in_progress: {
    header: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    container: "bg-blue-50 dark:bg-blue-900/20",
  },
  done: {
    header: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    container: "bg-green-50 dark:bg-green-900/20",
  },
}

export function KanbanColumn({ title, tasks, variant }: KanbanColumnProps) {
  const styles = variantStyles[variant]

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 rounded-t-lg",
        styles.header
      )}>
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs font-mono">{tasks.length}</span>
      </div>

      {/* Column Body */}
      <div className={cn(
        "flex-1 p-2 space-y-2 rounded-b-lg overflow-y-auto",
        styles.container
      )}>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  )
}
