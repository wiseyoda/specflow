import { NextResponse } from 'next/server';
import {
  workflowService,
  StartWorkflowRequestSchema,
} from '@/lib/services/workflow-service';

/**
 * POST /api/workflow/start
 *
 * Start a new workflow execution for a registered project.
 *
 * Request body:
 * - projectId: string (required) - Registry project UUID
 * - skill: string (required) - Skill name (e.g., "flow.design")
 * - timeoutMs: number (optional) - Override default timeout
 *
 * Response (201):
 * - WorkflowExecution object with status "running"
 *
 * Errors:
 * - 400: Invalid request body
 * - 404: Project not found in registry
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const parseResult = StartWorkflowRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { projectId, skill, timeoutMs } = parseResult.data;

    const execution = await workflowService.start(projectId, skill, timeoutMs);

    // Return subset of execution for start response
    return NextResponse.json(
      {
        id: execution.id,
        status: execution.status,
        projectId: execution.projectId,
        skill: execution.skill,
        startedAt: execution.startedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Project not found returns 404
    if (message.includes('Project not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
