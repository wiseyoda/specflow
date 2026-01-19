import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getProjectSessionDir } from '@/lib/project-hash';

/**
 * Session index entry from Claude's sessions-index.json
 */
interface SessionIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  created: string;
  modified: string;
  messageCount: number;
  projectPath: string;
}

interface SessionIndex {
  version: number;
  entries: SessionIndexEntry[];
}

/**
 * GET /api/session/active?projectPath=<path>
 *
 * Find the most recently modified session for a project using Claude's sessions-index.json.
 * This file is written immediately when the CLI starts, making it reliable for active session detection.
 *
 * Query parameters:
 * - projectPath: string (required) - Absolute path to project
 * - maxAgeMs: number (optional) - Maximum age in ms (default: 300000 = 5 minutes)
 *
 * Response (200):
 * - sessionId: string - Session ID of most recent session
 * - sessionFile: string - Full path to session file
 * - modifiedAt: string - ISO timestamp of last modification
 * - messageCount: number - Number of messages in session
 *
 * Response (404) if no recent session found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('projectPath');
    const maxAgeMs = parseInt(searchParams.get('maxAgeMs') || '300000', 10);

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Missing required parameter: projectPath' },
        { status: 400 }
      );
    }

    // Get the session directory for this project
    const sessionDir = getProjectSessionDir(projectPath);

    // Security: Ensure path is within expected Claude directory
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const claudeDir = path.join(home, '.claude', 'projects');
    const resolvedDir = path.resolve(sessionDir);
    if (!resolvedDir.startsWith(claudeDir)) {
      return NextResponse.json(
        { error: 'Invalid session path' },
        { status: 400 }
      );
    }

    // Read sessions-index.json (written immediately when CLI starts)
    const indexPath = path.join(sessionDir, 'sessions-index.json');
    let indexContent: string;
    try {
      indexContent = await readFile(indexPath, 'utf-8');
    } catch {
      return NextResponse.json(
        { error: 'Sessions index not found', indexPath },
        { status: 404 }
      );
    }

    let index: SessionIndex;
    try {
      index = JSON.parse(indexContent);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse sessions index' },
        { status: 500 }
      );
    }

    if (!index.entries || index.entries.length === 0) {
      return NextResponse.json(
        { error: 'No sessions found in index' },
        { status: 404 }
      );
    }

    // Find the most recent active session
    // Priority: 1) Sessions CREATED in last 60s, 2) Sessions MODIFIED in last maxAge
    const now = Date.now();
    const recentCreateThreshold = 60000; // 60 seconds

    let newestByCreate: SessionIndexEntry | null = null;
    let newestByModify: SessionIndexEntry | null = null;

    for (const entry of index.entries) {
      const modifyAge = now - entry.fileMtime;
      const createTime = new Date(entry.created).getTime();
      const createAge = now - createTime;

      // Track most recently CREATED session (for new workflows)
      if (createAge <= recentCreateThreshold) {
        if (!newestByCreate || createTime > new Date(newestByCreate.created).getTime()) {
          newestByCreate = entry;
        }
      }

      // Track most recently MODIFIED session (for ongoing workflows)
      if (modifyAge <= maxAgeMs) {
        if (!newestByModify || entry.fileMtime > newestByModify.fileMtime) {
          newestByModify = entry;
        }
      }
    }

    // Prefer recently created session (catches new workflows immediately)
    // Fall back to recently modified (for resumed sessions)
    const mostRecent = newestByCreate || newestByModify;

    if (!mostRecent) {
      return NextResponse.json(
        { error: 'No recent sessions found', maxAgeMs },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: mostRecent.sessionId,
      sessionFile: mostRecent.fullPath,
      modifiedAt: mostRecent.modified,
      messageCount: mostRecent.messageCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Session active error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
