"use client"

import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  className?: string
  children?: React.ReactNode
}

export function Header({ className, children }: HeaderProps) {
  return (
    <header
      className={cn(
        "h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between px-6",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Projects
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-neutral-500 dark:text-neutral-400"
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          }}
        >
          <span className="text-xs">Search</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-neutral-200 bg-neutral-100 px-1.5 font-mono text-[10px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        <ModeToggle />
      </div>
    </header>
  )
}
