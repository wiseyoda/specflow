"use client"

import { PhaseTimelineItem } from "./phase-timeline-item"
import { GitBranch, History } from "lucide-react"
import type { OrchestrationState } from "@specflow/shared"

interface TimelineViewProps {
  project: {
    id: string
    name: string
    path: string
    registered_at: string
  }
  state?: OrchestrationState | null
}

interface PhaseHistoryItem {
  type: string
  phase_number?: string | null
  phase_name?: string | null
  branch?: string | null
  completed_at?: string
  tasks_completed?: number | string
  tasks_total?: number | string
}

export function TimelineView({ state }: TimelineViewProps) {
  // Extract history from state
  const stateWithActions = state as (OrchestrationState & {
    actions?: {
      history?: PhaseHistoryItem[]
    }
  }) | null

  const history = stateWithActions?.actions?.history || []
  const currentPhase = state?.orchestration?.phase

  // Filter for phase_completed events and deduplicate by phase_number
  const completedPhases = history
    .filter((item): item is PhaseHistoryItem =>
      item.type === "phase_completed" && !!item.phase_number
    )
    .reduce((acc, phase) => {
      // Keep the most recent completion for each phase number
      const existing = acc.get(phase.phase_number!)
      if (!existing || new Date(phase.completed_at || 0) > new Date(existing.completed_at || 0)) {
        acc.set(phase.phase_number!, phase)
      }
      return acc
    }, new Map<string, PhaseHistoryItem>())

  // Sort by phase number descending (latest first)
  const sortedPhases = Array.from(completedPhases.values())
    .sort((a, b) => {
      const numA = parseInt(a.phase_number || "0", 10)
      const numB = parseInt(b.phase_number || "0", 10)
      return numB - numA
    })

  // Build timeline: current phase first, then completed phases (latest first)
  const timelineItems: Array<{ phase: PhaseHistoryItem; isCurrent: boolean }> = []

  // Add current phase at the top if it exists and isn't in the completed list
  if (currentPhase?.number && !completedPhases.has(currentPhase.number)) {
    timelineItems.push({
      phase: {
        type: "phase_current",
        phase_number: currentPhase.number,
        phase_name: currentPhase.name,
        branch: currentPhase.branch,
      },
      isCurrent: true,
    })
  }

  // Add completed phases (already sorted descending)
  timelineItems.push(...sortedPhases.map((phase) => ({ phase, isCurrent: false })))

  if (timelineItems.length === 0 && !currentPhase) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-neutral-400 mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          No Phase History
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          This project doesn&apos;t have any phase history yet.
          Complete phases using <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">/flow.merge</code> to see them here.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        <GitBranch className="h-4 w-4" />
        <span>{timelineItems.length} phase{timelineItems.length !== 1 ? "s" : ""} in history</span>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {timelineItems.map((item, index) => (
          <PhaseTimelineItem
            key={item.phase.phase_number || index}
            phase={item.phase}
            isCurrent={item.isCurrent}
            isLast={index === timelineItems.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
