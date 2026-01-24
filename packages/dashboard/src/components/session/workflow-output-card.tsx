'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, HelpCircle, FileText } from 'lucide-react'
import { MarkdownContent } from '@/components/ui/markdown-content'

export interface WorkflowOutput {
  status: 'completed' | 'error' | 'needs_input' | 'cancelled' | string
  phase?: string
  message?: string
  artifacts?: Array<{ path: string; action: string }>
  questions?: Array<{
    question: string
    header?: string
    options?: Array<{ label: string; description?: string }>
    multiSelect?: boolean
  }>
}

interface WorkflowOutputCardProps {
  output: WorkflowOutput
  className?: string
}

const statusConfig = {
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    bgClass: 'bg-success/10 border-success/30',
    iconClass: 'text-success',
    labelClass: 'text-success',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    bgClass: 'bg-error/10 border-error/30',
    iconClass: 'text-error',
    labelClass: 'text-error',
  },
  needs_input: {
    icon: HelpCircle,
    label: 'Input Needed',
    bgClass: 'bg-warning/10 border-warning/30',
    iconClass: 'text-warning',
    labelClass: 'text-warning',
  },
  cancelled: {
    icon: AlertCircle,
    label: 'Cancelled',
    bgClass: 'bg-zinc-500/10 border-zinc-500/30',
    iconClass: 'text-zinc-400',
    labelClass: 'text-zinc-400',
  },
}

export function WorkflowOutputCard({ output, className }: WorkflowOutputCardProps) {
  const config = statusConfig[output.status as keyof typeof statusConfig] || statusConfig.error
  const StatusIcon = config.icon

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        config.bgClass,
        className
      )}
    >
      {/* Header with status and phase */}
      <div className="flex items-center gap-3 mb-3">
        <StatusIcon className={cn('w-5 h-5', config.iconClass)} />
        <span className={cn('font-semibold', config.labelClass)}>
          {config.label}
        </span>
        {output.phase && (
          <span className="px-2 py-0.5 rounded text-xs bg-surface-300 text-zinc-300 uppercase tracking-wider">
            {output.phase}
          </span>
        )}
      </div>

      {/* Message */}
      {output.message && (
        <div className="text-zinc-300 text-sm leading-relaxed mb-3">
          <MarkdownContent
            content={output.message}
            className="prose-p:mb-2 prose-p:last:mb-0 prose-pre:bg-surface-300 prose-pre:text-xs"
          />
        </div>
      )}

      {/* Artifacts */}
      {output.artifacts && output.artifacts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-300">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Artifacts</div>
          <div className="flex flex-wrap gap-2">
            {output.artifacts.map((artifact, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-300 text-xs"
              >
                <FileText className="w-3 h-3 text-zinc-500" />
                <span className="text-zinc-300">{artifact.path.split('/').pop()}</span>
                <span className={cn(
                  'text-[10px] uppercase',
                  artifact.action === 'created' ? 'text-success' :
                  artifact.action === 'updated' ? 'text-accent' :
                  'text-zinc-500'
                )}>
                  {artifact.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions (if needs_input) */}
      {output.questions && output.questions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-300 space-y-3">
          {output.questions.map((q, qIdx) => (
            <div key={qIdx} className="rounded-lg border border-accent/30 bg-accent/5 p-3">
              {q.header && (
                <span className="inline-block px-2 py-0.5 mb-2 rounded text-[10px] uppercase tracking-wider bg-accent/20 text-accent">
                  {q.header}
                </span>
              )}
              <p className="text-zinc-200 text-sm font-medium mb-2">{q.question}</p>
              {q.options && q.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="px-2 py-1 rounded border border-surface-400 bg-surface-300 text-xs"
                    >
                      <span className="text-zinc-200">{opt.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
