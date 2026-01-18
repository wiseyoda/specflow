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
 */
export const ACTION_DEFINITIONS: ActionDefinition[] = [
  // Setup actions
  {
    id: 'init',
    label: 'Initialize',
    description: 'Initialize SpecFlow for this project',
    command: 'init',
    args: ['--non-interactive'],
    requiresConfirmation: true,
    confirmationTitle: 'Initialize Project',
    confirmationDescription: 'This will set up SpecFlow for this project.',
    confirmationItems: [
      '.specify/ directory',
      'orchestration-state.json',
      'memory/ subdirectory',
      'Register with SpecFlow',
    ],
    applicableStatuses: ['not_initialized'],
    variant: 'default',
    group: 'setup',
    showOnCard: true,
  },
  {
    id: 'scaffold',
    label: 'Scaffold',
    description: 'Create project structure with required directories',
    command: 'scaffold',
    args: [],
    requiresConfirmation: true,
    confirmationTitle: 'Scaffold Project',
    confirmationDescription: 'This will create the recommended project structure.',
    confirmationItems: [
      '.specify/memory/ directory',
      '.specify/phases/ directory',
      'ROADMAP.md (if missing)',
      'Template files',
    ],
    applicableStatuses: ['needs_setup', 'ready', 'warning'],
    variant: 'outline',
    group: 'setup',
    showOnCard: false,
  },

  // Maintenance actions
  {
    id: 'doctor',
    label: 'Status',
    description: 'Check project health and configuration',
    command: 'doctor',
    args: [],
    requiresConfirmation: false,
    applicableStatuses: ['not_initialized', 'initializing', 'needs_setup', 'ready', 'warning', 'error'],
    variant: 'outline',
    group: 'maintenance',
    showOnCard: true,
    isSecondaryCardAction: true,
  },
  {
    id: 'doctor-fix',
    label: 'Doctor (Auto-Fix)',
    description: 'Diagnose and automatically fix issues',
    command: 'doctor',
    args: ['--fix'],
    requiresConfirmation: true,
    confirmationTitle: 'Auto-Fix Issues',
    confirmationDescription: 'This will attempt to automatically fix detected issues.',
    confirmationItems: [
      'Create missing directories',
      'Fix configuration errors',
      'Update outdated templates',
    ],
    applicableStatuses: ['warning', 'error'],
    variant: 'default',
    group: 'maintenance',
    showOnCard: true,
  },

  // Advanced actions
  {
    id: 'migrate',
    label: 'Migrate to v2',
    description: 'Migrate state file from v1 to v2 schema',
    command: 'state',
    args: ['migrate'],
    requiresConfirmation: true,
    confirmationTitle: 'Migrate to v2 Schema',
    confirmationDescription: 'This will upgrade your state file to the v2 schema.',
    confirmationItems: [
      'Add project UUID',
      'Update schema version',
      'Preserve existing data',
      'Backup created automatically',
    ],
    applicableStatuses: ['ready', 'warning', 'error'],
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
 * Check if any action requires schema version check (for migrate)
 */
export function shouldShowMigrateAction(schemaVersion?: string): boolean {
  if (!schemaVersion) return false;
  // Show migrate if schema version starts with "1."
  return schemaVersion.startsWith('1.');
}
