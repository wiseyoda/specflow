'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { CommandOutputModal } from '@/components/projects/command-output-modal';
import {
  MoreHorizontal,
  Play,
  Wrench,
  Settings,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react';
import {
  type ActionDefinition,
  type ProjectStatus,
  getActionsByGroup,
  shouldShowMigrateAction,
} from '@/lib/action-definitions';

export interface ActionsMenuProps {
  /** Project ID (UUID) */
  projectId: string;
  /** Absolute path to project */
  projectPath: string;
  /** Current project status */
  projectStatus: ProjectStatus;
  /** Schema version (for migrate action) */
  schemaVersion?: string;
  /** Whether the project path is accessible */
  isAvailable: boolean;
  /** Callback when execution starts */
  onExecutionStart?: () => void;
  /** Callback when execution completes */
  onExecutionComplete?: (success: boolean) => void;
}

const GROUP_LABELS: Record<string, { label: string; icon: typeof Play }> = {
  setup: { label: 'Setup', icon: Play },
  maintenance: { label: 'Maintenance', icon: Wrench },
  advanced: { label: 'Advanced', icon: Settings },
};

export function ActionsMenu({
  projectId,
  projectPath,
  projectStatus,
  schemaVersion,
  isAvailable,
  onExecutionStart,
  onExecutionComplete,
}: ActionsMenuProps) {
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executionId, setExecutionId] = React.useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [showOutput, setShowOutput] = React.useState(false);
  const [currentAction, setCurrentAction] =
    React.useState<ActionDefinition | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Get actions grouped by category
  const actionsByGroup = React.useMemo(() => {
    const groups = getActionsByGroup(projectStatus);

    // Filter out migrate action if not applicable
    if (!shouldShowMigrateAction(schemaVersion)) {
      groups.advanced = groups.advanced.filter((a) => a.id !== 'migrate');
    }

    return groups;
  }, [projectStatus, schemaVersion]);

  // Check if we have any actions to show
  const hasActions = Object.values(actionsByGroup).some(
    (actions) => actions.length > 0
  );

  if (!hasActions || !isAvailable) {
    return null;
  }

  const handleActionClick = (action: ActionDefinition) => {
    setCurrentAction(action);
    setIsOpen(false);

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

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isExecuting}>
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <MoreHorizontal className="h-4 w-4 mr-1" />
                Actions
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {Object.entries(actionsByGroup).map(([group, actions], groupIndex) => {
            if (actions.length === 0) return null;

            const groupConfig = GROUP_LABELS[group];
            const GroupIcon = groupConfig?.icon || Settings;

            return (
              <React.Fragment key={group}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-neutral-500">
                  <GroupIcon className="h-3 w-3" />
                  {groupConfig?.label || group}
                </DropdownMenuLabel>
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span>{action.label}</span>
                      <span className="text-xs text-neutral-500">
                        {action.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {currentAction && (
        <>
          <ConfirmationDialog
            open={showConfirmation}
            onOpenChange={setShowConfirmation}
            title={currentAction.confirmationTitle || currentAction.label}
            description={currentAction.confirmationDescription}
            items={currentAction.confirmationItems}
            confirmLabel={currentAction.label}
            variant={
              currentAction.variant === 'destructive' ? 'destructive' : 'default'
            }
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
