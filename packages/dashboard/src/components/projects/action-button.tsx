'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { CommandOutputModal } from '@/components/projects/command-output-modal';
import { Loader2 } from 'lucide-react';
import {
  type ActionDefinition,
  type ProjectStatus,
  getCardActionForStatus,
  getSecondaryCardAction,
} from '@/lib/action-definitions';

export interface ActionButtonProps {
  /** Project ID (UUID) */
  projectId: string;
  /** Absolute path to project */
  projectPath: string;
  /** Current project status */
  projectStatus: ProjectStatus;
  /** Whether the project path is accessible */
  isAvailable: boolean;
  /** Schema version (for migrate action) */
  schemaVersion?: string;
  /** Override with a specific action instead of deriving from status */
  action?: ActionDefinition;
  /** Callback when execution starts */
  onExecutionStart?: () => void;
  /** Callback when execution completes */
  onExecutionComplete?: (success: boolean) => void;
  /** Additional class names */
  className?: string;
}

export function ActionButton({
  projectId,
  projectPath,
  projectStatus,
  isAvailable,
  schemaVersion,
  action: actionProp,
  onExecutionStart,
  onExecutionComplete,
  className,
}: ActionButtonProps) {
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executionId, setExecutionId] = React.useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [showOutput, setShowOutput] = React.useState(false);
  const [currentAction, setCurrentAction] =
    React.useState<ActionDefinition | null>(null);

  // Get the primary action for this project status (or use provided action)
  const action = React.useMemo(() => {
    return actionProp ?? getCardActionForStatus(projectStatus);
  }, [actionProp, projectStatus]);

  // Don't render if no action available or project unavailable
  if (!action || !isAvailable) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    // Prevent card navigation
    e.preventDefault();
    e.stopPropagation();

    setCurrentAction(action);

    if (action.requiresConfirmation) {
      setShowConfirmation(true);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (actionToExecute: ActionDefinition) => {
    setIsExecuting(true);
    setShowConfirmation(false);
    onExecutionStart?.();

    try {
      const response = await fetch('/api/commands/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: actionToExecute.command,
          args: actionToExecute.args,
          projectPath,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute command');
      }

      const { executionId: execId } = await response.json();
      setExecutionId(execId);
      setShowOutput(true);
    } catch (error) {
      console.error('Failed to execute action:', error);
      setIsExecuting(false);
      onExecutionComplete?.(false);
    }
  };

  const handleConfirm = () => {
    if (currentAction) {
      executeAction(currentAction);
    }
  };

  const handleOutputComplete = (success: boolean) => {
    setIsExecuting(false);
    onExecutionComplete?.(success);
  };

  const handleOutputClose = (open: boolean) => {
    if (!open) {
      setShowOutput(false);
      setExecutionId(null);
      setCurrentAction(null);
    }
  };

  const buttonVariant = action.variant === 'destructive' ? 'destructive' :
                        action.variant === 'outline' ? 'outline' : 'default';

  return (
    <>
      <Button
        variant={buttonVariant}
        size="sm"
        onClick={handleClick}
        disabled={isExecuting}
        className={className}
      >
        {isExecuting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running...
          </>
        ) : (
          action.label
        )}
      </Button>

      {currentAction && (
        <>
          <ConfirmationDialog
            open={showConfirmation}
            onOpenChange={setShowConfirmation}
            title={currentAction.confirmationTitle || currentAction.label}
            description={currentAction.confirmationDescription}
            items={currentAction.confirmationItems}
            confirmLabel={currentAction.label}
            variant={currentAction.variant === 'destructive' ? 'destructive' : 'default'}
            onConfirm={handleConfirm}
            isLoading={isExecuting}
          />

          <CommandOutputModal
            open={showOutput}
            onOpenChange={handleOutputClose}
            command={`${currentAction.command} ${currentAction.args.join(' ')}`.trim()}
            executionId={executionId || undefined}
            projectPath={projectPath}
            onComplete={handleOutputComplete}
          />
        </>
      )}
    </>
  );
}

/**
 * Status button that appears on all project cards
 * Runs the doctor command to show project health
 */
export function StatusButton({
  projectId,
  projectPath,
  projectStatus,
  isAvailable,
  onExecutionStart,
  onExecutionComplete,
  className,
}: Omit<ActionButtonProps, 'schemaVersion' | 'action'>) {
  const action = React.useMemo(() => {
    return getSecondaryCardAction(projectStatus);
  }, [projectStatus]);

  if (!action || !isAvailable) {
    return null;
  }

  return (
    <ActionButton
      projectId={projectId}
      projectPath={projectPath}
      projectStatus={projectStatus}
      isAvailable={isAvailable}
      action={action}
      onExecutionStart={onExecutionStart}
      onExecutionComplete={onExecutionComplete}
      className={className}
    />
  );
}
