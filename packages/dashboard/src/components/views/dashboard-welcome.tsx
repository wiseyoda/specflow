'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Layers, GitMerge, MessageSquareCode, BookOpen, ArrowRight } from 'lucide-react'
import type { OrchestrationState, TasksData } from '@specflow/shared'
import type { PhaseDetail } from '@/hooks/use-phase-detail'
import { PhaseCard } from '@/components/dashboard/phase-card'
import { CompletePhaseButton, type CompletePhaseButtonRef } from '@/components/orchestration/complete-phase-button'
import { OrchestrationProgress } from '@/components/orchestration/orchestration-progress'
import { useOrchestration } from '@/hooks/use-orchestration'
import { commandPaletteEvents } from '@/components/command-palette'

interface DashboardWelcomeProps {
  state: OrchestrationState | null | undefined
  tasksData: TasksData | null | undefined
  focusPhase?: PhaseDetail | null
  focusPhaseLoading?: boolean
  isFocusPhaseActive?: boolean
  projectId?: string
  projectName?: string
  onStartWorkflow?: (skill: string) => void
  onViewHistory?: (phaseNumber?: string) => void
  onNavigateToSession?: () => void
  isStartingWorkflow?: boolean
  className?: string
}

export function DashboardWelcome({
  state,
  tasksData,
  focusPhase,
  focusPhaseLoading = false,
  isFocusPhaseActive = false,
  projectId,
  projectName,
  onStartWorkflow,
  onViewHistory,
  onNavigateToSession,
  isStartingWorkflow = false,
  className,
}: DashboardWelcomeProps) {
  // Ref for programmatic modal triggering from command palette
  const completePhaseRef = useRef<CompletePhaseButtonRef>(null)

  // Listen for command palette "Complete Phase" events
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = commandPaletteEvents.onCompletePhase((triggeredProjectId) => {
      // Only trigger if this is the correct project
      if (triggeredProjectId === projectId) {
        completePhaseRef.current?.openModal()
      }
    })

    return unsubscribe
  }, [projectId])

  // Extract phase info
  const phase = state?.orchestration?.phase
  const phaseNumber = phase?.number
  const phaseName = phase?.name

  // Orchestration state (for progress display)
  const {
    orchestration,
    pause,
    resume,
    cancel,
    triggerMerge,
    isLoading: orchestrationLoading,
    isWaitingForInput,
  } = useOrchestration({
    projectId: projectId ?? '',
    onComplete: () => {
      // Optionally refresh or show toast
    },
  })

  // Check if there's an active orchestration
  const hasActiveOrchestration = !!(
    orchestration &&
    ['running', 'paused', 'waiting_merge'].includes(orchestration.status)
  )

  // Calculate progress from tasks data
  const tasksList = tasksData?.tasks ?? []
  const tasksTotal = tasksList.length
  const doneTasks = tasksList.filter((t) => t.status === 'done').length
  const pendingTasks = tasksList.filter((t) => t.status === 'todo').length
  const inProgressTasks = tasksList.filter((t) => t.status === 'in_progress').length
  const percentage = tasksTotal > 0 ? Math.round((doneTasks / tasksTotal) * 100) : 0
  const tasksRemaining = pendingTasks + inProgressTasks

  // Get current task for primary action
  const currentTask = tasksList.find((t) => t.status === 'in_progress') ?? tasksList.find((t) => t.status === 'todo')

  // Determine subtitle based on available data
  const getSubtitle = () => {
    if (phaseNumber && tasksTotal > 0) {
      // Have phase and tasks
      if (tasksRemaining > 0) {
        return `Phase ${phaseNumber} is ${percentage}% complete. ${tasksRemaining} tasks remaining.`
      }
      return `Phase ${phaseNumber} is complete!`
    }
    if (phaseNumber) {
      // Have phase but no tasks
      return `Working on Phase ${phaseNumber}${phaseName ? `: ${phaseName}` : ''}`
    }
    // No phase data
    return 'Select a workflow to get started.'
  }

  return (
    <div className={cn('absolute inset-0 flex flex-col items-center justify-center p-8 z-10', className)}>
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Greeting */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Ready to build?
          </h1>
          <p className="text-zinc-400 text-lg">
            {getSubtitle()}
          </p>
        </div>

        {/* Quick actions OR Orchestration Progress */}
        <div className="grid grid-cols-1 gap-4">
          {/* Phase Card - shows current or next phase */}
          {(focusPhase || focusPhaseLoading) && (
            <PhaseCard
              phase={focusPhase ?? null}
              isLoading={focusPhaseLoading}
              isActive={isFocusPhaseActive}
              onViewHistory={() => onViewHistory?.(focusPhase?.number)}
            />
          )}

          {/* Show Orchestration Progress when active, otherwise show action buttons */}
          {hasActiveOrchestration && orchestration ? (
            <OrchestrationProgress
              orchestration={orchestration}
              onPause={pause}
              onResume={resume}
              onCancel={cancel}
              onMerge={triggerMerge}
              controlsDisabled={orchestrationLoading}
              isWaitingForInput={isWaitingForInput}
            />
          ) : (
            <>
              {/* Primary action - Complete Phase */}
              {projectId && (
                <CompletePhaseButton
                  ref={completePhaseRef}
                  projectId={projectId}
                  projectName={projectName ?? 'Project'}
                  phaseName={phaseName ? `${phaseNumber}: ${phaseName}` : phaseNumber ? `Phase ${phaseNumber}` : 'Start New Phase'}
                  disabled={isStartingWorkflow}
                  variant="primary"
                  onNavigateToSession={onNavigateToSession}
                />
              )}

              {/* Secondary actions - compact horizontal layout */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => onStartWorkflow?.('flow.orchestrate')}
                  disabled={isStartingWorkflow}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300/50 hover:border-accent/30 hover:bg-surface-200 transition-all disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-md bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Orchestrate</span>
                </button>

                <button
                  onClick={() => onStartWorkflow?.('flow.merge')}
                  disabled={isStartingWorkflow}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300/50 hover:border-purple-500/30 hover:bg-surface-200 transition-all disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-md bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <GitMerge className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Merge</span>
                </button>

                <button
                  onClick={() => onStartWorkflow?.('flow.review')}
                  disabled={isStartingWorkflow}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300/50 hover:border-pink-500/30 hover:bg-surface-200 transition-all disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-md bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                    <MessageSquareCode className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Review</span>
                </button>

                <button
                  onClick={() => onStartWorkflow?.('flow.memory')}
                  disabled={isStartingWorkflow}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300/50 hover:border-amber-500/30 hover:bg-surface-200 transition-all disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-md bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Memory</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stats row - only show if we have task data */}
        {tasksTotal > 0 && (
          <div className="flex items-center justify-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{doneTasks}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Done</div>
            </div>
            <div className="w-px h-8 bg-surface-300" />
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{tasksRemaining}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Remaining</div>
            </div>
            <div className="w-px h-8 bg-surface-300" />
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{percentage}%</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Progress</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
