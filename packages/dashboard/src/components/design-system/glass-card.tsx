'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass rounded-lg p-4',
        hover && 'transition-colors hover:bg-surface-200/80',
        className
      )}
    >
      {children}
    </div>
  )
}
