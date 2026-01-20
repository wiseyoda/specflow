'use client'

import { cn } from '@/lib/utils'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'

interface FailedToastProps {
  error?: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

export function FailedToast({
  error = 'An unexpected error occurred',
  onRetry,
  onDismiss,
  className,
}: FailedToastProps) {
  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 animate-slide-up',
        className
      )}
    >
      {/* Red bar */}
      <div className="h-1 w-full rounded-t-lg bg-danger" />

      {/* Toast content */}
      <div className="glass rounded-b-lg p-4 border-x border-b border-danger/30">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-danger" />
          <span className="font-medium text-white">Workflow Failed</span>
        </div>

        {/* Error message */}
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 mb-4">
          <p className="text-sm font-mono text-danger">{error}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl border border-surface-300 text-sm text-zinc-400 hover:text-white hover:border-surface-400 transition-all"
          >
            <X className="w-4 h-4" />
            <span>Dismiss</span>
          </button>
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl bg-danger/20 border border-danger/30 text-sm font-medium text-danger hover:bg-danger/30 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    </div>
  )
}
