/**
 * Action definitions for project lifecycle management
 * These define the available actions that can be performed on projects from the dashboard
 */

export type ProjectStatus =
  | 'not_initialized'
  | 'initializing'
  | 'needs_setup'
  | 'ready'
  | 'error'
  | 'warning';

export type ActionGroup = 'setup' | 'maintenance' | 'advanced';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary';

export interface ActionDefinition {
  /** Unique identifier for the action */
  id: string;
  /** Display label for buttons and menus */
  label: string;
  /** Short description for tooltips */
  description: string;
  /** CLI command to execute (e.g., "init", "doctor") */
  command: string;
  /** Default arguments to pass to the command */
  args: string[];
  /** Whether confirmation dialog is required before execution */
  requiresConfirmation: boolean;
  /** Title for confirmation dialog */
  confirmationTitle?: string;
  /** Description text for confirmation dialog */
  confirmationDescription?: string;
  /** Bullet list of what will happen (for confirmation dialog) */
  confirmationItems?: string[];
  /** Project statuses where this action is applicable */
  applicableStatuses: ProjectStatus[];
  /** Button styling variant */
  variant: ButtonVariant;
  /** Menu group for dropdown organization */
  group: ActionGroup;
  /** Show as primary action on project card (only one per status) */
  showOnCard?: boolean;
  /** Show as secondary/always-visible action on card (e.g., Status button) */
  isSecondaryCardAction?: boolean;
}

/**
 * All available project actions
 *
 * SpecFlow CLI v3.0 commands:
 * - status: Get complete project status
 * - check: Deep validation with auto-fix support
 * - state init: Initialize a new state file
 * - phase: Manage phase lifecycle
 */
export const ACTION_DEFINITIONS: ActionDefinition[] = [
  // Setup actions
  {
    id: 'init',
    label: 'Initialize',
    description: 'Initialize SpecFlow state for this project',
    command: 'state',
    args: ['init'],
    requiresConfirmation: true,
    confirmationTitle: 'Initialize Project',
    confirmationDescription: 'This will create a new orchestration state file.',
    confirmationItems: [
      '.specify/ directory',
      'orchestration-state.json',
      'Project registration',
    ],
    applicableStatuses: ['not_initialized'],
    variant: 'default',
    group: 'setup',
    showOnCard: true,
  },

  // Maintenance actions
  {
    id: 'status',
    label: 'Status',
    description: 'Get complete project status',
    command: 'status',
    args: [],
    requiresConfirmation: false,
    applicableStatuses: ['not_initialized', 'initializing', 'needs_setup', 'ready', 'warning', 'error'],
    variant: 'outline',
    group: 'maintenance',
    showOnCard: true,
    isSecondaryCardAction: true,
  },
  {
    id: 'check',
    label: 'Validate',
    description: 'Run deep validation checks',
    command: 'check',
    args: [],
    requiresConfirmation: false,
    applicableStatuses: ['ready', 'warning', 'error'],
    variant: 'outline',
    group: 'maintenance',
    showOnCard: false,
  },
  {
    id: 'check-fix',
    label: 'Auto-Fix Issues',
    description: 'Validate and automatically fix issues',
    command: 'check',
    args: ['--fix'],
    requiresConfirmation: true,
    confirmationTitle: 'Auto-Fix Issues',
    confirmationDescription: 'This will validate and attempt to automatically fix detected issues.',
    confirmationItems: [
      'Create missing artifacts',
      'Fix state inconsistencies',
      'Repair broken references',
    ],
    applicableStatuses: ['warning', 'error'],
    variant: 'default',
    group: 'maintenance',
    showOnCard: true,
  },

  // Advanced actions
  {
    id: 'state-sync',
    label: 'Sync State',
    description: 'Sync state with filesystem',
    command: 'state',
    args: ['sync'],
    requiresConfirmation: false,
    applicableStatuses: ['ready', 'warning'],
    variant: 'secondary',
    group: 'advanced',
    showOnCard: false,
  },
];

/**
 * Get all actions applicable to a given project status
 */
export function getActionsForStatus(status: ProjectStatus): ActionDefinition[] {
  return ACTION_DEFINITIONS.filter((action) =>
    action.applicableStatuses.includes(status)
  );
}

/**
 * Get the primary action for card display based on project status
 */
export function getCardActionForStatus(
  status: ProjectStatus
): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find(
    (action) =>
      action.showOnCard &&
      !action.isSecondaryCardAction &&
      action.applicableStatuses.includes(status)
  );
}

/**
 * Get the secondary/always-visible action for card display (e.g., Status button)
 */
export function getSecondaryCardAction(
  status: ProjectStatus
): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find(
    (action) =>
      action.showOnCard &&
      action.isSecondaryCardAction &&
      action.applicableStatuses.includes(status)
  );
}

/**
 * Get actions organized by group for menu display
 */
export function getActionsByGroup(
  status: ProjectStatus
): Record<ActionGroup, ActionDefinition[]> {
  const actions = getActionsForStatus(status);

  return {
    setup: actions.filter((a) => a.group === 'setup'),
    maintenance: actions.filter((a) => a.group === 'maintenance'),
    advanced: actions.filter((a) => a.group === 'advanced'),
  };
}

/**
 * Get an action by its ID
 */
export function getActionById(id: string): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((action) => action.id === id);
}

/**
 * Check if schema version is outdated (for informational display)
 * Note: Migration is no longer available in CLI v3.0
 */
export function isSchemaOutdated(schemaVersion?: string): boolean {
  if (!schemaVersion) return false;
  // Outdated if not starting with "3."
  return !schemaVersion.startsWith('3.');
}
