import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  WorkflowIndexSchema,
  type WorkflowIndexEntry,
} from '@/lib/services/workflow-service';

/**
 * GET /api/session/history?projectPath=<path>
 *
 * List all sessions for a project from the workflow index.
 *
 * Query parameters:
 * - projectPath: string (required) - Absolute path to project
 *
 * Response (200):
 * - { sessions: WorkflowIndexEntry[] } sorted by startedAt descending
 *
 * Errors:
 * - 400: Missing projectPath parameter
 * - 404: No sessions found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('projectPath');

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Missing required parameter: projectPath' },
        { status: 400 }
      );
    }

    // Read the workflow index
    const indexPath = join(projectPath, '.specflow', 'workflows', 'index.json');

    if (!existsSync(indexPath)) {
      // Return empty array if no index exists yet
      return NextResponse.json({ sessions: [] });
    }

    try {
      const content = readFileSync(indexPath, 'utf-8');
      const index = WorkflowIndexSchema.parse(JSON.parse(content));

      // Sessions are already sorted by startedAt descending in the index
      return NextResponse.json({ sessions: index.sessions });
    } catch {
      // Invalid index file - return empty
      return NextResponse.json({ sessions: [] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Session history error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
