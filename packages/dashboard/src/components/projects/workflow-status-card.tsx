'use client';

/**
 * Workflow Status Card component
 *
 * Full status display for project detail view showing:
 * - Skill name
 * - Current status
 * - Elapsed time
 * - Cancel button for active workflows
 * - Start button when no workflow active
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Loader2,
  XCircle,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { WorkflowStatusBadge } from '@/components/projects/workflow-status-badge';
import { useWorkflowSkills, type WorkflowSkill } from '@/hooks/use-workflow-skills';
import type { WorkflowExecution } from '@/lib/services/workflow-service';

interface WorkflowStatusCardProps {
  /** Active workflow execution, or null if none */
  execution: WorkflowExecution | null;
  /** Whether a workflow is being started */
  isStarting?: boolean;
  /** Whether the workflow is being cancelled */
  isCancelling?: boolean;
  /** Callback to start a workflow */
  onStart?: (skill: WorkflowSkill) => void;
  /** Callback to cancel the workflow */
  onCancel?: () => void;
}

/**
 * Format elapsed time as human-readable string
 */
function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsedMs = now - start;

  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get status message for the workflow state
 */
function getStatusMessage(status: WorkflowExecution['status']): string {
  switch (status) {
    case 'running':
      return 'Workflow is executing...';
    case 'waiting_for_input':
      return 'Waiting for your input';
    case 'completed':
      return 'Workflow completed successfully';
    case 'failed':
      return 'Workflow failed';
    case 'cancelled':
      return 'Workflow was cancelled';
  }
}

/**
 * Workflow status card for project detail view
 */
export function WorkflowStatusCard({
  execution,
  isStarting = false,
  isCancelling = false,
  onStart,
  onCancel,
}: WorkflowStatusCardProps) {
  const { getSkillsByGroup } = useWorkflowSkills();
  const isActive =
    execution?.status === 'running' || execution?.status === 'waiting_for_input';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Workflow Status
          </div>
          {execution && (
            <WorkflowStatusBadge
              status={execution.status}
              showLabel={false}
              size="sm"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {execution ? (
          <div className="space-y-4">
            {/* Skill name */}
            <div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                Skill
              </div>
              <div className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                {execution.skill}
              </div>
            </div>

            {/* Status */}
            <div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                Status
              </div>
              <div className="text-neutral-900 dark:text-neutral-100">
                {getStatusMessage(execution.status)}
              </div>
            </div>

            {/* Elapsed time (only for active workflows) */}
            {isActive && (
              <div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Elapsed Time
                </div>
                <div className="text-neutral-900 dark:text-neutral-100 font-mono">
                  {formatElapsedTime(execution.startedAt)}
                </div>
              </div>
            )}

            {/* Result summary (for completed workflows) */}
            {execution.status === 'completed' && execution.output?.message && (
              <div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Result
                </div>
                <div className="text-neutral-900 dark:text-neutral-100">
                  {execution.output.message}
                </div>
              </div>
            )}

            {/* Error message (for failed workflows) */}
            {execution.status === 'failed' && execution.error && (
              <div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Error
                </div>
                <div className="text-red-600 dark:text-red-400 text-sm">
                  {execution.error}
                </div>
              </div>
            )}

            {/* Cancel button (only for active workflows) */}
            {isActive && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isCancelling}
                className="w-full"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Cancel Workflow
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-neutral-500 dark:text-neutral-400">
              No active workflow
            </div>

            {/* Start workflow button */}
            {onStart && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isStarting}
                    className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
                  >
                    {isStarting ? (
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
                      onClick={() => onStart(skill)}
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
                      onClick={() => onStart(skill)}
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
                      onClick={() => onStart(skill)}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
