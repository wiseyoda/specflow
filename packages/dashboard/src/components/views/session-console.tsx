'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { SessionMessageDisplay } from '@/components/session/session-message'
import { ToolCallBlock } from '@/components/session/tool-call-block'
import { TypingIndicator } from '@/components/session/typing-indicator'
import { TodoPanel } from '@/components/session/todo-panel'
import type { TodoItem } from '@/lib/session-parser'
import { Play, Terminal, LayoutDashboard, ChevronDown, Clock, CheckCircle, XCircle, Loader2, History } from 'lucide-react'
import { SessionControls } from '@/components/session/session-controls'
import type { SessionMessage } from '@/lib/session-parser'
import type { WorkflowStatus } from '@/components/design-system'
import type { WorkflowIndexEntry } from '@/lib/services/workflow-service'

interface SessionConsoleProps {
  messages: SessionMessage[]
  isLoading?: boolean
  isProcessing?: boolean
  workflowStatus?: WorkflowStatus
  onStartWorkflow?: () => void
  onViewDashboard?: () => void
  /** Session history for dropdown */
  sessionHistory?: WorkflowIndexEntry[]
  /** Currently selected session */
  selectedSession?: WorkflowIndexEntry | null
  /** Current workflow session ID */
  currentSessionId?: string | null
  /** Callback when a historical session is selected */
  onSelectSession?: (session: WorkflowIndexEntry | null) => void
  /** Callback to end/cancel an active session */
  onEndSession?: (sessionId: string) => void
  /** Callback to pause an active session (when part of orchestration) */
  onPauseSession?: (sessionId: string) => void
  /** Whether pause is available (e.g., orchestration is active) */
  canPause?: boolean
  /** Project ID for session operations */
  projectId?: string
  /** Current todo items from session */
  currentTodos?: TodoItem[]
  className?: string
}

/**
 * Format a date for the dropdown
 */
function formatSessionDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get status icon for a session
 */
