'use client'

import { cn } from '@/lib/utils'
import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { Paperclip, ArrowUp } from 'lucide-react'
import type { WorkflowStatus } from '@/components/design-system'

interface OmniBoxProps {
  status?: WorkflowStatus
  onSubmit?: (message: string) => void
  disabled?: boolean
  className?: string
}

export interface OmniBoxHandle {
  focus: () => void
}

const statusConfig = {
  idle: {
    badge: 'Ready',
    dotClass: 'bg-zinc-500',
    badgeClass: 'bg-surface-300',
    textClass: 'text-zinc-400',
    placeholder: 'Ask SpecFlow to do something...',
  },
  running: {
    badge: 'Live',
    dotClass: 'bg-success animate-pulse',
    badgeClass: 'bg-success/10 border border-success/20',
    textClass: 'text-success',
    placeholder: 'Type to intervene or guide...',
  },
  waiting: {
    badge: 'Waiting',
    dotClass: 'bg-warning animate-pulse',
    badgeClass: 'bg-warning/10 border border-warning/20',
    textClass: 'text-warning',
    placeholder: 'Respond to the question...',
  },
  failed: {
    badge: 'Error',
    dotClass: 'bg-danger',
    badgeClass: 'bg-danger/10 border border-danger/20',
    textClass: 'text-danger',
    placeholder: 'Retry or provide instructions...',
  },
}

export const OmniBox = forwardRef<OmniBoxHandle, OmniBoxProps>(
  ({ status = 'idle', onSubmit, disabled = false, className }, ref) => {
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const config = statusConfig[status]

    // Expose focus method via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }))

    const handleSubmit = () => {
      if (value.trim() && onSubmit && !disabled) {
        onSubmit(value.trim())
        setValue('')
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }

    return (
      <div className={cn('p-4 shrink-0', className)}>
        <div className="relative group max-w-3xl mx-auto">
          {/* Glow effect */}
          <div className="absolute -inset-1 omni-glow rounded-2xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />

          {/* Input container */}
          <div
            className={cn(
              'relative bg-surface-200 border rounded-xl flex items-center p-2 shadow-2xl transition-all duration-300',
              isFocused
                ? 'border-accent/50'
                : 'border-surface-300 group-hover:border-surface-400'
            )}
          >
            {/* State badge */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors mr-2',
                config.badgeClass
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', config.dotClass)} />
              <span className={cn('text-xs font-medium', config.textClass)}>
                {config.badge}
              </span>
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              disabled={disabled}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-600 text-sm h-10 min-w-0 outline-none"
            />

            {/* Actions */}
            <div className="flex items-center gap-1 px-1">
              <button
                type="button"
                className="w-9 h-9 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors flex items-center justify-center"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                  value.trim() && !disabled
                    ? 'bg-accent hover:bg-accent-light text-white shadow-lg shadow-accent/25'
                    : 'text-zinc-600 cursor-not-allowed'
                )}
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hint */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600">
            Press <kbd className="px-1.5 py-0.5 rounded bg-surface-300 text-zinc-500 font-mono">⌘K</kbd> to focus
          </div>
        </div>
      </div>
    )
  }
)

OmniBox.displayName = 'OmniBox'
