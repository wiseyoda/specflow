'use client'

import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/design-system'
import { CircleDashed, FileText, CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import type { TasksData, OrchestrationState, Task } from '@specflow/shared'

interface TasksKanbanProps {
  tasksData?: TasksData | null
  state?: OrchestrationState | null
  className?: string
}

interface TaskCardProps {
  task: Task
  isDone?: boolean
}

function TaskCard({ task, isDone = false }: TaskCardProps) {
  const isHighPriority = task.description.includes('[HIGH]') || task.description.includes('[P1]')
  const isInProgress = task.status === 'in_progress'

  return (
    <GlassCard
      className={cn(
        'p-3',
        isDone && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Status icon */}
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
        ) : isInProgress ? (
          <Circle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5 fill-accent/20" />
        ) : (
          <Circle className="w-4 h-4 text-surface-400 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          {/* Task ID and priority badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-accent">{task.id}</span>
            {isHighPriority && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-danger/20 text-danger">
                HIGH
              </span>
            )}
          </div>

          {/* Description */}
          <p
            className={cn(
              'text-sm text-white',
              isDone && 'line-through text-surface-500'
            )}
          >
            {task.description
              .replace('[HIGH]', '')
              .replace('[P1]', '')
              .replace('[P]', '')
              .replace(/\[US\d+\]/g, '')
              .trim()}
          </p>

          {/* File path if present */}
          {task.filePath && (
            <p className="text-xs text-surface-500 font-mono mt-1 truncate">
              {task.filePath}
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

export function TasksKanban({ tasksData, state, className }: TasksKanbanProps) {
  // Check if there's an active phase
  const hasActivePhase = state?.orchestration?.phase?.number || state?.orchestration?.phase?.name

  if (!tasksData || tasksData.tasks.length === 0) {
    if (!hasActivePhase) {
      return (
        <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
          <CircleDashed className="h-12 w-12 text-surface-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Active Phase</h3>
          <p className="text-sm text-surface-500 max-w-md">
            Start a phase to see tasks. Run{' '}
            <code className="px-1 py-0.5 bg-surface-200 rounded font-mono">
              specflow phase open
            </code>{' '}
            to begin.
          </p>
        </div>
      )
    }

    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <FileText className="h-12 w-12 text-surface-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Tasks Found</h3>
        <p className="text-sm text-surface-500 max-w-md">
          Run{' '}
          <code className="px-1 py-0.5 bg-surface-200 rounded font-mono">/flow.design</code>{' '}
          to generate tasks.
        </p>
      </div>
    )
  }

  // Group tasks into To Do and Done
  // To Do: keep in original order (execution order)
  // Done: reverse order so most recently completed (highest task ID) appears first
  const todoTasks = tasksData.tasks.filter((t) => t.status !== 'done')
  const doneTasks = tasksData.tasks.filter((t) => t.status === 'done').reverse()
  const completedCount = doneTasks.length
  const totalCount = tasksData.tasks.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-white">Tasks</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-surface-500">
            {completedCount} of {totalCount} complete
          </span>
          <div className="w-32 h-2 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-success transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two-column Kanban */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* To Do column */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Circle className="w-4 h-4 text-surface-500" />
            <h3 className="text-sm font-medium text-white">To Do</h3>
            <span className="text-xs text-surface-500 ml-auto">{todoTasks.length}</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar space-y-2 pr-1">
            {todoTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {todoTasks.length === 0 && (
              <p className="text-sm text-surface-500 text-center py-8">
                All tasks completed!
              </p>
            )}
          </div>
        </div>

        {/* Done column */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <h3 className="text-sm font-medium text-white">Done</h3>
            <span className="text-xs text-surface-500 ml-auto">{doneTasks.length}</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar space-y-2 pr-1">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} isDone />
            ))}
            {doneTasks.length === 0 && (
              <p className="text-sm text-surface-500 text-center py-8">
                No completed tasks yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
