import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { workflowService } from '@/lib/services/workflow-service';
import { getProjectSessionDir } from '@/lib/project-hash';
import { isPidAlive, killProcess } from '@/lib/services/process-spawner';

// =============================================================================
// Helpers
// =============================================================================

function getProjectPath(projectId: string): string | null {
  const homeDir = process.env.HOME || '';
  const registryPath = join(homeDir, '.specflow', 'registry.json');

  if (!existsSync(registryPath)) {
    return null;
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(content);
    const project = registry.projects?.[projectId];
    return project?.path || null;
  } catch {
    return null;
  }
}

function findSessionPids(sessionFile: string): { pids: number[]; error?: string } {
  try {
    const output = execFileSync('lsof', ['-t', sessionFile], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = output
      .split('\n')
      .map((line) => parseInt(line.trim(), 10))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
    return { pids };
  } catch {
    return { pids: [], error: 'Unable to inspect running processes for this session.' };
  }
}

async function attemptKillSessionProcess(
  projectId: string,
  sessionId: string
): Promise<{ killed: number[]; warning?: string }> {
  const projectPath = getProjectPath(projectId);
  if (!projectPath) {
    return {
      killed: [],
      warning: 'Project not found in registry. Unable to terminate session process.',
    };
  }

  const sessionDir = getProjectSessionDir(projectPath);
  const sessionFile = join(sessionDir, `${sessionId}.jsonl`);
  if (!existsSync(sessionFile)) {
    return { killed: [] };
  }

  const { pids, error } = findSessionPids(sessionFile);
  if (error) {
    return { killed: [], warning: error };
  }
  if (pids.length === 0) {
    return { killed: [] };
  }

  const uniquePids = Array.from(new Set(pids));
  const killed = new Set<number>();
  let forced = false;
  let failed = false;

  for (const pid of uniquePids) {
    if (!isPidAlive(pid)) {
      continue;
    }
    try {
      process.kill(pid, 'SIGINT');
    } catch {
      // Fall through to SIGTERM/SIGKILL
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  for (const pid of uniquePids) {
    if (!isPidAlive(pid)) {
      killed.add(pid);
      continue;
    }
    const ok = killProcess(pid, false);
    forced = forced || ok;
    if (ok) {
      killed.add(pid);
    } else {
      failed = true;
    }
  }

  const warning = failed
    ? 'Some session processes could not be terminated. You may need to stop them manually.'
    : forced
    ? 'Session did not stop after SIGINT; sent SIGTERM/SIGKILL to end it.'
    : undefined;

  return { killed: Array.from(killed), warning };
}

/**
 * POST /api/workflow/cancel?id=<execution-id>&sessionId=<session-id>&projectId=<project-id>&status=<status>
 *
 * Cancel or complete a running workflow and terminate its process.
 *
 * Query parameters:
 * - id: string (optional) - Execution UUID
 * - sessionId: string (optional) - Session ID (fallback if execution not found)
 * - projectId: string (optional) - Project ID (required with sessionId)
 * - status: 'cancelled' | 'completed' (optional) - Final status (default: 'cancelled')
 *
 * At least 'id' or both 'sessionId' and 'projectId' must be provided.
 *
 * Response (200):
 * - Updated WorkflowExecution with the specified status
 * - Or { cancelled: true } if updated by session ID
 *
 * Errors:
 * - 400: Missing parameters or workflow not in updatable state
 * - 404: Execution/session not found
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sessionId = searchParams.get('sessionId');
    const projectId = searchParams.get('projectId');
    const statusParam = searchParams.get('status');
    const finalStatus = statusParam === 'completed' ? 'completed' : 'cancelled';

    // Try execution ID first
    if (id) {
      try {
        const execution = workflowService.cancel(id);
        return NextResponse.json({ execution });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // If execution not found but we have session info, try session-based update
        if (message.includes('not found') && sessionId && projectId) {
          // Check if project exists first
          const projectPath = getProjectPath(projectId);
          if (!projectPath) {
            return NextResponse.json(
              { error: `Project not found in registry: ${projectId}` },
              { status: 404 }
            );
          }

          const cancelled = workflowService.cancelBySession(sessionId, projectId, finalStatus);
          if (cancelled) {
            const killResult = finalStatus === 'cancelled'
              ? await attemptKillSessionProcess(projectId, sessionId)
              : { killed: [] };
            return NextResponse.json({
              cancelled: true,
              sessionId,
              status: finalStatus,
              ...killResult,
            });
          }
        }

        // Re-throw to be handled below
        throw error;
      }
    }

    // No execution ID - try session-based update
    if (sessionId && projectId) {
      // Check if project exists first for better error message
      const projectPath = getProjectPath(projectId);
      if (!projectPath) {
        return NextResponse.json(
          { error: `Project not found in registry: ${projectId}` },
          { status: 404 }
        );
      }

      const cancelled = workflowService.cancelBySession(sessionId, projectId, finalStatus);
      if (cancelled) {
        const killResult = finalStatus === 'cancelled'
          ? await attemptKillSessionProcess(projectId, sessionId)
          : { killed: [] };
        return NextResponse.json({
          cancelled: true,
          sessionId,
          status: finalStatus,
          ...killResult,
        });
      }
      return NextResponse.json(
        { error: `Session not in updatable state: ${sessionId}` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Missing required parameters: id, or sessionId and projectId' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Execution not found returns 404
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    // Wrong state returns 400
    if (message.includes('Cannot cancel')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
