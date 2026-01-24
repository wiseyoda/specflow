'use client'

import { cn } from '@/lib/utils'
import { useState, useRef, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react'
import { Paperclip, ArrowUp } from 'lucide-react'
import type { WorkflowStatus } from '@/components/design-system'

export interface SkillOption {
  id: string
  name: string
  command: string
  description: string
}

interface OmniBoxProps {
  status?: WorkflowStatus
  onSubmit?: (message: string) => void
  onStatusClick?: () => void
  disabled?: boolean
  className?: string
  skills?: SkillOption[]
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
    placeholder: 'Type / for commands or ask SpecFlow...',
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
  ({ status = 'idle', onSubmit, onStatusClick, disabled = false, className, skills = [] }, ref) => {
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const autocompleteRef = useRef<HTMLDivElement>(null)

    const config = statusConfig[status]

    // Expose focus method via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }))

    // Filter skills based on current input
    const filteredSkills = useMemo(() => {
      if (!value.startsWith('/')) return []

      // Extract the command part (everything from / to first space or end)
      const spaceIndex = value.indexOf(' ')
      const commandPart = spaceIndex === -1 ? value : value.slice(0, spaceIndex)

      // If there's a space, user has completed the command, don't show autocomplete
      if (spaceIndex !== -1) return []

      // Filter skills that match the partial command
      const partial = commandPart.toLowerCase()
      return skills.filter(skill =>
        skill.command.toLowerCase().startsWith(partial)
      )
    }, [value, skills])

    // Show autocomplete when we have filtered results and input starts with /
    useEffect(() => {
      setShowAutocomplete(filteredSkills.length > 0 && isFocused)
      setSelectedIndex(0)
    }, [filteredSkills.length, isFocused])

    const handleSubmit = () => {
      if (value.trim() && onSubmit && !disabled) {
        onSubmit(value.trim())
        setValue('')
        setShowAutocomplete(false)
      }
    }

    const handleSelectSkill = (skill: SkillOption) => {
      // Replace the command part with the selected skill's command
      const spaceIndex = value.indexOf(' ')
      if (spaceIndex === -1) {
        // No space yet - just set the command with a trailing space for easy continuation
        setValue(skill.command + ' ')
      } else {
        // Replace just the command part, keep the rest
        setValue(skill.command + value.slice(spaceIndex))
      }
      setShowAutocomplete(false)
      inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Handle autocomplete navigation
      if (showAutocomplete && filteredSkills.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % filteredSkills.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + filteredSkills.length) % filteredSkills.length)
          return
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && filteredSkills.length > 0)) {
          e.preventDefault()
          handleSelectSkill(filteredSkills[selectedIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowAutocomplete(false)
          return
        }
      }

      // Regular submit on Enter (when no autocomplete or explicit submit)
      if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
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
            {/* State badge - clickable when waiting */}
            <button
              type="button"
              onClick={status === 'waiting' && onStatusClick ? onStatusClick : undefined}
              disabled={status !== 'waiting' || !onStatusClick}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors mr-2',
                config.badgeClass,
                status === 'waiting' && onStatusClick && 'cursor-pointer hover:opacity-80'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', config.dotClass)} />
              <span className={cn('text-xs font-medium', config.textClass)}>
                {config.badge}
              </span>
            </button>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                // Delay to allow click on autocomplete items
                setTimeout(() => setIsFocused(false), 150)
              }}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              disabled={disabled}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-600 text-sm h-10 min-w-0 outline-none"
            />

            {/* Autocomplete dropdown */}
            {showAutocomplete && filteredSkills.length > 0 && (
              <div
                ref={autocompleteRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-surface-200 border border-surface-300 rounded-lg shadow-xl overflow-hidden z-50"
              >
                <div className="max-h-64 overflow-y-auto">
                  {filteredSkills.map((skill, index) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={cn(
                        'w-full px-4 py-3 text-left flex items-start gap-3 transition-colors',
                        index === selectedIndex
                          ? 'bg-accent/20 border-l-2 border-accent'
                          : 'hover:bg-surface-300 border-l-2 border-transparent'
                      )}
                      onClick={() => handleSelectSkill(skill)}
                    >
                      <span className="font-mono text-accent text-sm shrink-0">
                        {skill.command}
                      </span>
                      <span className="text-zinc-400 text-sm truncate">
                        {skill.description}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 bg-surface-300/50 border-t border-surface-300 text-[10px] text-zinc-500">
                  <kbd className="px-1 py-0.5 rounded bg-surface-200 font-mono">↑↓</kbd> navigate
                  <span className="mx-2">·</span>
                  <kbd className="px-1 py-0.5 rounded bg-surface-200 font-mono">Tab</kbd> select
                  <span className="mx-2">·</span>
                  <kbd className="px-1 py-0.5 rounded bg-surface-200 font-mono">Esc</kbd> dismiss
                </div>
              </div>
            )}

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