function SessionStatusIcon({ status }: { status: WorkflowIndexEntry['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
    case 'waiting_for_input':
      return <Clock className="w-3 h-3 text-yellow-400" />
    case 'completed':
      return <CheckCircle className="w-3 h-3 text-green-400" />
    case 'failed':
    case 'cancelled':
      return <XCircle className="w-3 h-3 text-red-400" />
    default:
      return <Terminal className="w-3 h-3 text-zinc-400" />
  }
}

export function SessionConsole({
  messages,
  isLoading = false,
  isProcessing = false,
  workflowStatus = 'idle',
  onStartWorkflow,
  onViewDashboard,
  sessionHistory = [],
  selectedSession,
  currentSessionId,
  onSelectSession,
  onEndSession,
  onPauseSession,
  canPause = false,
  projectId,
  currentTodos = [],
  className,
}: SessionConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // Consider "at bottom" if within 100px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsUserScrolledUp(!isAtBottom)
  }

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isUserScrolledUp])

  // Check if we have sessions to show in dropdown
  const hasHistory = sessionHistory.length > 0

  // Check if session has ended (based on messages)
  const hasSessionEnded = messages.some(m => m.isSessionEnd)

  // Empty state when idle AND no history selected
  if (workflowStatus === 'idle' && messages.length === 0 && !selectedSession) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        {/* Session selector - always show if we have history */}
        {hasHistory && (
          <div className="flex-shrink-0 mb-2">
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors text-xs"
              >
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-300 truncate">
                  Browse Session History
                </span>
                <ChevronDown className={cn(
                  'w-3.5 h-3.5 text-zinc-500 transition-transform',
                  isDropdownOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-surface-100 border border-surface-300 rounded-md shadow-xl z-50 overflow-hidden">
                  <div className="px-2.5 py-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider bg-surface-200/50">
                    History
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {sessionHistory.map((session) => (
                      <button
                        key={session.sessionId}
                        onClick={() => {
                          onSelectSession?.(session)
                          setIsDropdownOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-200 transition-colors text-left"
                      >
                        <SessionStatusIcon status={session.status} />
                        <span className="text-sm text-zinc-200 truncate flex-1">
                          {session.skill}
                        </span>
                        <span className="text-xs text-zinc-500">{formatSessionDate(session.startedAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center text-zinc-600 mb-4">
            <Terminal className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-zinc-400 mb-2">No active session</h3>
          <p className="text-sm text-zinc-600 max-w-sm mb-6">
            {hasHistory
              ? 'Select a past session above or start a new workflow.'
              : 'Start a workflow to see live output, tool calls, and agent reasoning here.'}
          </p>
          <div className="flex gap-3">
            {onStartWorkflow && (
              <button
                onClick={onStartWorkflow}
                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors shadow-lg shadow-accent/25"
              >
                <Play className="w-4 h-4 mr-2 inline-block" />
                Start Workflow
              </button>
            )}
            {onViewDashboard && (
              <button
                onClick={onViewDashboard}
                className="px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-300 text-zinc-300 text-sm font-medium transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 mr-2 inline-block" />
                View Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-4" />
        <p className="text-zinc-500">Loading session...</p>
      </div>
    )
  }

  // Determine display name for selected session
  const getSessionDisplayName = () => {
    if (selectedSession) {
      return `${selectedSession.skill} (${formatSessionDate(selectedSession.startedAt)})`
    }
    if (workflowStatus !== 'idle') {
      return 'Current Session'
    }
    return 'Select Session'
  }

  // Determine if the current view is an active session that can be ended
  // Include 'detached' - users should be able to cancel detached sessions
  const currentViewSessionId = selectedSession?.sessionId ?? currentSessionId
  const isCurrentViewActive = selectedSession
    ? ['running', 'waiting_for_input', 'detached'].includes(selectedSession.status)
    : ['running', 'waiting'].includes(workflowStatus)

  const handleEndCurrentSession = () => {
    if (currentViewSessionId && onEndSession) {
      onEndSession(currentViewSessionId)
    }
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Session selector header */}
      {(hasHistory || selectedSession) && (
        <div className="flex-shrink-0 mb-2">
          <div className="flex items-center gap-2">
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors text-xs"
              >
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-300 truncate">
                  {getSessionDisplayName()}
                </span>
                <ChevronDown className={cn(
                  'w-3.5 h-3.5 text-zinc-500 transition-transform',
                  isDropdownOpen && 'rotate-180'
                )} />
              </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-surface-100 border border-surface-300 rounded-md shadow-xl z-50 overflow-hidden">
                {/* Current session option - only show if workflow is actually active */}
                {currentSessionId && !hasSessionEnded && workflowStatus !== 'idle' && (
                  <>
                    <button
                      onClick={() => {
                        onSelectSession?.(null)
                        setIsDropdownOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-200 transition-colors text-left',
                        !selectedSession && 'bg-accent/10'
                      )}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      <span className="text-sm text-zinc-200">Current Session</span>
                      <span className="text-xs text-zinc-500">Live</span>
                    </button>
                    <div className="border-t border-surface-300" />
                  </>
                )}

                {/* History label */}
                {hasHistory && (
                  <div className="px-2.5 py-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider bg-surface-200/50">
                    History
                  </div>
                )}

                {/* Session list */}
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {sessionHistory.map((session) => {
                    // Override status if this is the currently viewed session and it has ended
                    const isCurrentlyViewed = session.sessionId === currentViewSessionId
                    const effectiveStatus = (isCurrentlyViewed && hasSessionEnded) ? 'completed' : session.status

                    return (
                      <button
                        key={session.sessionId}
                        onClick={() => {
                          onSelectSession?.(session)
                          setIsDropdownOpen(false)
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-200 transition-colors text-left',
                          selectedSession?.sessionId === session.sessionId && 'bg-accent/10'
                        )}
                      >
                        <SessionStatusIcon status={effectiveStatus} />
                        <span className="text-sm text-zinc-200 truncate flex-1">
                          {session.skill}
                        </span>
                        <span className="text-xs text-zinc-500">{formatSessionDate(session.startedAt)}</span>
                      </button>
                    )
                  })}
                </div>

                {!hasHistory && !currentSessionId && (
                  <div className="px-2.5 py-3 text-center text-xs text-zinc-500">
                    No session history
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Session controls - show for active sessions */}
            {isCurrentViewActive && currentViewSessionId && onEndSession && (
              <SessionControls
                onCancel={handleEndCurrentSession}
                onPause={canPause && onPauseSession ? () => onPauseSession(currentViewSessionId) : undefined}
                showPause={canPause && !!onPauseSession}
                compact={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto custom-scrollbar space-y-6"
      >
        {messages.map((message, index) => {
          // Check if this is a tool call (detect from content)
          const isToolCall =
            message.role === 'assistant' &&
            (message.content.startsWith('```') || /^(Read|Write|Edit|Bash|Glob|Grep):/i.test(message.content))

          if (isToolCall) {
            // Extract tool info from content
            const toolMatch = message.content.match(/^(Read|Write|Edit|Bash|Glob|Grep):\s*(.+?)(?:\n|$)/i)
            const toolName = toolMatch?.[1] ?? 'Tool'
            const filePath = toolMatch?.[2]?.trim()
            const content = message.content.replace(/^.*?\n/, '')

            return (
              <ToolCallBlock
                key={index}
                toolName={toolName}
                filePath={filePath}
                content={content}
              />
            )
          }

          return <SessionMessageDisplay key={index} message={message} />
        })}

        {/* Typing indicator when processing (hide if session has ended) */}
        {isProcessing && !hasSessionEnded && <TypingIndicator />}
      </div>

      {/* Todo panel at bottom */}
      <TodoPanel todos={currentTodos} />
    </div>
  )
}
