import { FolderOpen } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mb-4" />
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
        No projects registered
      </h3>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
        Run <code className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">speckit init</code> in a project directory to register it with SpecKit.
      </p>
    </div>
  )
}
