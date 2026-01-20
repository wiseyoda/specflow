'use client'

import { cn } from '@/lib/utils'
import { Bot } from 'lucide-react'

interface TypingIndicatorProps {
  statusText?: string
  className?: string
}

export function TypingIndicator({ statusText = 'Analyzing dependencies', className }: TypingIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3',
        className
      )}
    >
      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs animate-pulse">
        <Bot className="w-3 h-3" />
      </div>
      <span className="text-zinc-500">{statusText}</span>
      <span className="cursor-blink" />
    </div>
  )
}
