import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execAsync = promisify(exec);

interface FileChange {
  path: string;
  filename: string;
  directory: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

interface GitChangesResponse {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
}

/**
 * GET /api/git/changes?projectPath=<path>&base=<branch>
 * Returns file changes with line stats from git diff
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');
  const baseBranch = searchParams.get('base') || 'main';

  if (!projectPath) {
    return NextResponse.json({ error: 'Missing projectPath parameter' }, { status: 400 });
  }

  // Verify it's a git repo
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) {
    return NextResponse.json({ error: 'Not a git repository' }, { status: 400 });
  }

  try {
    // Get all changes: working directory (unstaged + staged)
    // This shows what would be committed if you did `git add . && git commit`
    const [unstagedResult, stagedResult] = await Promise.all([
      execAsync('git diff --numstat 2>/dev/null', { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }).catch(() => ({ stdout: '' })),
      execAsync('git diff --numstat --staged 2>/dev/null', { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }).catch(() => ({ stdout: '' })),
    ]);

    // Combine outputs, removing duplicates by tracking seen files
    const seenFiles = new Set<string>();
    const allLines: string[] = [];

    for (const output of [unstagedResult.stdout, stagedResult.stdout]) {
      for (const line of output.trim().split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const filePath = parts.slice(2).join('\t');
          if (!seenFiles.has(filePath)) {
            seenFiles.add(filePath);
            allLines.push(line);
          }
        }
      }
    }

    const stdout = allLines.join('\n');

    const files: FileChange[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    // Parse numstat output: additions\tdeletions\tfilepath
    const lines = stdout.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const [addStr, delStr, ...pathParts] = parts;
        const filePath = pathParts.join('\t'); // Handle paths with tabs

        // Binary files show as '-' for additions/deletions
        const additions = addStr === '-' ? 0 : parseInt(addStr, 10);
        const deletions = delStr === '-' ? 0 : parseInt(delStr, 10);

        // Determine status based on additions/deletions
        let status: FileChange['status'] = 'modified';
        if (deletions === 0 && additions > 0) {
          // Check if file is new (doesn't exist in base)
          try {
            await execAsync(`git show ${baseBranch}:"${filePath}" 2>/dev/null`, { cwd: projectPath });
          } catch {
            status = 'added';
          }
        } else if (additions === 0 && deletions > 0) {
          // Could be deleted, check if file exists
          if (!existsSync(join(projectPath, filePath))) {
            status = 'deleted';
          }
        }

        // Handle renamed files (path contains ' => ')
        if (filePath.includes(' => ')) {
          status = 'renamed';
        }

        // Extract filename and directory
        const lastSlash = filePath.lastIndexOf('/');
        const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
        const directory = lastSlash >= 0 ? filePath.slice(0, lastSlash) : '';

        files.push({
          path: filePath,
          filename,
          directory,
          additions,
          deletions,
          status,
        });

        totalAdditions += additions;
        totalDeletions += deletions;
      }
    }

    // Sort by directory then filename for logical grouping
    files.sort((a, b) => {
      // Sort by directory first
      if (a.directory !== b.directory) {
        return a.directory.localeCompare(b.directory);
      }
      // Then by filename
      return a.filename.localeCompare(b.filename);
    });

    const response: GitChangesResponse = {
      files,
      totalAdditions,
      totalDeletions,
      totalFiles: files.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting git changes:', error);
    return NextResponse.json({ error: 'Failed to get git changes' }, { status: 500 });
  }
}
