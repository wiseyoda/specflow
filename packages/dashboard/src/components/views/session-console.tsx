'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'
import { SessionMessageDisplay } from '@/components/session/session-message'
import { ToolCallBlock } from '@/components/session/tool-call-block'
import { TypingIndicator } from '@/components/session/typing-indicator'
import { Play, Terminal, LayoutDashboard } from 'lucide-react'
import type { SessionMessage } from '@/lib/session-parser'
import type { WorkflowStatus } from '@/components/design-system'

interface SessionConsoleProps {
  messages: SessionMessage[]
  isLoading?: boolean
  isProcessing?: boolean
  workflowStatus?: WorkflowStatus
  onStartWorkflow?: () => void
  onViewDashboard?: () => void
  className?: string
}

export function SessionConsole({
  messages,
  isLoading = false,
  isProcessing = false,
  workflowStatus = 'idle',
  onStartWorkflow,
  onViewDashboard,
  className,
}: SessionConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Empty state when idle
  if (workflowStatus === 'idle' && messages.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-center', className)}>
        <div className="w-16 h-16 rounded-2xl bg-surface-200 flex items-center justify-center text-zinc-600 mb-4">
          <Terminal className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-medium text-zinc-400 mb-2">No active session</h3>
        <p className="text-sm text-zinc-600 max-w-sm mb-6">
          Start a workflow to see live output, tool calls, and agent reasoning here.
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

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto custom-scrollbar space-y-6 pb-4"
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

        {/* Typing indicator when processing */}
        {isProcessing && <TypingIndicator />}
      </div>
    </div>
  )
}
