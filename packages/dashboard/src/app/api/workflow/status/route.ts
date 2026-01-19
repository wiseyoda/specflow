import { NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow-service';

/**
 * GET /api/workflow/status?id=<execution-id>
 *
 * Get the current status of a workflow execution.
 *
 * Query parameters:
 * - id: string (required) - Execution UUID
 *
 * Response (200):
 * - Full WorkflowExecution object
 *
 * Errors:
 * - 400: Missing id parameter
 * - 404: Execution not found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const execution = workflowService.get(id);

    if (!execution) {
      return NextResponse.json(
        { error: `Execution not found: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
