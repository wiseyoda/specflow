"use client"

import Link from "next/link"
import { ArrowLeft, FolderGit2 } from "lucide-react"
import { ActionsMenu } from "@/components/projects/actions-menu"
import type { ProjectStatus } from "@/lib/action-definitions"

interface Project {
  id: string
  name: string
  path: string
}

interface ProjectDetailHeaderProps {
  project: Project
  projectStatus?: ProjectStatus
  schemaVersion?: string
  isAvailable?: boolean
}

export function ProjectDetailHeader({
  project,
  projectStatus = "ready",
  schemaVersion,
  isAvailable = true,
}: ProjectDetailHeaderProps) {
  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-2">
        <Link
          href="/"
          className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Projects</span>
        </Link>
        <span>/</span>
        <span className="text-neutral-700 dark:text-neutral-200">{project.name}</span>
      </div>

      {/* Project Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderGit2 className="h-6 w-6 text-neutral-600 dark:text-neutral-400" />
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {project.name}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-lg">
              {project.path}
            </p>
          </div>
        </div>

        <ActionsMenu
          projectId={project.id}
          projectPath={project.path}
          projectStatus={projectStatus}
          schemaVersion={schemaVersion}
          isAvailable={isAvailable}
        />
      </div>
    </div>
  )
}
