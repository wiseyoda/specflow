import Link from "next/link"
import { FolderGit2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "w-64 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col",
        className
      )}
    >
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          SpecFlow
        </h1>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          <li>
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-neutral-200/50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            >
              Projects
            </Link>
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          SpecFlow Dashboard v0.1.0
        </p>
      </div>
    </aside>
  )
}
