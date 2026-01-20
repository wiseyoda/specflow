'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  CheckCircle2,
  FileCode,
  Code,
  TestTube2,
  Search,
} from 'lucide-react'
import type { OrchestrationState, Task, TasksData } from '@specflow/shared'

interface FileChange {
  path: string
  filename: string
  directory: string
  additions: number
  deletions: number
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

interface ActivityItem {
  type: 'task' | 'file' | 'commit'
  description: string
  timestamp: string
  hash?: string
  author?: string
}

interface ContextDrawerProps {
  state?: OrchestrationState | null
  tasksData?: TasksData | null
  currentTask?: Task | null
  nextTask?: Task | null
  touchedFiles?: FileChange[]
  totalAdditions?: number
  totalDeletions?: number
  recentActivity?: ActivityItem[]
  className?: string
}

type TabType = 'context' | 'activity'

const phaseSteps = [
  { id: 'discovery', label: 'Discovery', icon: Search },
  { id: 'design', label: 'Design', icon: Code },
  { id: 'implement', label: 'Implement', icon: Code },
  { id: 'verify', label: 'Verify', icon: TestTube2 },
]

export function ContextDrawer({
  state,
  tasksData,
  currentTask,
  nextTask,
  touchedFiles = [],
  totalAdditions = 0,
  totalDeletions = 0,
  recentActivity = [],
  className,
}: ContextDrawerProps) {
  // Use current task if in progress, otherwise show next task
  const displayTask = currentTask ?? nextTask
  const [activeTab, setActiveTab] = useState<TabType>('context')

  // Get current step from state - only if we have orchestration data
  const hasOrchestration = !!state?.orchestration?.phase?.number
  const currentStep = state?.orchestration?.step?.current
  const currentStepIndex = currentStep ? phaseSteps.findIndex((s) => s.id === currentStep) : -1

  // Calculate task progress from actual tasks data
  const tasksList = tasksData?.tasks ?? []
  const tasksTotal = tasksList.length
  const doneTasks = tasksList.filter((t) => t.status === 'done').length
  const taskPercentage = tasksTotal > 0 ? Math.round((doneTasks / tasksTotal) * 100) : 0

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Tabs */}
      <div className="flex border-b border-surface-300">
        <button
          onClick={() => setActiveTab('context')}
          className={cn(
            'flex-1 py-3 text-xs font-medium transition-colors',
            activeTab === 'context'
              ? 'text-white border-b-2 border-accent bg-white/5'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Context
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={cn(
            'flex-1 py-3 text-xs font-medium transition-colors',
            activeTab === 'activity'
              ? 'text-white border-b-2 border-accent bg-white/5'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'context' && (
          <>
            {/* Current/Next Task */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {currentTask ? 'Current Task' : nextTask ? 'Next Task' : 'Current Task'}
              </h3>
              {displayTask ? (
                <div className="p-4 rounded-xl bg-surface-200 border border-surface-300">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-accent">{displayTask.id}</span>
                    {currentTask?.status === 'in_progress' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning/20 text-warning border border-warning/30">
                        IN PROGRESS
                      </span>
                    ) : nextTask ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent border border-accent/30">
                        UP NEXT
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-200 font-medium mb-3">{displayTask.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${taskPercentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500">{taskPercentage}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No tasks available</p>
              )}
            </div>

            {/* Touched Files */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Changes
                </h3>
                {touchedFiles.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-success">+{totalAdditions}</span>
                    <span className="text-danger">-{totalDeletions}</span>
                    <span className="text-zinc-500 bg-surface-300 px-1.5 py-0.5 rounded">
                      {touchedFiles.length}
                    </span>
                  </div>
                )}
              </div>
              {touchedFiles.length > 0 ? (
                <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {touchedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
                    >
                      <FileCode className={cn(
                        'w-3.5 h-3.5 flex-shrink-0',
                        file.status === 'added' && 'text-success',
                        file.status === 'modified' && 'text-warning',
                        file.status === 'deleted' && 'text-danger',
                        file.status === 'renamed' && 'text-purple-400'
                      )} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-zinc-300 font-mono block truncate">
                          {file.filename}
                        </span>
                        {file.directory && (
                          <span className="text-[10px] text-zinc-600 font-mono block truncate">
                            {file.directory}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono flex-shrink-0">
                        {file.additions > 0 && (
                          <span className="text-success">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-danger">-{file.deletions}</span>
                        )}
                        {file.additions === 0 && file.deletions === 0 && (
                          <span className="text-zinc-500">0</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No uncommitted changes</p>
              )}
            </div>

            {/* Phase Progress - only show if we have orchestration data */}
            {hasOrchestration && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Phase Progress
                </h3>
                <div className="space-y-3">
                  {phaseSteps.map((step, index) => {
                    const isComplete = currentStepIndex >= 0 && index < currentStepIndex
                    const isCurrent = index === currentStepIndex
                    const isPending = currentStepIndex < 0 || index > currentStepIndex
                    const Icon = step.icon

                    return (
                      <div key={step.id} className={cn('flex items-center gap-3', isPending && 'opacity-40')}>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                            isComplete && 'bg-success/20 text-success',
                            isCurrent && 'bg-accent text-white shadow-lg shadow-accent/30',
                            isPending && 'bg-surface-300 text-zinc-500'
                          )}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Icon className="w-3 h-3" />
                          )}
                        </div>
                        <span
                          className={cn(
                            'text-sm',
                            isComplete && 'text-zinc-400',
                            isCurrent && 'text-white font-medium',
                            isPending && 'text-zinc-500'
                          )}
                        >
                          {step.label}
                        </span>
                        {/* Only show percentage for implement step */}
                        {isCurrent && step.id === 'implement' && tasksTotal > 0 && (
                          <span className="text-xs text-zinc-500 ml-auto">{taskPercentage}%</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-1">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full mt-1.5 shrink-0',
                      activity.type === 'task' && 'bg-success',
                      activity.type === 'file' && 'bg-accent',
                      activity.type === 'commit' && 'bg-purple-500'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {activity.hash && (
                        <span className="text-[10px] text-zinc-600 font-mono">{activity.hash}</span>
                      )}
                      <span className="text-[10px] text-zinc-600">{activity.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No recent activity</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
