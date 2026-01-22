import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/services/orchestration-service';

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
// GET /api/workflow/orchestrate/list (T028)
// =============================================================================

/**
 * GET /api/workflow/orchestrate/list
 *
 * List all orchestrations for a project (including history).
 *
 * Query params:
 * - projectId: string (required) - Registry project key
 * - limit: number (optional) - Max number to return (default: 10)
 *
 * Response (200):
 * - orchestrations: Array of orchestration summaries
 * - total: Total count
 *
 * Errors:
 * - 400: Missing projectId
 * - 404: Project not found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: projectId' },
        { status: 400 }
      );
    }

    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    const allOrchestrations = orchestrationService.list(projectPath);
    const limited = allOrchestrations.slice(0, limit);

    // Return summaries (not full objects to save bandwidth)
    const summaries = limited.map((o) => ({
      id: o.id,
      projectId: o.projectId,
      status: o.status,
      currentPhase: o.currentPhase,
      batchProgress: {
        current: o.batches.current + 1,
        total: o.batches.total,
      },
      startedAt: o.startedAt,
      updatedAt: o.updatedAt,
      completedAt: o.completedAt,
      totalCostUsd: o.totalCostUsd,
    }));

    return NextResponse.json({
      orchestrations: summaries,
      total: allOrchestrations.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
