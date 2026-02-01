import type { WorkflowData, WorkflowIndexEntry } from '@specflow/shared';
import type { WorkflowExecution } from './workflow-service';
import { workflowService } from './workflow-service';
import {
  checkProcessHealth,
  getSessionStatus,
  readFileTail,
  getSessionFileMtime,
} from './process-health';
import { getProjectSessionDir } from '@/lib/project-hash';
import { join } from 'path';
import { discoverCliSessions } from './workflow-discovery';

const ACTIVE_STATUSES: WorkflowIndexEntry['status'][] = ['running', 'waiting_for_input'];

/**
 * Derive session status using the SINGLE SOURCE OF TRUTH (getSessionStatus).
 * Process health checks are only used as fallback for edge cases.
 */
function deriveExecutionStatus(
  execution: WorkflowExecution,
  projectPath: string
): WorkflowIndexEntry['status'] {
  const persistedStatus = execution.status as WorkflowIndexEntry['status'];

  if (!execution.sessionId) {
    return persistedStatus;
  }

  // Get session file status - this is the SINGLE SOURCE OF TRUTH
  const sessionDir = getProjectSessionDir(projectPath);
  const sessionFile = join(sessionDir, `${execution.sessionId}.jsonl`);
  const mtime = getSessionFileMtime(projectPath, execution.sessionId);

  if (mtime) {
    const ageMs = Date.now() - mtime.getTime();
    const tail = readFileTail(sessionFile, 10000);
    const fileStatus = getSessionStatus(tail, ageMs);

    // File-based status takes precedence
    if (fileStatus === 'completed' || fileStatus === 'waiting_for_input') {
      return fileStatus;
    }

    // For running/stale, also check process health for tracked sessions
    // (we have PID info that CLI sessions don't have)
    const health = checkProcessHealth(execution, projectPath);

    if (health.healthStatus === 'dead') {
      // Process died but file doesn't show completion - failed
      return 'failed';
    }

    // Use file-based status (running or stale)
    return fileStatus;
  }

  // No session file - fall back to persisted status
  return persistedStatus;
}

function toWorkflowIndexEntry(
  execution: WorkflowExecution,
  projectPath: string
): WorkflowIndexEntry | null {
  if (!execution.sessionId) return null;

  return {
    sessionId: execution.sessionId,
    executionId: execution.id,
    skill: execution.skill,
    status: deriveExecutionStatus(execution, projectPath),
    startedAt: execution.startedAt,
    updatedAt: execution.updatedAt,
    costUsd: execution.costUsd,
  };
}

export async function buildWorkflowData(
  projectId: string,
  projectPath: string
): Promise<WorkflowData> {
  const executions = workflowService.list(projectId);
  const trackedSessions = executions
    .map((execution) => toWorkflowIndexEntry(execution, projectPath))
    .filter((entry): entry is WorkflowIndexEntry => Boolean(entry));

  const trackedSessionIds = new Set<string>(trackedSessions.map((s) => s.sessionId));
  const cliSessions = discoverCliSessions(projectPath, trackedSessionIds, 10);

  const allSessions = [...trackedSessions, ...cliSessions];
  allSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const currentExecution = allSessions.find((s) => ACTIVE_STATUSES.includes(s.status)) ?? null;

  return {
    currentExecution,
    sessions: allSessions.slice(0, 10),
  };
}

/**
 * Fast version of buildWorkflowData that skips expensive CLI session discovery.
 * Used for initial SSE connection to minimize latency.
 * Full session discovery happens on subsequent file change events.
 */
export async function buildWorkflowDataFast(
  projectId: string,
  projectPath: string
): Promise<WorkflowData> {
  const executions = workflowService.list(projectId);
  const trackedSessions = executions
    .map((execution) => toWorkflowIndexEntry(execution, projectPath))
    .filter((entry): entry is WorkflowIndexEntry => Boolean(entry));

  // Skip discoverCliSessions() - this is the expensive operation
  // CLI sessions will be discovered on subsequent file change events

  trackedSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const currentExecution = trackedSessions.find((s) => ACTIVE_STATUSES.includes(s.status)) ?? null;

  return {
    currentExecution,
    sessions: trackedSessions.slice(0, 10),
  };
}
