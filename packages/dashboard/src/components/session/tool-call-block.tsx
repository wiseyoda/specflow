'use client'

import { cn } from '@/lib/utils'

interface ToolCallBlockProps {
  toolName: string
  filePath?: string
  content: string
  linesChanged?: number
  className?: string
}

export function ToolCallBlock({
  toolName,
  filePath,
  content,
  linesChanged,
  className,
}: ToolCallBlockProps) {
  // Calculate lines changed if not provided
  const lines = linesChanged ?? content.split('\n').length

  return (
    <div className={cn('bg-surface-100 rounded-lg border border-surface-300 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-200 border-b border-surface-300">
        <div className="flex items-center gap-2">
          {toolName && (
            <span className="text-xs font-mono text-accent">{toolName}</span>
          )}
          {filePath && (
            <span className="text-xs text-zinc-500">{filePath}</span>
          )}
        </div>
        {lines > 0 && (
          <span className="text-[10px] text-success">+{lines} lines</span>
        )}
      </div>

      {/* Code content */}
      <pre className="p-4 text-xs overflow-x-auto custom-scrollbar">
        <code className="text-emerald-300 font-mono">{content}</code>
      </pre>
    </div>
  )
}
