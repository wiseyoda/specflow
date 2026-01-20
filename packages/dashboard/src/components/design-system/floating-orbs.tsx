'use client'

import { cn } from '@/lib/utils'

interface FloatingOrbsProps {
  className?: string
}

export function FloatingOrbs({ className }: FloatingOrbsProps) {
  return (
    <div
      className={cn('fixed inset-0 overflow-hidden pointer-events-none z-0', className)}
      aria-hidden="true"
    >
      {/* Top-left orb - accent color with large blur */}
      <div
        className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px] animate-float"
      />

      {/* Bottom-right orb - purple with blur */}
      <div
        className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[80px] animate-float"
        style={{ animationDelay: '-3s' }}
      />
    </div>
  )
}
