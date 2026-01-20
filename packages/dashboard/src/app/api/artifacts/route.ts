import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';

/**
 * GET /api/artifacts?path=<absolute-path>
 * Returns the content of an artifact file
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  // Normalize and resolve the path to prevent traversal attacks
  const normalizedPath = normalize(resolve(filePath));

  // Basic security check: ensure path contains expected directories
  const allowedPatterns = ['/specs/', '/.specify/archive/', '/.specify/phases/'];
  const hasAllowedPattern = allowedPatterns.some((pattern) =>
    normalizedPath.includes(pattern)
  );

  if (!hasAllowedPattern) {
    return NextResponse.json(
      { error: 'Access denied: path not in allowed directories' },
      { status: 403 }
    );
  }

  // Ensure file ends with .md
  if (!normalizedPath.endsWith('.md')) {
    return NextResponse.json(
      { error: 'Only markdown files are allowed' },
      { status: 403 }
    );
  }

  if (!existsSync(normalizedPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const content = await readFile(normalizedPath, 'utf-8');

    // Extract title from first heading if present
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filePath.split('/').pop() ?? 'Artifact';

    return NextResponse.json({
      path: normalizedPath,
      title,
      content,
    });
  } catch (error) {
    console.error('Error reading artifact:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
