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

/**
 * Find the most recently created session file for a project.
 * Used as fallback when session ID isn't available from CLI output yet.
 *
 * @param projectPath - Absolute path to the project
 * @param afterTimestamp - Only consider sessions created after this timestamp (ISO string)
 * @returns Session ID of most recent session, or null if none found
 */
export function findRecentSessionFile(
  projectPath: string,
  afterTimestamp?: string
): string | null {
  const { readdirSync, statSync } = require('fs');
  const { join, basename } = require('path');

  const sessionDir = getProjectSessionDir(projectPath);

  try {
    const files = readdirSync(sessionDir);
    const jsonlFiles = files.filter((f: string) => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) return null;

    // Get file stats and filter by timestamp if provided
    const afterTime = afterTimestamp ? new Date(afterTimestamp).getTime() : 0;

    const fileStats = jsonlFiles
      .map((f: string) => {
        const fullPath = join(sessionDir, f);
        try {
          const stats = statSync(fullPath);
          return {
            sessionId: basename(f, '.jsonl'),
            mtime: stats.mtime.getTime(),
            birthtime: stats.birthtime.getTime(),
          };
        } catch {
          return null;
        }
      })
      .filter((s: { sessionId: string; mtime: number; birthtime: number } | null): s is { sessionId: string; mtime: number; birthtime: number } => s !== null)
      .filter((s: { birthtime: number }) => s.birthtime >= afterTime - 5000); // 5 second tolerance

    if (fileStats.length === 0) return null;

    // Sort by mtime descending (most recently modified first)
    fileStats.sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);

    return fileStats[0].sessionId;
  } catch {
    return null;
  }
}
