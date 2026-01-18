/**
 * Allowed specflow commands (security allowlist)
 * Commands not in this list will be hidden from the UI and rejected by the executor
 *
 * SpecFlow CLI v3.0 commands:
 * - status: Get complete project status
 * - next: Get next actionable task with context
 * - mark: Mark task(s) complete/incomplete/blocked
 * - check: Deep validation with auto-fix support
 * - state: Manage orchestration state (get/set/init/reset)
 * - phase: Manage phase lifecycle (status/open/close/defer/add)
 */
export const ALLOWED_COMMANDS = new Set([
  'help',
  'version',
  'status',
  'next',
  'mark',
  'check',
  'state',
  'phase',
]);

/**
 * Commands that can run without a project selected (global commands)
 */
export const GLOBAL_COMMANDS = new Set([
  'help',
  'version',
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
