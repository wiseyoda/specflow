"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Circle, Loader2, FileCode, GitBranch } from "lucide-react"
import type { Task } from "@specflow/shared"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <Card className="bg-white dark:bg-neutral-900 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <TaskStatusIcon status={task.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                {task.id}
              </span>
              {task.isParallel && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  P
                </span>
              )}
              {task.userStory && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {task.userStory}
                </span>
              )}
            </div>
            <p className={cn(
              "text-sm mt-1 text-neutral-900 dark:text-neutral-100",
              task.status === "done" && "line-through text-neutral-500 dark:text-neutral-400"
            )}>
              {task.description}
            </p>
            {task.filePath && (
              <div className="flex items-center gap-1 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                <FileCode className="h-3 w-3" />
                <code className="truncate max-w-[200px]">{task.filePath}</code>
              </div>
            )}
            {task.phase && (
              <div className="flex items-center gap-1 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                <GitBranch className="h-3 w-3" />
                <span className="truncate">{task.phase}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />
    default:
      return <Circle className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" />
  }
}
