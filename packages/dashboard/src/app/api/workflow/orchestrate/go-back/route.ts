import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { orchestrationService } from '@/lib/services/orchestration-service';
import { workflowService } from '@/lib/services/workflow-service';
import { isRunnerActive, runOrchestration } from '@/lib/services/orchestration-runner';

// =============================================================================
// Registry Lookup
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

// =============================================================================
// POST /api/workflow/orchestrate/go-back (FR-004)
// =============================================================================

/**
 * POST /api/workflow/orchestrate/go-back
 *
 * Go back to a previous step in the orchestration (FR-004)
 *
 * Body:
 *   - projectId: string - The project ID
 *   - id: string - The orchestration ID
 *   - step: string - The step to go back to (design, analyze, implement, verify)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, id, step } = body;

    if (!projectId || !id || !step) {
      return NextResponse.json(
        { error: 'projectId, id, and step are required' },
        { status: 400 }
      );
    }

    // Validate step
    const validSteps = ['design', 'analyze', 'implement', 'verify'];
    if (!validSteps.includes(step)) {
      return NextResponse.json(
        { error: `Invalid step: ${step}. Must be one of: ${validSteps.join(', ')}` },
        { status: 400 }
      );
    }

    // Get project path from registry
    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project not found in registry' },
        { status: 404 }
      );
    }

    // Block step override if an external workflow is running
    const activeStatuses = new Set(['running', 'waiting_for_input']);
    const activeWorkflows = workflowService
      .list(projectId)
      .filter((workflow) => activeStatuses.has(workflow.status));
    const externalWorkflow = activeWorkflows.find(
      (workflow) => workflow.orchestrationId !== id
    );

    if (externalWorkflow) {
      return NextResponse.json(
        {
          error: 'Active workflow detected outside this orchestration. Finish or cancel it before overriding steps.',
        },
        { status: 409 }
      );
    }

    // Go back to the step
    const result = await orchestrationService.goBackToStep(projectPath, id, step);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to go back to step' },
        { status: 500 }
      );
    }

    if (!isRunnerActive(id)) {
      runOrchestration(projectId, id).catch((error) => {
        console.error('[API] Failed to restart orchestration runner after go-back:', error);
      });
    }

    return NextResponse.json({
      success: true,
      orchestration: result,
    });
  } catch (error) {
    console.error('[API] Failed to go back to step:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
