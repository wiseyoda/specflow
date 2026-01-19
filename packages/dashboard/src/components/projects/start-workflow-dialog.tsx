'use client';

/**
 * Start Workflow Dialog component
 *
 * Confirmation dialog shown before starting a workflow.
 * Shows the selected skill and project name.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import type { WorkflowSkill } from '@/hooks/use-workflow-skills';

export interface StartWorkflowDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The selected skill to start */
  skill: WorkflowSkill | null;
  /** The project name to display */
  projectName: string;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Whether the workflow is being started */
  isLoading?: boolean;
}

/**
 * Confirmation dialog before starting a workflow
 */
export function StartWorkflowDialog({
  open,
  onOpenChange,
  skill,
  projectName,
  onConfirm,
  isLoading = false,
}: StartWorkflowDialogProps) {
  const handleCancel = React.useCallback(() => {
    if (!isLoading) {
      onOpenChange(false);
    }
  }, [isLoading, onOpenChange]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isLoading) {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, handleCancel]);

  if (!skill) return null;

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (isLoading) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Start Workflow
          </DialogTitle>
          <DialogDescription>
            You&apos;re about to start a workflow on this project.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Skill
            </span>
            <span className="font-medium">{skill.command}</span>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {skill.description}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Project
            </span>
            <span className="font-medium">{projectName}</span>
          </div>

          <div className="pt-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              This will:
            </p>
            <ul className="space-y-1">
              <li className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-400">•</span>
                <span>Begin an AI-assisted workflow session</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-400">•</span>
                <span>May ask questions that require your input</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-400">•</span>
                <span>Create or modify project artifacts</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
