import type { WorkflowData, WorkflowIndexEntry } from '@specflow/shared';
import type { WorkflowExecution } from './workflow-service';
import { workflowService } from './workflow-service';
import { checkProcessHealth, didSessionEndGracefully } from './process-health';
import { discoverCliSessions } from './workflow-discovery';

const ACTIVE_STATUSES: WorkflowIndexEntry['status'][] = ['running', 'waiting_for_input'];
const HEALTH_CHECK_STATUSES: WorkflowIndexEntry['status'][] = ['running', 'detached', 'stale'];

function deriveExecutionStatus(
  execution: WorkflowExecution,
  projectPath: string
): WorkflowIndexEntry['status'] {
  const status = execution.status as WorkflowIndexEntry['status'];

  if (!execution.sessionId) {
    return status;
  }

  if (status === 'failed' && didSessionEndGracefully(projectPath, execution.sessionId)) {
    return 'completed';
  }

  if (!HEALTH_CHECK_STATUSES.includes(status)) {
    return status;
  }

  // If the session ended gracefully, treat it as completed for UI purposes.
  if (didSessionEndGracefully(projectPath, execution.sessionId)) {
    return 'completed';
  }

  const health = checkProcessHealth(execution, projectPath);
  if (health.healthStatus === 'dead') {
    return 'failed';
  }
  if (health.healthStatus === 'stale') {
    return 'stale';
  }
  if (health.healthStatus === 'running' && status === 'stale') {
    return 'running';
  }
  if (health.healthStatus === 'unknown') {
    if (health.isStale) {
      return 'stale';
    }
    if (health.sessionFileMtime) {
      return 'running';
    }
  }

  return status;
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
  const cliSessions = discoverCliSessions(projectPath, trackedSessionIds, 50);

  const allSessions = [...trackedSessions, ...cliSessions];
  allSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const currentExecution = allSessions.find((s) => ACTIVE_STATUSES.includes(s.status)) ?? null;

  return {
    currentExecution,
    sessions: allSessions.slice(0, 100),
  };
}
