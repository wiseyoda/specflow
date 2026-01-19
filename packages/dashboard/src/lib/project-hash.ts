/**
 * Calculate the project directory name used by Claude Code.
 * Claude stores session files in ~/.claude/projects/{dirName}/ where dirName is
 * the project path with slashes replaced by dashes.
 *
 * Examples:
 *   /Users/dev/myproject -> -Users-dev-myproject
 *   /home/user/project   -> -home-user-project
 *
 * @param projectPath - Absolute path to the project directory
 * @returns Directory name with slashes replaced by dashes
 */
export function calculateProjectHash(projectPath: string): string {
  // Claude Code uses path with slashes replaced by dashes
  // e.g., /Users/ppatterson/dev/specflow -> -Users-ppatterson-dev-specflow
  return projectPath.replace(/\//g, '-');
}

/**
 * Get the Claude projects directory path.
 * @returns Path to ~/.claude/projects/
 */
export function getClaudeProjectsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return `${home}/.claude/projects`;
}

/**
 * Get the session directory for a specific project.
 * @param projectPath - Absolute path to the project
 * @returns Path to ~/.claude/projects/{hash}/
 */
export function getProjectSessionDir(projectPath: string): string {
  const hash = calculateProjectHash(projectPath);
  return `${getClaudeProjectsDir()}/${hash}`;
}
