/**
 * Allowed speckit commands (security allowlist)
 * Commands not in this list will be hidden from the UI and rejected by the executor
 */
export const ALLOWED_COMMANDS = new Set([
  'help',
  'init',
  'issue',
  'tasks',
  'phase',
  'state',
  'status',
  'roadmap',
  'gate',
  'doctor',
  'context',
  'feature',
  'scaffold',
  'lessons',
  'templates',
  'reconcile',
]);

/**
 * Commands that can run without a project selected (global commands)
 */
export const GLOBAL_COMMANDS = new Set([
  'help',
]);

/**
 * Check if a command is allowed
 */
export function isCommandAllowed(command: string): boolean {
  const baseCommand = command.split(' ')[0];
  return ALLOWED_COMMANDS.has(baseCommand);
}

/**
 * Check if a command can run without a project
 */
export function isGlobalCommand(command: string): boolean {
  const baseCommand = command.split(' ')[0];
  return GLOBAL_COMMANDS.has(baseCommand);
}
