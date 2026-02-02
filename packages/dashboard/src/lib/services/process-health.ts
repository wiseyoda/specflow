/**
 * Process Health - Health detection for CLI processes
 *
 * Checks process health based on:
 * - PID liveness (is the process still running?)
 * - Session file staleness (when was output last written?)
 */

import { existsSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join } from 'path';
import type { WorkflowExecution } from './workflow-service';
import { isPidAlive, readPidFile } from './process-spawner';
import { getProjectSessionDir } from '@/lib/project-hash';

/**
 * Read only the tail of a file efficiently (without loading the entire file).
 * Returns the last `bytes` of the file as a string.
 */
export function readFileTail(filePath: string, bytes: number = 10000): string {
  try {
    const stats = statSync(filePath);
    const fileSize = stats.size;
    const readSize = Math.min(bytes, fileSize);
    const position = Math.max(0, fileSize - readSize);

    const fd = openSync(filePath, 'r');
    const buffer = Buffer.alloc(readSize);
    readSync(fd, buffer, 0, readSize, position);
    closeSync(fd);

    return buffer.toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Staleness threshold - if session file hasn't been updated in this time,
 * consider the process potentially stuck
 */
export const STALENESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Orphan grace period - don't kill processes younger than this
 * to allow them to be properly tracked
 */
export const ORPHAN_GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes

export type ProcessHealthStatus =
  | 'running' // PID alive and file recently updated
  | 'stale' // PID alive but file hasn't updated in 5+ minutes
  | 'dead' // PID no longer exists
  | 'unknown'; // Can't determine (no PID tracked)

export interface ProcessHealthResult {
  healthStatus: ProcessHealthStatus;
  bashPid: number | null;
  claudePid: number | null;
  bashAlive: boolean;
  claudeAlive: boolean;
  sessionFileMtime: Date | null;
  sessionFileAge: number | null; // milliseconds since last update
  isStale: boolean;
}

/**
 * Get the modification time of a session file
 */
export function getSessionFileMtime(
  projectPath: string,
  sessionId: string
): Date | null {
  const sessionDir = getProjectSessionDir(projectPath);
  const sessionFile = join(sessionDir, `${sessionId}.jsonl`);

  try {
    if (existsSync(sessionFile)) {
      const stats = statSync(sessionFile);
      return stats.mtime;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get workflow directory from execution
 */
function getWorkflowDir(execution: WorkflowExecution, projectPath: string): string {
  return join(projectPath, '.specflow', 'workflows', execution.id);
}

/**
 * Check the health of a workflow process
 *
 * Health assessment logic:
 * - PID alive + file recent → 'running'
 * - PID dead → 'dead'
 * - PID alive + file stale (5+ min) → 'stale'
 * - Unknown PID → 'unknown'
 */
export function checkProcessHealth(
  execution: WorkflowExecution,
  projectPath: string
): ProcessHealthResult {
  const result: ProcessHealthResult = {
    healthStatus: 'unknown',
    bashPid: null,
    claudePid: null,
    bashAlive: false,
    claudeAlive: false,
    sessionFileMtime: null,
    sessionFileAge: null,
    isStale: false,
  };

  // Read PID file
  const workflowDir = getWorkflowDir(execution, projectPath);
  const pids = readPidFile(workflowDir);

  if (pids) {
    result.bashPid = pids.bashPid || null;
    result.claudePid = pids.claudePid || null;

    // Check if PIDs are alive
    if (result.bashPid) {
      result.bashAlive = isPidAlive(result.bashPid);
    }
    if (result.claudePid) {
      result.claudeAlive = isPidAlive(result.claudePid);
    }
  } else if (execution.pid) {
    // Fallback to execution.pid (old style)
    result.bashPid = execution.pid;
    result.bashAlive = isPidAlive(execution.pid);
  }

  // Check session file freshness
  if (execution.sessionId) {
    result.sessionFileMtime = getSessionFileMtime(projectPath, execution.sessionId);
    if (result.sessionFileMtime) {
      result.sessionFileAge = Date.now() - result.sessionFileMtime.getTime();
      result.isStale = result.sessionFileAge > STALENESS_THRESHOLD_MS;
    }
  }

  // Determine health status
  const hasAlivePid = result.bashAlive || result.claudeAlive;
  const hasPid = result.bashPid !== null || result.claudePid !== null || execution.pid !== undefined;

  if (!hasPid) {
    // No PID tracked at all
    result.healthStatus = 'unknown';
  } else if (!hasAlivePid) {
    // PIDs exist but none are alive
    result.healthStatus = 'dead';
  } else if (result.isStale) {
    // PID alive but file stale
    result.healthStatus = 'stale';
  } else {
    // PID alive and file recent (or no file to check)
    result.healthStatus = 'running';
  }

  return result;
}

/**
 * Check if a workflow should be marked as failed based on process health
 */
export function shouldMarkAsFailed(health: ProcessHealthResult): boolean {
  return health.healthStatus === 'dead';
}

/**
 * Check if a workflow should be marked as stale
 */
export function shouldMarkAsStale(health: ProcessHealthResult): boolean {
  return health.healthStatus === 'stale';
}

/**
 * Get a human-readable description of the health status
 */
export function getHealthStatusMessage(health: ProcessHealthResult): string {
  switch (health.healthStatus) {
    case 'running':
      return 'Process is running normally';
    case 'stale':
      const ageMinutes = health.sessionFileAge
        ? Math.floor(health.sessionFileAge / 60000)
        : 5;
      return `Session inactive (no updates in ${ageMinutes}+ minutes)`;
    case 'dead':
      return 'Process terminated unexpectedly';
    case 'unknown':
      return 'Unable to determine process status';
    default:
      return 'Unknown status';
  }
}

/**
 * Session status as determined from file content analysis.
 * This is the SINGLE SOURCE OF TRUTH for session status.
 */
export type SessionFileStatus =
  | 'completed'        // Session ended (has end marker or assistant finished responding)
  | 'waiting_for_input' // AskUserQuestion pending
  | 'running'          // Active, no end markers
  | 'stale';           // No activity for 5+ minutes, no end markers

/**
 * Determine session status from file content.
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR SESSION STATUS.
 *
 * All other code should use this function rather than implementing
 * their own status detection logic.
 *
 * @param tail - Last ~10KB of session JSONL file
 * @param ageMs - Milliseconds since file was last modified
 * @returns Session status
 */
export function getSessionStatus(tail: string, ageMs: number): SessionFileStatus {
  if (!tail) {
    return ageMs <= STALENESS_THRESHOLD_MS ? 'running' : 'stale';
  }

  // Check for definitive end markers
  const hasStopHook = tail.includes('"isMeta":true') && tail.includes('Stop hook feedback:');
  const hasResult = tail.includes('"type":"result"');
  const hasTurnDuration = tail.includes('"subtype":"turn_duration"');
  const hasSummary = tail.includes('"type":"summary"');
  const hasDefinitiveEnd = hasStopHook || hasResult || hasTurnDuration || hasSummary;

  if (hasDefinitiveEnd) {
    return 'completed';
  }

  // Check for AskUserQuestion pending (only valid if not stale)
  const needsInput = tail.includes('"status":"needs_input"');
  if (needsInput && ageMs <= STALENESS_THRESHOLD_MS) {
    return 'waiting_for_input';
  }

  // Check if last message is an assistant text response (session idle, turn complete)
  let lastMessageIsAssistantText = false;
  try {
    const lines = tail.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastMsg = JSON.parse(lastLine);
      if (lastMsg.type === 'assistant' && lastMsg.message?.content) {
        const content = lastMsg.message.content;
        if (Array.isArray(content)) {
          lastMessageIsAssistantText = content.some(
            (block: { type: string }) => block.type === 'text'
          );
        } else if (typeof content === 'string' && content.length > 0) {
          lastMessageIsAssistantText = true;
        }
      }
    }
  } catch {
    // Failed to parse last line
  }

  if (lastMessageIsAssistantText) {
    return 'completed';
  }

  // No end markers - check staleness
  return ageMs <= STALENESS_THRESHOLD_MS ? 'running' : 'stale';
}

/**
 * Check if a session ended gracefully.
 * Uses getSessionStatus as the single source of truth.
 */
export function didSessionEndGracefully(
  projectPath: string,
  sessionId: string | undefined
): boolean {
  if (!sessionId) return false;

  const sessionDir = getProjectSessionDir(projectPath);
  const sessionFile = join(sessionDir, `${sessionId}.jsonl`);

  try {
    if (!existsSync(sessionFile)) return false;

    const stats = statSync(sessionFile);
    const ageMs = Date.now() - stats.mtime.getTime();
    const tail = readFileTail(sessionFile, 10000);
    const status = getSessionStatus(tail, ageMs);

    return status === 'completed' || status === 'waiting_for_input';
  } catch {
    return false;
  }
}
