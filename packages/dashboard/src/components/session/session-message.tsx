'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { SessionMessage, ToolCallInfo, QuestionInfo, AgentTaskInfo } from '@/lib/session-parser'
import { CommandChip } from './command-chip'
import { LocalCommandChip } from './local-command-chip'
import { FileChipGroup } from './file-chip'
import { FileViewerModal } from './file-viewer-modal'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { AgentTaskGroup } from './agent-task-chip'

interface SessionMessageDisplayProps {
  message: SessionMessage
  className?: string
  /** Callback when a file chip is clicked */
  onFileClick?: (path: string) => void
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

/**
 * Check if a user message is an answer to Claude's questions and extract the answer(s)
 */
function extractUserAnswers(content: string): string[] | null {
  const isAnswerBlock =
    content.startsWith('# User Answers') ||
    content.startsWith('# Answers to your questions')
  if (isAnswerBlock) {
    const answers: string[] = []
    // Prefer key/value style: "- Question: Answer"
    const keyValuePattern = /- (.+?):\s*(.+?)(?:\n|$)/g
    let match
    while ((match = keyValuePattern.exec(content)) !== null) {
      answers.push(match[2].trim())
    }
    if (answers.length > 0) return answers

    // Fallback: indexed answers "- 0: Answer"
    const indexPattern = /- \d+:\s*(.+?)(?:\n|$)/g
    while ((match = indexPattern.exec(content)) !== null) {
      answers.push(match[1].trim())
    }
    if (answers.length > 0) return answers
  }
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

/**
 * Convert tool calls to file chip format
 */
function toolCallsToFileChips(
  toolCalls: ToolCallInfo[] | undefined
): Array<{ path: string; operation: 'read' | 'write' | 'edit' | 'search' }> {
  if (!toolCalls) return []

  const chips: Array<{ path: string; operation: 'read' | 'write' | 'edit' | 'search' }> = []

  for (const tc of toolCalls) {
    // Skip non-file operations
    if (tc.operation === 'execute' || tc.operation === 'todo') continue
    // Skip if no files
    if (!tc.files || tc.files.length === 0) continue

    for (const file of tc.files) {
      chips.push({
        path: file,
        operation: tc.operation as 'read' | 'write' | 'edit' | 'search',
      })
    }
  }

  return chips
}

export function SessionMessageDisplay({
  message,
  className,
  onFileClick,
}: SessionMessageDisplayProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const timeStr = formatTimestamp(message.timestamp)
  const messageType = isUser || isSystem ? 'info' : getMessageType(message.content)
  const config = typeConfig[messageType]
  const agentName = isUser || isSystem ? null : extractAgentName(message.content)

  // File viewer modal state
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const handleFileClick = useCallback((path: string) => {
    if (onFileClick) {
      onFileClick(path)
    } else {
      setSelectedFile(path)
    }
  }, [onFileClick])

  // Convert tool calls to file chips
  const fileChips = toolCallsToFileChips(message.toolCalls)

  // Session end indicator
  if (isSystem && message.isSessionEnd) {
    return (
      <div className={cn('flex items-center justify-center py-4', className)}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-200 border border-surface-300">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-sm text-zinc-400">Session Ended</span>
          {timeStr && <span className="text-xs text-zinc-500">{timeStr}</span>}
        </div>
      </div>
    )
  }

  if (isUser) {
    // Check if this is a local CLI command (e.g., /clear, /help)
    if (message.localCommand) {
      return (
        <div
          className={cn(
            'relative pl-6 border-l-2 border-zinc-500/50',
            className
          )}
        >
          <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-zinc-500 shadow-lg shadow-zinc-500/50" />
          <div className="flex items-center gap-3 mb-2">
            <span className="text-zinc-400 font-bold">You</span>
            {timeStr && <span className="text-xs text-zinc-500">{timeStr}</span>}
          </div>
          <LocalCommandChip data={message.localCommand} />
        </div>
      )
    }

    // Check if this is a command injection (workflow command)
    if (message.isCommandInjection && message.commandName) {
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
          <CommandChip
            commandName={message.commandName}
            fullContent={message.content}
          />
        </div>
      )
    }

    // Check if this is an answer to Claude's questions
    const userAnswers = extractUserAnswers(message.content)
    if (userAnswers) {
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
          <div className="flex flex-wrap gap-2">
            {userAnswers.map((answer, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm"
              >
                {answer}
              </span>
            ))}
          </div>
        </div>
      )
    }

    // Regular user message
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
    <>
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

        {/* Content - render as markdown */}
        {message.content && (
          <div className="text-zinc-300 leading-relaxed">
            <MarkdownContent content={message.content} className="prose-p:mb-2 prose-p:last:mb-0" />
          </div>
        )}

        {/* Questions from AskUserQuestion tool */}
        {message.questions && message.questions.length > 0 && (
          <div className="mt-3 space-y-3">
            {message.questions.map((q, qIdx) => (
              <div key={qIdx} className="rounded-lg border border-accent/30 bg-accent/5 p-4">
                {q.header && (
                  <span className="inline-block px-2 py-0.5 mb-2 rounded text-[10px] uppercase tracking-wider bg-accent/20 text-accent">
                    {q.header}
                  </span>
                )}
                <p className="text-zinc-200 font-medium mb-3">{q.question}</p>
                {q.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className="px-3 py-2 rounded-lg border border-surface-300 bg-surface-200 text-sm"
                      >
                        <span className="text-zinc-200">{opt.label}</span>
                        {opt.description && (
                          <span className="text-zinc-500 ml-2">— {opt.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* File chips for tool calls */}
        {fileChips.length > 0 && (
          <div className="mt-3">
            <FileChipGroup
              files={fileChips}
              onFileClick={handleFileClick}
            />
          </div>
        )}

        {/* Agent tasks (parallel agents) */}
        {message.agentTasks && message.agentTasks.length > 0 && (
          <div className="mt-3">
            <AgentTaskGroup tasks={message.agentTasks} />
          </div>
        )}
      </div>

      {/* File viewer modal (only if not using external handler) */}
      {!onFileClick && (
        <FileViewerModal
          open={!!selectedFile}
          onOpenChange={(open) => !open && setSelectedFile(null)}
          filePath={selectedFile}
        />
      )}
    </>
  )
}
