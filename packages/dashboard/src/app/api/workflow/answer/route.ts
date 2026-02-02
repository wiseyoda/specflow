import { NextResponse } from 'next/server';
import {
  workflowService,
  AnswerWorkflowRequestSchema,
} from '@/lib/services/workflow-service';

/**
 * POST /api/workflow/answer
 *
 * Submit answers to a workflow waiting for input and resume execution.
 *
 * Request body:
 * - id: string (optional) - Execution UUID (preferred)
 * - sessionId: string (optional) - Alternative: lookup by session ID
 * - projectId: string (optional) - Required with sessionId
 * - answers: Record<string, string> (required) - Key-value answers
 *
 * Must provide either `id` OR both `sessionId` and `projectId`.
 *
 * Response (200):
 * - Updated WorkflowExecution with status "running"
 *
 * Errors:
 * - 400: Invalid request body or workflow not in waiting_for_input state
 * - 404: Execution not found
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const parseResult = AnswerWorkflowRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, sessionId, projectId, answers } = parseResult.data;

    // Resolve execution ID - either directly provided or lookup by session ID
    let executionId = id;
    if (!executionId && sessionId && projectId) {
      const execution = workflowService.getBySession(sessionId, projectId);
      if (!execution) {
        return NextResponse.json(
          { error: `Execution not found for session: ${sessionId}` },
          { status: 404 }
        );
      }
      executionId = execution.id;
    }

    if (!executionId) {
      return NextResponse.json(
        { error: 'No execution ID could be resolved' },
        { status: 400 }
      );
    }

    const execution = await workflowService.resume(executionId, answers);

    return NextResponse.json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Execution not found returns 404
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    // Wrong state returns 400
    if (message.includes('Cannot answer')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
