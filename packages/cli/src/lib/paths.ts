import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Path resolution utilities for SpecFlow
 */

/** Get the SpecFlow home directory (~/.specflow) */
export function getSpecflowHome(): string {
  return join(homedir(), '.specflow');
}

/** Get the registry file path */
export function getRegistryPath(): string {
  return join(getSpecflowHome(), 'registry.json');
}

/** Get the .specify directory for a project */
export function getSpecifyDir(projectPath: string = process.cwd()): string {
  return join(resolve(projectPath), '.specify');
}

/** Get the state file path for a project */
export function getStatePath(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'orchestration-state.json');
}

/** Get the ROADMAP.md path for a project */
export function getRoadmapPath(projectPath: string = process.cwd()): string {
  return join(resolve(projectPath), 'ROADMAP.md');
}

/** Get the specs directory for a project */
export function getSpecsDir(projectPath: string = process.cwd()): string {
  return join(resolve(projectPath), 'specs');
}

/** Get the memory directory for a project */
export function getMemoryDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'memory');
}

/** Get the templates directory for a project */
export function getTemplatesDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'templates');
}

/** Check if a path exists */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/** Check if current directory is a SpecFlow project */
export function isSpecflowProject(projectPath: string = process.cwd()): boolean {
  return pathExists(getStatePath(projectPath)) || pathExists(getSpecifyDir(projectPath));
}

/** Find project root by looking for .specify directory */
export function findProjectRoot(startPath: string = process.cwd()): string | null {
  let current = resolve(startPath);
  const root = '/';

  while (current !== root) {
    if (pathExists(join(current, '.specify'))) {
      return current;
    }
    current = resolve(current, '..');
  }

  return null;
}
