"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, FolderGit2, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  path: string
  registered_at: string
  last_seen?: string
}

interface ProjectCardProps {
  project: Project
  isUnavailable?: boolean
}

export function ProjectCard({ project, isUnavailable = false }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const registeredDate = new Date(project.registered_at).toLocaleDateString()
  const lastSeenDate = project.last_seen
    ? new Date(project.last_seen).toLocaleDateString()
    : "Never"

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50",
        isUnavailable && "opacity-60"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-neutral-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-500 flex-shrink-0" />
          )}
          <FolderGit2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                {project.name}
              </h3>
              {isUnavailable && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                  <AlertCircle className="h-3 w-3" />
                  Unavailable
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
              {project.path}
            </p>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 ml-11 pl-4 border-l-2 border-neutral-200 dark:border-neutral-800">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Registered</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">{registeredDate}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Last Seen</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">{lastSeenDate}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-neutral-500 dark:text-neutral-400">Project ID</dt>
                <dd className="font-mono text-xs text-neutral-600 dark:text-neutral-400 break-all">
                  {project.id}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
