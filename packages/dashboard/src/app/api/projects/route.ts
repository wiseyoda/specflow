import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { RegistrySchema } from '@specflow/shared';
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

/**
 * Discover git repositories in dev folders that aren't registered
 */
async function discoverGitRepos(
  devFolders: string[],
  registeredPaths: Set<string>
): Promise<string[]> {
  const discovered: string[] = [];

  for (const folder of devFolders) {
    const expanded = expandPath(folder);
    try {
      const entries = await fs.readdir(expanded, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const repoPath = path.join(expanded, entry.name);
          // Skip if already registered
          if (registeredPaths.has(path.normalize(repoPath))) {
            continue;
          }
          // Check if it's a git repo
          const gitPath = path.join(repoPath, '.git');
          try {
            await fs.access(gitPath);
            discovered.push(repoPath);
          } catch {
            // Not a git repo, skip
          }
        }
      }
    } catch {
      // Folder not readable, skip
    }
  }

  return discovered;
}

/**
 * Create a stable ID for discovered projects using base64url encoding
 */
function createDiscoveredId(projectPath: string): string {
  const encoded = Buffer.from(projectPath).toString('base64url');
  return `discovered-${encoded}`;
}

export async function GET() {
  const registryPath = path.join(homedir(), '.specflow', 'registry.json');

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
    const filteredProjects = hasDevFolderFilter
      ? allProjects.filter((p) => isInDevFolders(p.path, devFolders))
      : allProjects;

    // Discover unregistered git repos in dev_folders
    let discoveredProjects: typeof filteredProjects = [];
    if (hasDevFolderFilter) {
      const registeredPaths = new Set(
        allProjects.map((p) => path.normalize(p.path))
      );
      const discoveredPaths = await discoverGitRepos(devFolders, registeredPaths);
      discoveredProjects = discoveredPaths.map((repoPath) => ({
        id: createDiscoveredId(repoPath),
        name: path.basename(repoPath),
        path: repoPath,
        registered_at: new Date().toISOString(),
        isUnavailable: false,
        isDiscovered: true,
      }));
    }

    // Merge registered and discovered projects
    const projects = [...filteredProjects, ...discoveredProjects];

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
