import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orchestrationService } from '@/lib/services/orchestration-service';

// =============================================================================
// Request Schema
// =============================================================================

const CancelOrchestrationRequestSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().uuid().optional(), // If not provided, cancels active orchestration
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
// POST /api/workflow/orchestrate/cancel (T029)
// =============================================================================

/**
 * POST /api/workflow/orchestrate/cancel
 *
 * Cancel an orchestration.
 *
 * Request body:
 * - projectId: string (required) - Registry project key
 * - id: string (optional) - Specific orchestration ID, otherwise cancels active
 *
 * Response (200):
 * - orchestration: Updated orchestration with status "cancelled"
 *
 * Errors:
 * - 400: Invalid request body or no active orchestration
 * - 404: Project or orchestration not found
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parseResult = CancelOrchestrationRequestSchema.safeParse(body);
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
          { error: 'No active orchestration to cancel' },
          { status: 400 }
        );
      }
      orchestrationId = active.id;
    }

    // Cancel orchestration
    const orchestration = await orchestrationService.cancel(projectPath, orchestrationId);
    if (!orchestration) {
      return NextResponse.json(
        { error: `Orchestration not found: ${orchestrationId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      orchestration: {
        id: orchestration.id,
        projectId: orchestration.projectId,
        status: orchestration.status,
        currentPhase: orchestration.currentPhase,
        updatedAt: orchestration.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
