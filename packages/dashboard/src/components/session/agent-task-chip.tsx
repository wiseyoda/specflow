'use client'

import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, Search, FileCode, Terminal, Bot } from 'lucide-react'
import type { AgentTaskInfo } from '@/lib/session-parser'

interface AgentTaskChipProps {
  task: AgentTaskInfo
  className?: string
}

/**
 * Get icon for agent type
 */
function getAgentIcon(subagentType: string) {
  switch (subagentType.toLowerCase()) {
    case 'explore':
      return Search
    case 'plan':
      return FileCode
    case 'bash':
      return Terminal
    default:
      return Bot
  }
}

/**
 * Get color class for agent type
 */
function getAgentColor(subagentType: string): string {
  switch (subagentType.toLowerCase()) {
    case 'explore':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
    case 'plan':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
    case 'bash':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-400'
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
  }
}

export function AgentTaskChip({ task, className }: AgentTaskChipProps) {
  const Icon = getAgentIcon(task.subagentType)
  const colorClass = getAgentColor(task.subagentType)
  const isRunning = task.status === 'running'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
        colorClass,
        className
      )}
    >
      {isRunning ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
      )}
      <Icon className="w-3.5 h-3.5" />
      <span className="truncate max-w-[200px]">{task.description}</span>
    </div>
  )
}

interface AgentTaskGroupProps {
  tasks: AgentTaskInfo[]
  className?: string
}

export function AgentTaskGroup({ tasks, className }: AgentTaskGroupProps) {
  if (!tasks || tasks.length === 0) return null

  const runningCount = tasks.filter(t => t.status === 'running').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  return (
    <div className={cn('space-y-2', className)}>
      {runningCount > 0 && (
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{runningCount} agent{runningCount > 1 ? 's' : ''} working...</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {tasks.map((task) => (
          <AgentTaskChip key={task.id} task={task} />
        ))}
      </div>
      {completedCount > 0 && runningCount === 0 && (
        <div className="text-xs text-green-500/70 flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3" />
          <span>All {completedCount} agent{completedCount > 1 ? 's' : ''} completed</span>
        </div>
      )}
    </div>
  )
}
