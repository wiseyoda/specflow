'use client'

import { cn } from '@/lib/utils'

interface GridBackgroundProps {
  className?: string
}

export function GridBackground({ className }: GridBackgroundProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 bg-grid pointer-events-none z-0',
        className
      )}
      aria-hidden="true"
    />
  )
}
