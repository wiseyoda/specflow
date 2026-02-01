'use client'

import { cn } from '@/lib/utils'
import { ReactNode, useState, useEffect } from 'react'
import { IconSidebar, ViewType } from './icon-sidebar'
import { RedesignedHeader } from './redesigned-header'
import { GridBackground, FloatingOrbs, WorkflowStatus } from '@/components/design-system'

interface AppLayoutProps {
  children: ReactNode
  projectPath?: string
  branchName?: string
  workflowStatus?: WorkflowStatus
  layoutStatus?: WorkflowStatus
  workflowStartTime?: Date | null
  activeView?: ViewType
  onViewChange?: (view: ViewType) => void
  contextDrawer?: ReactNode
  onFocusOmniBox?: () => void
  className?: string
}

export function AppLayout({
  children,
  projectPath,
  branchName,
  workflowStatus = 'idle',
  layoutStatus,
  workflowStartTime,
  activeView: controlledActiveView,
  onViewChange,
  contextDrawer,
  onFocusOmniBox,
  className,
}: AppLayoutProps) {
  const [internalActiveView, setInternalActiveView] = useState<ViewType>('dashboard')
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(true)

  const activeView = controlledActiveView ?? internalActiveView
  const handleViewChange = onViewChange ?? setInternalActiveView
  const statusForLayout = layoutStatus ?? workflowStatus

  // Determine session indicator based on workflow status
  const sessionIndicator =
    statusForLayout === 'running'
      ? 'live'
      : statusForLayout === 'waiting'
      ? 'warning'
      : null

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault()
            handleViewChange('dashboard')
            break
          case '2':
            e.preventDefault()
            handleViewChange('session')
            break
          case '3':
            e.preventDefault()
            handleViewChange('tasks')
            break
          case '4':
            e.preventDefault()
            handleViewChange('history')
            break
          case 'k':
            e.preventDefault()
            onFocusOmniBox?.()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleViewChange, onFocusOmniBox])

  return (
    <div className={cn('h-screen flex bg-surface-50 text-white overflow-hidden', className)}>
      {/* Background decorations */}
      <GridBackground />
      <FloatingOrbs />

      {/* Icon Sidebar - z-index handled internally for tooltip layering */}
      <IconSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        sessionIndicator={sessionIndicator}
        className="relative"
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <RedesignedHeader
          projectPath={projectPath}
          branchName={branchName}
          workflowStatus={statusForLayout}
          workflowStartTime={workflowStartTime}
          isContextDrawerOpen={isContextDrawerOpen}
          onToggleContextDrawer={() => setIsContextDrawerOpen(!isContextDrawerOpen)}
        />

        {/* Content + Context Drawer */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content with view transition */}
          <main className="flex-1 relative overflow-auto custom-scrollbar p-6 animate-slide-up">
            {children}
          </main>

          {/* Context Drawer */}
          {contextDrawer && (
            <aside
              className={cn(
                'w-72 bg-surface-100 border-l border-surface-300 overflow-auto custom-scrollbar transition-all duration-300',
                isContextDrawerOpen ? 'translate-x-0' : 'translate-x-full w-0 border-0'
              )}
            >
              {isContextDrawerOpen && contextDrawer}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
