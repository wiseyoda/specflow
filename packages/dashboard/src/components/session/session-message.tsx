'use client'

import { cn } from '@/lib/utils'
import type { SessionMessage } from '@/lib/session-parser'

interface SessionMessageDisplayProps {
  message: SessionMessage
  className?: string
}

type MessageType = 'reasoning' | 'action' | 'info'

function getMessageType(content: string): MessageType {
  // Detect reasoning vs action based on content patterns
  const reasoningPatterns = [
    /^I need to/i,
    /^Let me/i,
    /^I'll/i,
    /^I should/i,
    /^Looking at/i,
    /^Analyzing/i,
    /^Thinking/i,
  ]
  const actionPatterns = [
    /^Creating/i,
    /^Writing/i,
    /^Editing/i,
    /^Running/i,
    /^Executing/i,
    /^Installing/i,
    /^Building/i,
    /^I'll implement/i,
  ]

  for (const pattern of actionPatterns) {
    if (pattern.test(content)) return 'action'
  }
  for (const pattern of reasoningPatterns) {
    if (pattern.test(content)) return 'reasoning'
  }
  return 'info'
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

function extractAgentName(content: string): string | null {
  // Look for agent attribution patterns
  const agentMatch = content.match(/@(\w+)/)?.[1]
  if (agentMatch) return agentMatch

  // Infer from content
  if (/implement|task|code/i.test(content)) return 'Implementer'
  if (/design|spec|plan/i.test(content)) return 'Designer'
  if (/verify|check|test/i.test(content)) return 'Verifier'
  if (/analyze|research/i.test(content)) return 'Analyzer'

  return null
}

const typeConfig = {
  reasoning: {
    badge: 'reasoning',
    badgeClass: 'bg-accent/10 text-accent border border-accent/20',
  },
  action: {
    badge: 'action',
    badgeClass: 'bg-success/10 text-success border border-success/20',
  },
  info: {
    badge: null,
    badgeClass: '',
  },
}

export function SessionMessageDisplay({
  message,
  className,
}: SessionMessageDisplayProps) {
  const isUser = message.role === 'user'
  const timeStr = formatTimestamp(message.timestamp)
  const messageType = isUser ? 'info' : getMessageType(message.content)
  const config = typeConfig[messageType]
  const agentName = isUser ? null : extractAgentName(message.content)

  if (isUser) {
    // User messages styled with accent highlight
    return (
      <div
        className={cn(
          'relative pl-6 border-l-2 border-accent/50',
          className
        )}
      >
        <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-accent shadow-lg shadow-accent/50" />
        <div className="flex items-center gap-3 mb-2">
          <span className="text-accent font-bold">You</span>
          {timeStr && <span className="text-xs text-zinc-500">{timeStr}</span>}
        </div>
        <p className="text-zinc-300 leading-relaxed">
          {message.content}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative pl-6 border-l-2 border-surface-300 hover:border-accent/50 transition-colors',
        className
      )}
    >
      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-accent shadow-lg shadow-accent/50" />

      {/* Header: Agent, type badge */}
      <div className="flex items-center gap-3 mb-2">
        {agentName && (
          <span className="text-accent font-bold">@{agentName}</span>
        )}
        {config.badge && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider',
              config.badgeClass
            )}
          >
            {config.badge}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-zinc-300 leading-relaxed">
        {message.content}
      </p>
    </div>
  )
}
