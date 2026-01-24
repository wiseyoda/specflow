'use client'

import { cn } from '@/lib/utils'
import { useState, useMemo, useCallback } from 'react'
import {
  CheckCircle2,
  FileCode,
  Code,
  TestTube2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Search,
  Play,
  CheckCircle,
  XCircle,
  GitMerge,
  GitCommit,
  FolderOpen,
  FolderClosed,
} from 'lucide-react'
import type { OrchestrationState, OrchestrationPhase, Task, TasksData } from '@specflow/shared'
import { FileViewerModal } from '@/components/session/file-viewer-modal'
import { useActivityFeed, type ActivityType, type ActivityItem as FeedActivityItem } from '@/hooks/use-activity-feed'
import { StepOverride } from '@/components/orchestration/step-override'

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
  /** Project ID for fetching activity feed */
  projectId?: string
  /** Project path for constructing absolute file paths */
  projectPath?: string
  className?: string
  /** FR-004: Callback to go back to a previous step */
  onGoBackToStep?: (step: string) => void
  /** FR-004: Whether a go-back action is in progress */
  isGoingBackToStep?: boolean
  /** FR-004: Whether workflow is currently running (disables step override) */
  isWorkflowRunning?: boolean
}

type TabType = 'context' | 'activity'

const phaseSteps = [
  { id: 'design', label: 'Design', icon: Code },
  { id: 'analyze', label: 'Analyze', icon: Search },
  { id: 'implement', label: 'Implement', icon: Code },
  { id: 'verify', label: 'Verify', icon: TestTube2 },
]

/** Design phase sub-steps */
const designSubSteps = [
  { id: 'spec', label: 'Spec' },
  { id: 'plan', label: 'Plan' },
  { id: 'tasks', label: 'Tasks' },
]

/**
 * Group tasks by their phase section
 */
interface TasksByPhase {
  phase: string;
  tasks: Task[];
  done: number;
  total: number;
}

function groupTasksByPhase(tasks: Task[]): TasksByPhase[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const phase = task.phase || 'Tasks';
    if (!groups.has(phase)) {
      groups.set(phase, []);
    }
    groups.get(phase)!.push(task);
  }

  return Array.from(groups.entries()).map(([phase, phaseTasks]) => ({
    phase,
    tasks: phaseTasks,
    done: phaseTasks.filter((t) => t.status === 'done').length,
    total: phaseTasks.length,
  }));
}

