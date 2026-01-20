'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'

type PhaseStatus = 'completed' | 'in_progress' | 'pending' | 'failed'

interface PhaseTimelineItemProps {
  number: string
  name: string
  status: PhaseStatus
  dateRange?: string
  cost?: string
  isSelected?: boolean
  onClick?: () => void
  className?: string
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    iconClass: 'text-success',
    dotClass: 'bg-success',
    label: 'Merged',
  },
  in_progress: {
    icon: Clock,
    iconClass: 'text-accent',
    dotClass: 'bg-accent animate-glow-pulse',
    label: 'Current',
  },
  pending: {
    icon: Circle,
    iconClass: 'text-surface-500',
    dotClass: 'bg-surface-500',
    label: 'Pending',
  },
  failed: {
    icon: AlertCircle,
    iconClass: 'text-danger',
    dotClass: 'bg-danger',
    label: 'Failed',
  },
}

export function PhaseTimelineItem({
  number,
  name,
  status,
  dateRange,
  cost,
  isSelected = false,
  onClick,
  className,
}: PhaseTimelineItemProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
        isSelected
          ? 'bg-surface-200 border border-surface-300'
          : 'hover:bg-surface-200/50',
        className
      )}
    >
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center pt-1">
        <div className={cn('w-3 h-3 rounded-full', config.dotClass)} />
        <div className="w-0.5 h-full bg-surface-300 mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-accent">{number}</span>
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              status === 'completed' && 'bg-success/20 text-success',
              status === 'in_progress' && 'bg-accent/20 text-accent-light',
              status === 'pending' && 'bg-surface-300 text-surface-500',
              status === 'failed' && 'bg-danger/20 text-danger'
            )}
          >
            {config.label}
          </span>
        </div>
        <div className="text-sm font-medium text-white truncate">{name}</div>
        {(dateRange || cost) && (
          <div className="flex items-center gap-2 mt-1 text-xs text-surface-500">
            {dateRange && <span>{dateRange}</span>}
            {dateRange && cost && <span>•</span>}
            {cost && <span>{cost}</span>}
          </div>
        )}
      </div>
    </button>
  )
}
