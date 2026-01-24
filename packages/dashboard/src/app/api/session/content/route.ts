import { NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { getProjectSessionDir } from '@/lib/project-hash';
import { parseSessionLines, tailLines } from '@/lib/session-parser';

/**
 * GET /api/session/content?projectPath=<path>&sessionId=<id>&tail=100
 *
 * Fetch session messages from Claude JSONL files.
 *
 * Query parameters:
 * - projectPath: string (required) - Absolute path to project
 * - sessionId: string (required) - Claude session ID
 * - tail: number (optional) - Number of lines to return (default: 100)
 *
 * Response (200):
 * - messages: SessionMessage[] - User and assistant messages
 * - filesModified: number - Count of unique files modified
 * - elapsed: number - Milliseconds since session start (0 if unknown)
 * - sessionId: string - Echo back session ID
 *
 * Errors:
 * - 400: Missing required parameters
 * - 404: Session file not found
 * - 500: Read error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('projectPath');
    const sessionId = searchParams.get('sessionId');
    const tailLimit = parseInt(searchParams.get('tail') || '100', 10);

    // Validate required parameters
    if (!projectPath) {
      return NextResponse.json(
        { error: 'Missing required parameter: projectPath' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      );
    }

    // Validate tail limit is reasonable
    const limit = Math.min(Math.max(1, tailLimit), 500);

    // Calculate session directory from project path
    const sessionDir = getProjectSessionDir(projectPath);
    const sessionFile = path.join(sessionDir, `${sessionId}.jsonl`);

    // Security: Ensure path is within expected Claude directory
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const claudeDir = path.join(home, '.claude', 'projects');
    const resolvedPath = path.resolve(sessionFile);
    if (!resolvedPath.startsWith(claudeDir)) {
      return NextResponse.json(
        { error: 'Invalid session path' },
        { status: 400 }
      );
    }

    // Check file exists
    try {
      await access(sessionFile, constants.R_OK);
    } catch {
      return NextResponse.json(
        {
          error: `Session file not found: ${sessionId}`,
          hint: `Expected at: ${sessionFile}`,
        },
        { status: 404 }
      );
    }

    // Read and parse session file
    const content = await readFile(sessionFile, 'utf-8');
    const lines = tailLines(content, limit);
    const sessionData = parseSessionLines(lines);

    // Calculate elapsed time
    let elapsed = 0;
    if (sessionData.startTime) {
      const startDate = new Date(sessionData.startTime);
      elapsed = Date.now() - startDate.getTime();
    }

    // Convert tool calls to serializable format (remove input for size)
    const toolCalls = sessionData.toolCalls.map((tc) => ({
      name: tc.name,
      operation: tc.operation,
      files: tc.files,
    }));

    return NextResponse.json({
      messages: sessionData.messages,
      filesModified: sessionData.filesModified.size,
      elapsed,
      sessionId,
      toolCalls,
      currentTodos: sessionData.currentTodos,
      workflowOutput: sessionData.workflowOutput,
      agentTasks: sessionData.agentTasks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Session content error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
