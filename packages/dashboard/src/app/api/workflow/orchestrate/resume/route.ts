import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orchestrationService } from '@/lib/services/orchestration-service';
import { runOrchestration, stopRunner } from '@/lib/services/orchestration-runner';

// =============================================================================
// Request Schema
// =============================================================================

const ResumeOrchestrationRequestSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().uuid().optional(), // If not provided, resumes active paused orchestration
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
// POST /api/workflow/orchestrate/resume (T030)
// =============================================================================

/**
 * POST /api/workflow/orchestrate/resume
 *
 * Resume a paused orchestration.
 *
 * Request body:
 * - projectId: string (required) - Registry project key
 * - id: string (optional) - Specific orchestration ID, otherwise resumes active paused
 *
 * Response (200):
 * - orchestration: Updated orchestration with status "running"
 *
 * Errors:
 * - 400: Invalid request body or orchestration not paused
 * - 404: Project or orchestration not found
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parseResult = ResumeOrchestrationRequestSchema.safeParse(body);
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

    // Get orchestration ID and active orchestration
    let orchestrationId = id;
    const active = orchestrationService.getActive(projectPath);

    if (!orchestrationId) {
      if (!active) {
        return NextResponse.json(
          { error: 'No active orchestration to resume' },
          { status: 400 }
        );
      }
      orchestrationId = active.id;
    }

    // Handle "running" orchestration — force-restart the runner.
    // The user clicking Resume on a running orchestration means it's stalled.
    // Stop any existing runner (which may be stuck) and start a fresh one.
    if (active && active.id === orchestrationId && active.status === 'running') {
      console.log(`[orchestrate/resume] Force-restarting runner for ${orchestrationId}`);
      stopRunner(orchestrationId);
      runOrchestration(projectId, orchestrationId).catch((error) => {
        console.error('[orchestrate/resume] Runner error:', error);
      });

      return NextResponse.json({
        orchestration: {
          id: active.id,
          projectId: active.projectId,
          status: active.status,
          currentPhase: active.currentPhase,
          updatedAt: active.updatedAt,
        },
      });
    }

    // Standard resume from paused state
    if (active && active.id === orchestrationId && active.status !== 'paused') {
      return NextResponse.json(
        { error: `Orchestration is not paused (status: ${active.status})` },
        { status: 400 }
      );
    }

    const orchestration = orchestrationService.resume(projectPath, orchestrationId);
    if (!orchestration) {
      return NextResponse.json(
        { error: `Orchestration not found or not paused: ${orchestrationId}` },
        { status: 404 }
      );
    }

    // Restart the orchestration runner in the background
    runOrchestration(projectId, orchestrationId).catch((error) => {
      console.error('[orchestrate/resume] Runner error:', error);
    });

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
