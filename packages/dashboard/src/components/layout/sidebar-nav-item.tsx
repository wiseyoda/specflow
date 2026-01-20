'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface SidebarNavItemProps {
  icon: LucideIcon
  label: string
  hotkey?: string
  isActive?: boolean
  indicator?: 'live' | 'warning' | null
  onClick?: () => void
}

export function SidebarNavItem({
  icon: Icon,
  label,
  hotkey,
  isActive = false,
  indicator = null,
  onClick,
}: SidebarNavItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Calculate tooltip position when hovered
  useEffect(() => {
    if (isHovered && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 12, // 12px gap from button
      })
    }
  }, [isHovered])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200',
          isActive
            ? 'text-white bg-white/10 shadow-lg shadow-black/20'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
        )}
        aria-label={label}
      >
        {/* Active indicator pip */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-r-full shadow-lg shadow-accent/50" />
        )}

        <Icon className="w-5 h-5" />

        {/* Live/warning indicator dot */}
        {indicator && (
          <span
            className={cn(
              'absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse',
              indicator === 'live' ? 'bg-success' : 'bg-warning'
            )}
          />
        )}
      </button>

      {/* Tooltip - Fixed position to break out of stacking context */}
      {isHovered && (
        <div
          className="fixed px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-[99999] -translate-y-1/2"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">{label}</span>
            {hotkey && (
              <kbd className="px-1.5 py-0.5 rounded bg-surface-300 text-zinc-500 text-[10px] font-mono">
                {hotkey}
              </kbd>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
