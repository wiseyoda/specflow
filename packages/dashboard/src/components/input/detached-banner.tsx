'use client'

import { cn } from '@/lib/utils'
import { AlertCircle, Eye, X } from 'lucide-react'
import { useState } from 'react'

interface DetachedBannerProps {
  sessionId?: string | null
  onViewSession?: () => void
  className?: string
}

export function DetachedBanner({
  sessionId,
  onViewSession,
  className,
}: DetachedBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 max-w-lg w-full mx-4 z-40',
        className
      )}
    >
      <div className="glass border border-warning/30 shadow-lg shadow-warning/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-warning" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-warning mb-1">
              Session May Still Be Running
            </h4>
            <p className="text-xs text-zinc-400 mb-3">
              The dashboard lost track of this workflow, but the Claude session may still be active.
              Check the session view or session history to see current activity.
            </p>

            <div className="flex gap-2">
              {onViewSession && sessionId && (
                <button
                  onClick={onViewSession}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/20 border border-warning/30 text-warning text-xs font-medium hover:bg-warning/30 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View Session
                </button>
              )}
              <button
                onClick={() => setIsDismissed(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-300 text-zinc-400 text-xs hover:text-white hover:border-surface-400 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