export function ContextDrawer({
  state,
  tasksData,
  currentTask,
  nextTask,
  touchedFiles = [],
  totalAdditions = 0,
  totalDeletions = 0,
  projectId,
  projectPath,
  className,
  onGoBackToStep,
  isGoingBackToStep = false,
  isWorkflowRunning = false,
}: ContextDrawerProps) {
  // Use current task if in progress, otherwise show next task
  const displayTask = currentTask ?? nextTask
  const [activeTab, setActiveTab] = useState<TabType>('context')
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)

  // Activity feed (combines sessions, tasks, commits)
  const { activities, isLoading: activityLoading } = useActivityFeed(
    projectId ?? null,
    projectPath ?? null,
    25
  )

  // File viewer modal state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedFileIsNew, setSelectedFileIsNew] = useState(false)

  // Handle file click - construct full path and open modal
  const handleFileClick = useCallback((relativePath: string, isNew: boolean = false) => {
    if (projectPath) {
      const fullPath = `${projectPath}/${relativePath}`
      setSelectedFilePath(fullPath)
      setSelectedFileIsNew(isNew)
    }
  }, [projectPath])

  // Get current step from state - only if we have orchestration data
  const hasOrchestration = !!state?.orchestration?.phase?.number
  const currentStep = state?.orchestration?.step?.current
  const stepStatus = state?.orchestration?.step?.status
  // If step.status is 'complete', the current step is done - show next step as active
  const stepComplete = stepStatus === 'complete'
  const baseStepIndex = currentStep ? phaseSteps.findIndex((s) => s.id === currentStep) : -1
  // Advance to next step if current step is complete
  const currentStepIndex = stepComplete && baseStepIndex >= 0 ? baseStepIndex + 1 : baseStepIndex

  // Calculate task progress from actual tasks data
  const tasksList = tasksData?.tasks ?? []
  const tasksTotal = tasksList.length
  const doneTasks = tasksList.filter((t) => t.status === 'done').length
  const taskPercentage = tasksTotal > 0 ? Math.round((doneTasks / tasksTotal) * 100) : 0

  // Group tasks by phase for detailed progress
  const tasksByPhase = useMemo(() => groupTasksByPhase(tasksList), [tasksList])

  // Auto-expand current step
  const togglePhaseExpand = (phaseId: string) => {
    setExpandedPhase(expandedPhase === phaseId ? null : phaseId)
  }

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
                  <p className="text-xs text-zinc-200 font-medium mb-3 break-words leading-relaxed">{displayTask.description}</p>
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

            {/* Phase Progress - only show if we have orchestration data */}
            {hasOrchestration && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20">
                    <span className="text-[10px] font-bold text-accent tracking-wider">SPECFLOW</span>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Phase Progress
                  </h3>
                </div>
                <div className="space-y-1">
                  {phaseSteps.map((step, index) => {
                    const isComplete = currentStepIndex >= 0 && index < currentStepIndex
                    const isCurrent = index === currentStepIndex
                    const isPending = currentStepIndex < 0 || index > currentStepIndex
                    const Icon = step.icon
                    const isExpanded = expandedPhase === step.id
                    // Allow expanding design and implement phases (when current or complete)
                    const hasExpandableContent = step.id === 'design' || (step.id === 'implement' && tasksByPhase.length > 0)
                    const canExpand = hasExpandableContent && (isCurrent || isComplete)

                    return (
                      <div key={step.id} className={cn(isPending && 'opacity-40')}>
                        {/* Main step row */}
                        <button
                          onClick={() => canExpand && togglePhaseExpand(step.id)}
                          disabled={!canExpand}
                          className={cn(
                            'flex items-center gap-3 w-full py-2 px-2 -mx-2 rounded-lg transition-colors',
                            canExpand && 'hover:bg-white/5 cursor-pointer',
                            !canExpand && 'cursor-default'
                          )}
                        >
                          {canExpand && (
                            isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-surface-500 -ml-1" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-surface-500 -ml-1" />
                            )
                          )}
                          {!canExpand && <div className="w-3 -ml-1" />}
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0',
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
                              'text-sm flex-1 text-left',
                              isComplete && 'text-zinc-400',
                              isCurrent && 'text-white font-medium',
                              isPending && 'text-zinc-500'
                            )}
                          >
                            {step.label}
                          </span>
                          {/* Show percentage for implement step */}
                          {isCurrent && step.id === 'implement' && tasksTotal > 0 && (
                            <span className="text-xs text-zinc-500">{taskPercentage}%</span>
                          )}
                        </button>

                        {/* Sub-steps for design */}
                        {isExpanded && step.id === 'design' && (
                          <div className="ml-9 mt-1 mb-2 space-y-1.5 border-l border-surface-300 pl-3">
                            {designSubSteps.map((subStep) => {
                              // If design phase is complete, all sub-steps are complete
                              const subStepComplete = isComplete
                              return (
                                <div key={subStep.id} className="flex items-center gap-2 text-xs">
                                  {subStepComplete ? (
                                    <CheckCircle2 className="w-3 h-3 text-success" />
                                  ) : (
                                    <Circle className="w-3 h-3 text-surface-500" />
                                  )}
                                  <span className={cn(
                                    subStepComplete ? 'text-zinc-400' : 'text-zinc-500'
                                  )}>
                                    {subStep.label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Sub-steps for implement - group tasks by phase */}
                        {isExpanded && step.id === 'implement' && tasksByPhase.length > 0 && (
                          <div className="ml-9 mt-1 mb-2 space-y-1.5 border-l border-surface-300 pl-3">
                            {tasksByPhase.map((group) => {
                              const groupComplete = group.done === group.total
                              const groupInProgress = group.done > 0 && group.done < group.total
                              return (
                                <div key={group.phase} className="flex items-center gap-2 text-xs">
                                  {groupComplete ? (
                                    <CheckCircle2 className="w-3 h-3 text-success" />
                                  ) : groupInProgress ? (
                                    <CircleDot className="w-3 h-3 text-warning" />
                                  ) : (
                                    <Circle className="w-3 h-3 text-surface-500" />
                                  )}
                                  <span className={cn(
                                    groupComplete && 'text-zinc-400',
                                    groupInProgress && 'text-zinc-300',
                                    !groupComplete && !groupInProgress && 'text-zinc-500'
                                  )}>
                                    {group.phase}
                                  </span>
                                  <span className="text-surface-500 ml-auto">
                                    {group.done}/{group.total}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* FR-004: Step Override - Go Back to Previous Step */}
            {hasOrchestration && currentStep && onGoBackToStep && (
              <StepOverride
                currentPhase={currentStep as OrchestrationPhase}
                onGoBack={onGoBackToStep}
                disabled={isWorkflowRunning}
                isLoading={isGoingBackToStep}
              />
            )}

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
                    <button
                      key={index}
                      onClick={() => handleFileClick(file.path, file.status === 'added')}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors w-full text-left"
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
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No uncommitted changes</p>
              )}
            </div>
          </>
        )}

        {/* File Viewer Modal - with diff view for changes */}
        <FileViewerModal
          open={!!selectedFilePath}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedFilePath(null)
              setSelectedFileIsNew(false)
            }
          }}
          filePath={selectedFilePath}
          projectPath={projectPath}
          showDiff={true}
          isNewFile={selectedFileIsNew}
        />

        {activeTab === 'activity' && (
          <div className="space-y-1">
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  {/* Activity Icon */}
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                    activity.type === 'session_completed' && 'bg-success/20',
                    activity.type === 'session_started' && 'bg-accent/20',
                    activity.type === 'session_failed' && 'bg-danger/20',
                    activity.type === 'task_completed' && 'bg-success/20',
                    activity.type === 'phase_opened' && 'bg-purple-500/20',
                    activity.type === 'phase_closed' && 'bg-purple-500/20',
                    activity.type === 'merge' && 'bg-cyan-500/20',
                    activity.type === 'commit' && 'bg-zinc-500/20',
                  )}>
                    {activity.type === 'session_completed' && <CheckCircle className="w-3.5 h-3.5 text-success" />}
                    {activity.type === 'session_started' && <Play className="w-3.5 h-3.5 text-accent" />}
                    {activity.type === 'session_failed' && <XCircle className="w-3.5 h-3.5 text-danger" />}
                    {activity.type === 'task_completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                    {activity.type === 'phase_opened' && <FolderOpen className="w-3.5 h-3.5 text-purple-400" />}
                    {activity.type === 'phase_closed' && <FolderClosed className="w-3.5 h-3.5 text-purple-400" />}
                    {activity.type === 'merge' && <GitMerge className="w-3.5 h-3.5 text-cyan-400" />}
                    {activity.type === 'commit' && <GitCommit className="w-3.5 h-3.5 text-zinc-400" />}
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 leading-tight">{activity.title}</p>
                    {activity.subtitle && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{activity.subtitle}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {activity.metadata?.commitHash && (
                        <span className="text-[10px] text-zinc-600 font-mono bg-surface-300 px-1.5 py-0.5 rounded">
                          {activity.metadata.commitHash}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-600">{activity.relativeTime}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <GitCommit className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500">No recent activity</p>
                <p className="text-xs text-zinc-600 mt-1">Start a workflow to see activity here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
