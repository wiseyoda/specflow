"use client"

import { CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PhaseHistoryItem {
  type: string
  phase_number?: string | null
  phase_name?: string | null
  branch?: string | null
  completed_at?: string | null
  tasks_completed?: number | string | null
  tasks_total?: number | string | null
}

interface PhaseTimelineItemProps {
  phase: PhaseHistoryItem
  isLast?: boolean
  isCurrent?: boolean
}

export function PhaseTimelineItem({ phase, isLast = false, isCurrent = false }: PhaseTimelineItemProps) {
  const completedTasks = Number(phase.tasks_completed) || 0
  const totalTasks = Number(phase.tasks_total) || 0
  const hasTaskData = totalTasks > 0

  return (
    <div className="relative flex gap-4">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-700" />
      )}

      {/* Status Icon */}
      <div className="relative z-10 flex-shrink-0">
        {isCurrent ? (
          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 pb-6",
        isLast && "pb-0"
      )}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
            Phase {phase.phase_number}
          </span>
          {isCurrent && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Current
            </span>
          )}
        </div>

        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mt-1">
          {formatPhaseName(phase.phase_name || "")}
        </h4>

        <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
          {phase.completed_at && !isCurrent && (
            <div>
              Completed: {new Date(phase.completed_at).toLocaleDateString()} at{" "}
              {new Date(phase.completed_at).toLocaleTimeString()}
            </div>
          )}
          {hasTaskData && (
            <div>
              Tasks: {completedTasks} / {totalTasks}
            </div>
          )}
          {phase.branch && (
            <div className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
              {phase.branch}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatPhaseName(name: string): string {
  return name
    .replace(/^[\d-]+/, "") // Remove leading numbers and dashes
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
