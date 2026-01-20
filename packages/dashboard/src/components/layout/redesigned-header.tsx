'use client'

import { cn } from '@/lib/utils'
import { StatusPill, WorkflowStatus } from '@/components/design-system'
import { ChevronRight, PanelRightOpen, GitBranch, Folder } from 'lucide-react'

interface RedesignedHeaderProps {
  projectPath?: string
  branchName?: string
  workflowStatus: WorkflowStatus
  workflowStartTime?: Date | null
  isContextDrawerOpen?: boolean
  onToggleContextDrawer?: () => void
  className?: string
}

export function RedesignedHeader({
  projectPath = '~/dev/project',
  branchName,
  workflowStatus,
  workflowStartTime,
  isContextDrawerOpen = false,
  onToggleContextDrawer,
  className,
}: RedesignedHeaderProps) {
  // Extract folder name and parent path
  const pathParts = projectPath.split('/')
  const folderName = pathParts[pathParts.length - 1] || projectPath
  const parentPath = pathParts.slice(0, -1).join('/').replace(/^\/Users\/[^/]+/, '~')

  return (
    <header
      className={cn(
        'h-14 flex items-center justify-between px-6 border-b border-surface-300/50 glass shrink-0 z-20',
        className
      )}
    >
      {/* Left: Project name + Branch */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Folder className="w-4 h-4 text-accent" />
          <div className="flex items-baseline gap-2">
            <span className="text-white font-semibold text-base">{folderName}</span>
            {parentPath && (
              <span className="text-zinc-600 text-xs">{parentPath}</span>
            )}
          </div>
        </div>
        {branchName && (
          <>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <GitBranch className="w-3 h-3 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">{branchName}</span>
            </div>
          </>
        )}
      </div>

      {/* Center: Status Pill */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <StatusPill
          status={workflowStatus}
          showTimer={true}
          startTime={workflowStartTime}
        />
      </div>

      {/* Right: Context toggle */}
      <div className="flex items-center gap-2">
        {onToggleContextDrawer && (
          <button
            onClick={onToggleContextDrawer}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
              isContextDrawerOpen
                ? 'border-accent/30 text-white bg-white/5'
                : 'border-surface-300/50 text-zinc-400 hover:text-white hover:bg-white/5'
            )}
          >
            <PanelRightOpen className="w-4 h-4" />
            <span className="text-xs font-medium">Context</span>
          </button>
        )}
      </div>
    </header>
  )
}
