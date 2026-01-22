import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orchestrationService } from '@/lib/services/orchestration-service';
import { workflowService } from '@/lib/services/workflow-service';
import { runOrchestration } from '@/lib/services/orchestration-runner';

// =============================================================================
// Request Schema
// =============================================================================

const TriggerMergeRequestSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().uuid().optional(), // If not provided, triggers merge on active orchestration
});

// =============================================================================
// Registry Lookup
// =============================================================================

function getProjectPath(projectId: string): string | null {
  const { existsSync, readFileSync } = require('fs');
  const { join } = require('path');

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

// =============================================================================
// POST /api/workflow/orchestrate/merge (T031)
// =============================================================================

/**
 * POST /api/workflow/orchestrate/merge
 *
 * Trigger merge for an orchestration that is waiting_merge.
 *
 * Request body:
 * - projectId: string (required) - Registry project key
 * - id: string (optional) - Specific orchestration ID, otherwise triggers on active
 *
 * Response (200):
 * - orchestration: Updated orchestration
 * - workflowExecution: The started merge workflow execution
 *
 * Errors:
 * - 400: Invalid request body or orchestration not in waiting_merge status
 * - 404: Project or orchestration not found
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parseResult = TriggerMergeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { projectId, id } = parseResult.data;

    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // Get orchestration ID
    let orchestrationId = id;
    if (!orchestrationId) {
      const active = orchestrationService.getActive(projectPath);
      if (!active) {
        return NextResponse.json(
          { error: 'No orchestration waiting for merge' },
          { status: 400 }
        );
      }
      if (active.status !== 'waiting_merge') {
        return NextResponse.json(
          { error: `Orchestration is not waiting for merge (status: ${active.status})` },
          { status: 400 }
        );
      }
      orchestrationId = active.id;
    }

    // Trigger merge in orchestration state
    const orchestration = orchestrationService.triggerMerge(projectPath, orchestrationId);
    if (!orchestration) {
      return NextResponse.json(
        { error: `Orchestration not found or not waiting for merge: ${orchestrationId}` },
        { status: 404 }
      );
    }

    // Start the merge workflow
    const workflowExecution = await workflowService.start(projectId, '/flow.merge');

    // Link the workflow execution to orchestration
    orchestrationService.linkWorkflowExecution(projectPath, orchestrationId, workflowExecution.id);

    // Restart the orchestration runner to handle merge completion
    runOrchestration(projectId, orchestrationId).catch((error) => {
      console.error('[orchestrate/merge] Runner error:', error);
    });

    return NextResponse.json({
      orchestration: {
        id: orchestration.id,
        projectId: orchestration.projectId,
        status: orchestration.status,
        currentPhase: orchestration.currentPhase,
        updatedAt: orchestration.updatedAt,
      },
      workflowExecution: {
        id: workflowExecution.id,
        status: workflowExecution.status,
        skill: workflowExecution.skill,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
