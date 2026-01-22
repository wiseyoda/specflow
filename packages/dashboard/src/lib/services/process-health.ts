/**
 * Process Health - Health detection for CLI processes
 *
 * Checks process health based on:
 * - PID liveness (is the process still running?)
 * - Session file staleness (when was output last written?)
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { WorkflowExecution } from './workflow-service';
import { isPidAlive, readPidFile } from './process-spawner';
import { getProjectSessionDir } from '@/lib/project-hash';

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
 * Check if a session ended gracefully
 *
 * Reads the last portion of the session JSONL to detect if the session
 * completed normally vs terminated unexpectedly.
 *
 * Detection methods:
 * 1. Stop hook feedback meta message (most reliable)
 * 2. Result type message from Claude CLI
 * 3. Final assistant message without pending tool calls
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

    const { readFileSync } = require('fs');
    const content = readFileSync(sessionFile, 'utf-8');

    // Check the last portion of the file
    const lastChunk = content.slice(-10000); // Last 10KB for better coverage

    // Method 1: Stop hook feedback (most reliable indicator of graceful end)
    if (lastChunk.includes('"isMeta":true') && lastChunk.includes('Stop hook feedback:')) {
      return true;
    }

    // Method 2: Result type message from Claude CLI output
    if (lastChunk.includes('"type":"result"')) {
      return true;
    }

    // Method 3: Check if the last non-empty entry is an assistant message
    // without tool_use blocks (indicates natural completion)
    const lines = lastChunk.trim().split('\n').filter((l: string) => l.trim());
    if (lines.length > 0) {
      // Check last few lines for a final assistant message
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
        try {
          const entry = JSON.parse(lines[i]);
          // Skip meta messages
          if (entry.isMeta) continue;
          // If we find an assistant message, check if it has tool calls
          if (entry.type === 'assistant' || entry.message?.role === 'assistant') {
            const msgContent = entry.message?.content || entry.content;
            // If it's a text-only response (no tool_use), likely completed
            if (msgContent && typeof msgContent === 'string') {
              return true;
            }
            // If content is array, check for tool_use blocks
            if (Array.isArray(msgContent)) {
              const hasToolUse = msgContent.some((c: { type?: string }) => c.type === 'tool_use');
              // No pending tool calls = likely completed
              if (!hasToolUse) {
                return true;
              }
            }
            break; // Only check the last assistant message
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}
