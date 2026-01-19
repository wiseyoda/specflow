import { NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow-service';

/**
 * GET /api/workflow/list?projectId=<project-id>
 *
 * List workflow executions, optionally filtered by project.
 *
 * Query parameters:
 * - projectId: string (optional) - Filter by project UUID
 *
 * Response (200):
 * - { executions: WorkflowExecution[] } sorted by updatedAt descending
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;

    const executions = workflowService.list(projectId);

    return NextResponse.json({ executions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
