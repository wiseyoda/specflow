import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execAsync = promisify(exec);

interface GitActivity {
  type: 'commit' | 'task' | 'file';
  description: string;
  timestamp: string;
  hash?: string;
  author?: string;
}

/**
 * GET /api/git/activity?projectPath=<path>&limit=<number>
 * Returns recent git activity (commits) for the project
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!projectPath) {
    return NextResponse.json({ error: 'Missing projectPath parameter' }, { status: 400 });
  }

  // Verify it's a git repo
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) {
    return NextResponse.json({ error: 'Not a git repository' }, { status: 400 });
  }

  try {
    // Get recent commits with timestamp
    // Format: hash|subject|author|relative_date
    const { stdout } = await execAsync(
      `git log --oneline -n ${limit} --format="%h|%s|%an|%ar" 2>/dev/null || echo ""`,
      { cwd: projectPath }
    );

    const activities: GitActivity[] = [];

    const lines = stdout.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const [hash, subject, author, relativeDate] = line.split('|');
      if (hash && subject) {
        // Detect activity type from commit message
        let type: GitActivity['type'] = 'commit';
        let description = subject;

        // Check for task completion patterns
        if (/^(feat|fix|chore|docs|refactor|test):/i.test(subject)) {
          type = 'commit';
          // Clean up conventional commit prefix for display
          description = subject.replace(/^(feat|fix|chore|docs|refactor|test):\s*/i, '');
        }

        // Check if it mentions task IDs like T001, T002
        if (/T\d{3}/i.test(subject)) {
          type = 'task';
        }

        activities.push({
          type,
          description,
          timestamp: relativeDate || 'Unknown',
          hash,
          author,
        });
      }
    }

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error getting git activity:', error);
    return NextResponse.json({ error: 'Failed to get git activity' }, { status: 500 });
  }
}
