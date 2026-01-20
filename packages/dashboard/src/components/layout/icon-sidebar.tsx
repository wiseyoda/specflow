'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { SidebarNavItem } from './sidebar-nav-item'
import {
  LayoutDashboard,
  Terminal,
  CheckSquare,
  History,
  Bell,
  Settings,
} from 'lucide-react'

export type ViewType = 'dashboard' | 'session' | 'tasks' | 'history'

interface IconSidebarProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  sessionIndicator?: 'live' | 'warning' | null
  hasNotifications?: boolean
  className?: string
}

const navItems: Array<{
  id: ViewType
  icon: typeof LayoutDashboard
  label: string
  hotkey: string
}> = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', hotkey: '⌘1' },
  { id: 'session', icon: Terminal, label: 'Session', hotkey: '⌘2' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks', hotkey: '⌘3' },
  { id: 'history', icon: History, label: 'History', hotkey: '⌘4' },
]

export function IconSidebar({
  activeView,
  onViewChange,
  sessionIndicator = null,
  hasNotifications = false,
  className,
}: IconSidebarProps) {
  return (
    <aside
      className={cn(
        'w-16 flex flex-col items-center py-4 border-r border-surface-300/50 bg-surface-100/80 backdrop-blur-xl z-[100]',
        className
      )}
    >
      {/* Logo - links back to project list */}
      <Link
        href="/"
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/25 mb-6 cursor-pointer hover:scale-110 hover:shadow-accent/40 transition-all duration-200"
        title="Back to Projects"
      >
        SF
      </Link>

      {/* Main navigation */}
      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-2">
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            hotkey={item.hotkey}
            isActive={activeView === item.id}
            indicator={item.id === 'session' ? sessionIndicator : null}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        <SidebarNavItem
          icon={Bell}
          label="Notifications"
          indicator={hasNotifications ? 'warning' : null}
          onClick={() => {}}
        />
        <SidebarNavItem
          icon={Settings}
          label="Settings"
          onClick={() => {}}
        />
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-surface-300 cursor-pointer hover:ring-accent/50 transition-all" />
      </div>
    </aside>
  )
}
