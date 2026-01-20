'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export type WorkflowStatus = 'idle' | 'running' | 'waiting' | 'failed'

interface StatusPillProps {
  status: WorkflowStatus
  showTimer?: boolean
  startTime?: Date | null
  size?: 'sm' | 'md'
  className?: string
}

const statusConfig = {
  idle: {
    label: 'Ready',
    dotClass: 'bg-zinc-500',
    borderClass: 'border-surface-300/50',
    textClass: 'text-zinc-400',
    showPing: false,
  },
  running: {
    label: 'Running',
    dotClass: 'bg-success',
    borderClass: 'border-success/30 shadow-lg shadow-success/10',
    textClass: 'text-success',
    showPing: true,
  },
  waiting: {
    label: 'Input Needed',
    dotClass: 'bg-warning',
    borderClass: 'border-warning/30 shadow-lg shadow-warning/10',
    textClass: 'text-warning',
    showPing: true,
  },
  failed: {
    label: 'Failed',
    dotClass: 'bg-danger',
    borderClass: 'border-danger/30 shadow-lg shadow-danger/10',
    textClass: 'text-danger',
    showPing: false,
  },
}

function formatElapsedTime(startTime: Date): string {
  const now = new Date()
  const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function StatusPill({
  status,
  showTimer = true,
  startTime,
  size = 'md',
  className,
}: StatusPillProps) {
  const config = statusConfig[status]
  const [elapsed, setElapsed] = useState<string>('00:00')

  useEffect(() => {
    if (!startTime || (status !== 'running' && status !== 'waiting')) {
      return
    }

    const updateTimer = () => {
      setElapsed(formatElapsedTime(startTime))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [startTime, status])

  const shouldShowTimer = showTimer && startTime && (status === 'running' || status === 'waiting')

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-full glass border transition-all duration-300',
        size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2',
        config.borderClass,
        className
      )}
    >
      {/* Status dot with ping animation */}
      <span className="relative flex h-2.5 w-2.5">
        {config.showPing && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.dotClass
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-2.5 w-2.5',
            config.dotClass
          )}
        />
      </span>

      {/* Status text */}
      <span
        className={cn(
          'text-xs font-medium uppercase tracking-wider',
          config.textClass
        )}
      >
        {config.label}
      </span>

      {/* Timer (when running/waiting) */}
      {shouldShowTimer && (
        <div className="flex items-center gap-2">
          <span className="w-px h-4 bg-surface-400" />
          <span className="text-xs font-mono text-zinc-400">{elapsed}</span>
        </div>
      )}
    </div>
  )
}
