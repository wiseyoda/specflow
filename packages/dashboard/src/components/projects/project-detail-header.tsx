"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FolderGit2, Play, Loader2, ChevronDown, Terminal } from "lucide-react"
import { ActionsMenu } from "@/components/projects/actions-menu"
import { WorkflowStatusBadge, useWorkflowStatusFade } from "@/components/projects/workflow-status-badge"
import { QuestionBadge } from "@/components/projects/question-badge"
import { StartWorkflowDialog } from "@/components/projects/start-workflow-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkflowSkills, type WorkflowSkill } from "@/hooks/use-workflow-skills"
import type { ProjectStatus } from "@/lib/action-definitions"
import type { WorkflowExecution } from "@/lib/services/workflow-service"
import {
  toastWorkflowStarted,
  toastWorkflowError,
  toastWorkflowAlreadyRunning,
} from "@/lib/toast-helpers"

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
  /** Active workflow execution */
  workflowExecution?: WorkflowExecution | null
  /** Whether a workflow is starting */
  isStartingWorkflow?: boolean
  /** Callback to start a workflow */
  onWorkflowStart?: (skill: string) => Promise<void>
  /** Callback when question badge is clicked */
  onQuestionBadgeClick?: () => void
  /** Callback when session button is clicked */
  onSessionClick?: () => void
}

export function ProjectDetailHeader({
  project,
  projectStatus = "ready",
  schemaVersion,
  isAvailable = true,
  workflowExecution,
  isStartingWorkflow = false,
  onWorkflowStart,
  onQuestionBadgeClick,
  onSessionClick,
}: ProjectDetailHeaderProps) {
  // Workflow skills (dynamic)
  const { skills, getSkillsByGroup, isLoading: skillsLoading } = useWorkflowSkills()

  // Workflow dialog state
  const [selectedSkill, setSelectedSkill] = React.useState<WorkflowSkill | null>(null)
  const [showWorkflowDialog, setShowWorkflowDialog] = React.useState(false)

  // Workflow status handling
  const workflowStatus = workflowExecution?.status
  const { isFading, isHidden } = useWorkflowStatusFade(
    workflowStatus,
    workflowExecution?.updatedAt
  )
  const showWorkflowBadge = workflowStatus && !isHidden
  const hasActiveWorkflow = workflowStatus === 'running' || workflowStatus === 'waiting_for_input'

  // Question badge for waiting workflows
  const pendingQuestions = workflowExecution?.output?.questions ?? []
  const showQuestionBadge = workflowStatus === 'waiting_for_input' && pendingQuestions.length > 0

  // Session button visibility - show when there's an active workflow (even without session ID yet)
  const showSessionButton = hasActiveWorkflow || (workflowExecution?.sessionId && !isHidden)

  const handleSkillSelect = (skill: WorkflowSkill) => {
    setSelectedSkill(skill)
    setShowWorkflowDialog(true)
  }

  const handleWorkflowConfirm = async () => {
    if (!selectedSkill || !onWorkflowStart) return

    try {
      await onWorkflowStart(selectedSkill.command)
      toastWorkflowStarted(selectedSkill.command)
      setShowWorkflowDialog(false)
      setSelectedSkill(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('already running')) {
        toastWorkflowAlreadyRunning()
      } else {
        toastWorkflowError(message)
      }
      console.error('Failed to start workflow:', error)
    }
  }

  const handleWorkflowDialogClose = (open: boolean) => {
    if (!open && !isStartingWorkflow) {
      setShowWorkflowDialog(false)
      setSelectedSkill(null)
    }
  }

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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {project.name}
              </h1>
              {/* Workflow status badge */}
              {showWorkflowBadge && (
                <WorkflowStatusBadge
                  status={workflowStatus}
                  showLabel={true}
                  size="sm"
                  isFading={isFading}
                />
              )}
              {/* Question badge when waiting for input */}
              {showQuestionBadge && (
                <QuestionBadge
                  questionCount={pendingQuestions.length}
                  size="sm"
                  onClick={onQuestionBadgeClick}
                />
              )}
              {/* Session viewer button */}
              {showSessionButton && onSessionClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSessionClick}
                  className="h-7 px-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  aria-label="View session"
                >
                  <Terminal className="h-4 w-4 mr-1.5" />
                  <span className="text-xs">Session</span>
                </Button>
              )}
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-lg">
              {project.path}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Start Workflow button with dropdown */}
          {projectStatus === 'ready' && onWorkflowStart && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={hasActiveWorkflow || isStartingWorkflow}
                  className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
                >
                  {isStartingWorkflow ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start Workflow
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                {/* Primary skills - Orchestrate & Merge */}
                {getSkillsByGroup('primary').map((skill) => (
                  <DropdownMenuItem
                    key={skill.id}
                    onClick={() => handleSkillSelect(skill)}
                    className="cursor-pointer py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {skill.name}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                        {skill.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                {/* Workflow steps */}
                <DropdownMenuLabel className="text-[10px] text-neutral-400 uppercase tracking-wide py-1">
                  Workflow Steps
                </DropdownMenuLabel>
                {getSkillsByGroup('workflow').map((skill) => (
                  <DropdownMenuItem
                    key={skill.id}
                    onClick={() => handleSkillSelect(skill)}
                    className="cursor-pointer py-1.5"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{skill.name}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                        {skill.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                {/* Setup & Maintenance */}
                <DropdownMenuLabel className="text-[10px] text-neutral-400 uppercase tracking-wide py-1">
                  Setup & Maintenance
                </DropdownMenuLabel>
                {[...getSkillsByGroup('setup'), ...getSkillsByGroup('maintenance')].map((skill) => (
                  <DropdownMenuItem
                    key={skill.id}
                    onClick={() => handleSkillSelect(skill)}
                    className="cursor-pointer py-1.5"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{skill.name}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                        {skill.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ActionsMenu
            projectId={project.id}
            projectName={project.name}
            projectPath={project.path}
            projectStatus={projectStatus}
            schemaVersion={schemaVersion}
            isAvailable={isAvailable}
            hasActiveWorkflow={hasActiveWorkflow}
            onWorkflowStart={onWorkflowStart}
          />
        </div>
      </div>

      {/* Start Workflow Dialog */}
      <StartWorkflowDialog
        open={showWorkflowDialog}
        onOpenChange={handleWorkflowDialogClose}
        skill={selectedSkill}
        projectName={project.name}
        onConfirm={handleWorkflowConfirm}
        isLoading={isStartingWorkflow}
      />
    </div>
  )
}
