import { NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow-service';

/**
 * POST /api/workflow/cancel?id=<execution-id>
 *
 * Cancel a running workflow and terminate its process.
 *
 * Query parameters:
 * - id: string (required) - Execution UUID
 *
 * Response (200):
 * - Updated WorkflowExecution with status "cancelled"
 *
 * Errors:
 * - 400: Missing id parameter or workflow not in cancellable state
 * - 404: Execution not found
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const execution = workflowService.cancel(id);

    return NextResponse.json(execution);
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
