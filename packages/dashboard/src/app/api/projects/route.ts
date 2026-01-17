import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { RegistrySchema } from '@speckit/shared';
import { NextResponse } from 'next/server';

/**
 * Expand ~ to home directory in a path
 */
function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Check if a project path is within any of the allowed dev folders
 */
function isInDevFolders(projectPath: string, devFolders: string[]): boolean {
  const normalizedProjectPath = path.normalize(projectPath);
  return devFolders.some((folder) => {
    const normalizedFolder = path.normalize(expandPath(folder));
    return normalizedProjectPath.startsWith(normalizedFolder);
  });
}

export async function GET() {
  const registryPath = path.join(homedir(), '.speckit', 'registry.json');

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const parsed = RegistrySchema.parse(JSON.parse(content));

    // Get dev_folders config (if any)
    const devFolders = parsed.config?.dev_folders;
    const hasDevFolderFilter = devFolders && devFolders.length > 0;

    // Convert to array with id included and check if paths exist
    const allProjects = await Promise.all(
      Object.entries(parsed.projects).map(async ([id, project]) => {
        let isUnavailable = false;
        try {
          await fs.access(project.path);
        } catch {
          isUnavailable = true;
        }
        return {
          id,
          ...project,
          isUnavailable,
        };
      })
    );

    // Filter by dev_folders if configured
    const projects = hasDevFolderFilter
      ? allProjects.filter((p) => isInDevFolders(p.path, devFolders))
      : allProjects;

    return NextResponse.json({ projects, empty: false });
  } catch (error) {
    // Check if file doesn't exist
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ projects: [], empty: true });
    }

    // Check if it's a Zod validation error
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid registry format', code: 'INVALID_REGISTRY' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Unable to read projects', code: 'READ_ERROR' },
      { status: 500 }
    );
  }
}
