import { NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow-service';

/**
 * GET /api/workflow/list?projectId=<project-id>
 *
 * List workflow executions for a project.
 *
 * Query parameters:
 * - projectId: string (required) - Project registry key
 *
 * Response (200):
 * - { executions: WorkflowExecution[] } sorted by updatedAt descending
 * - { sessions: WorkflowIndexEntry[] } from index for quick access
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required parameter: projectId' },
        { status: 400 }
      );
    }

    const executions = workflowService.list(projectId);

    return NextResponse.json({ executions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
