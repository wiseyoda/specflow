'use client'

import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { PhaseTimelineItem } from './phase-timeline-item'
import { GlassCard } from '@/components/design-system'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { ArtifactViewer } from '@/components/ui/artifact-viewer'
import { FileText, Calendar, Loader2, Target, GitBranch, Gauge } from 'lucide-react'
import type { OrchestrationState } from '@specflow/shared'
import { usePhaseDetail } from '@/hooks/use-phase-detail'

interface Phase {
  number: string
  name: string
  status: 'completed' | 'in_progress' | 'pending' | 'failed'
  dateRange?: string
  cost?: string
  summary?: string
  sessions?: Array<{
    date: string
    skill: string
    cost: string
  }>
  artifacts?: string[]
}

interface HistoryTimelineProps {
  state?: OrchestrationState | null
  phases?: Phase[]
  projectPath?: string
  className?: string
}

// Default phases if not provided
function getDefaultPhases(state: OrchestrationState | null | undefined): Phase[] {
  const currentPhase = state?.orchestration?.phase

  if (!currentPhase?.number) {
    return []
  }

  return [
    {
      number: currentPhase.number,
      name: currentPhase.name ?? 'Current Phase',
      status: 'in_progress',
      artifacts: ['spec.md', 'plan.md', 'tasks.md'],
    },
  ]
}

export function HistoryTimeline({
  state,
  phases: providedPhases,
  projectPath,
  className,
}: HistoryTimelineProps) {
  const phases = providedPhases ?? getDefaultPhases(state)

  // Default to current/in-progress phase, otherwise fall back to first
  const defaultPhase = phases.find((p) => p.status === 'in_progress') ?? phases[0]
  const [selectedPhaseNumber, setSelectedPhaseNumber] = useState<string | null>(
    defaultPhase?.number ?? null
  )

  // Artifact viewer modal state
  const [artifactViewerOpen, setArtifactViewerOpen] = useState(false)
  const [selectedArtifact, setSelectedArtifact] = useState<{
    path: string
    name: string
  } | null>(null)

  // Ref for scrolling to current phase
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const currentPhaseRef = useRef<HTMLDivElement>(null)

  // Update selection when phases change - prefer current/in-progress phase
  useEffect(() => {
    if (phases.length > 0 && !phases.find((p) => p.number === selectedPhaseNumber)) {
      const currentPhase = phases.find((p) => p.status === 'in_progress') ?? phases[0]
      setSelectedPhaseNumber(currentPhase.number)
    }
  }, [phases, selectedPhaseNumber])

  // Scroll to current phase on mount
  useEffect(() => {
    if (currentPhaseRef.current && timelineContainerRef.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        currentPhaseRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
    }
  }, [phases.length]) // Re-run when phases load

  const selectedPhase = phases.find((p) => p.number === selectedPhaseNumber)

  // Fetch phase detail content (with phaseName for artifact lookup)
  const { detail: phaseDetail, isLoading: detailLoading } = usePhaseDetail(
    projectPath ?? null,
    selectedPhaseNumber,
    selectedPhase?.name
  )

  // Open artifact in modal
  const handleArtifactClick = (artifactPath: string, artifactName: string) => {
    setSelectedArtifact({ path: artifactPath, name: artifactName })
    setArtifactViewerOpen(true)
  }

  if (phases.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <Calendar className="h-12 w-12 text-surface-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Phase History</h3>
        <p className="text-sm text-surface-500 max-w-md">
          Complete phases will appear here. Start with{' '}
          <code className="px-1 py-0.5 bg-surface-200 rounded font-mono">/flow.orchestrate</code>
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full gap-6', className)}>
      {/* Left: Timeline */}
      <div ref={timelineContainerRef} className="w-80 flex-shrink-0 overflow-auto custom-scrollbar">
        <h2 className="text-sm font-medium text-surface-500 mb-4">Phase History</h2>
        <div className="space-y-1">
          {phases.map((phase) => {
            const isCurrentPhase = phase.status === 'in_progress'
            return (
              <div
                key={phase.number}
                ref={isCurrentPhase ? currentPhaseRef : undefined}
              >
                <PhaseTimelineItem
                  number={phase.number}
                  name={phase.name}
                  status={phase.status}
                  dateRange={phase.dateRange}
                  cost={phase.cost}
                  isSelected={phase.number === selectedPhaseNumber}
                  onClick={() => setSelectedPhaseNumber(phase.number)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Detail panel */}
      <div className="flex-1 overflow-auto custom-scrollbar pr-2">
        {selectedPhase ? (
          <div className="space-y-4">
            {/* Header */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-medium text-white">{phaseDetail?.name || selectedPhase.name}</h2>
              </div>
              <p className="text-sm text-surface-500">Phase {selectedPhase.number}</p>

              {/* Quick metadata from phase detail */}
              {phaseDetail && (phaseDetail.goal || phaseDetail.dependencies || phaseDetail.complexity) && (
                <div className="mt-4 pt-4 border-t border-surface-300 space-y-2">
                  {phaseDetail.goal && (
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs text-surface-500">Goal: </span>
                        <span className="text-sm text-zinc-300">{phaseDetail.goal}</span>
                      </div>
                    </div>
                  )}
                  {phaseDetail.dependencies && (
                    <div className="flex items-start gap-2">
                      <GitBranch className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs text-surface-500">Dependencies: </span>
                        <span className="text-sm text-zinc-300">{phaseDetail.dependencies}</span>
                      </div>
                    </div>
                  )}
                  {phaseDetail.complexity && (
                    <div className="flex items-start gap-2">
                      <Gauge className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs text-surface-500">Complexity: </span>
                        <span className="text-sm text-zinc-300">{phaseDetail.complexity}</span>
                      </div>
                    </div>
                  )}
                  {phaseDetail.completedAt && (
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs text-surface-500">Completed: </span>
                        <span className="text-sm text-zinc-300">{phaseDetail.completedAt}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            {/* Artifacts - Only show if we have real artifacts from API */}
            {phaseDetail?.artifacts && phaseDetail.artifacts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Artifacts
                  {phaseDetail.artifactsLocation && (
                    <span className="ml-2 text-[10px] font-normal text-surface-600">
                      ({phaseDetail.artifactsLocation})
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {phaseDetail.artifacts.map((artifact) => (
                    <button
                      key={artifact.path}
                      onClick={() => handleArtifactClick(artifact.path, artifact.name)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 hover:border-accent/50 transition-colors cursor-pointer text-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-accent" />
                      <span className="text-white">{artifact.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Phase Content */}
            <div>
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                {phaseDetail?.source === 'history' ? 'History Summary' : 'Phase Details'}
              </h3>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
              ) : phaseDetail?.content ? (
                <GlassCard className="p-4">
                  <MarkdownContent content={phaseDetail.content} />
                </GlassCard>
              ) : (
                <p className="text-sm text-surface-500 italic">
                  No detailed content available for this phase.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-surface-500">
            Select a phase to view details
          </div>
        )}
      </div>

      {/* Artifact Viewer Modal */}
      <ArtifactViewer
        open={artifactViewerOpen}
        onOpenChange={setArtifactViewerOpen}
        artifactPath={selectedArtifact?.path ?? null}
        artifactName={selectedArtifact?.name}
      />
    </div>
  )
}
