import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Path resolution utilities for SpecFlow
 *
 * Design principle:
 * - `.specify/` = Repo knowledge (memory docs, phases, templates, archive, history)
 * - `.specflow/` = Operational state (manifest, orchestration state, workflows)
 *
 * If you stop using SpecFlow, delete `.specflow/` and lose nothing valuable.
 */

/** Get the SpecFlow home directory (~/.specflow) - user scope */
export function getSpecflowHome(): string {
  return join(homedir(), '.specflow');
}

/** Get the registry file path - user scope */
export function getRegistryPath(): string {
  return join(getSpecflowHome(), 'registry.json');
}

/** Get the .specflow directory for a project (operational state) */
export function getSpecflowDir(projectPath: string = process.cwd()): string {
  return join(resolve(projectPath), '.specflow');
}

/** Get the .specify directory for a project (repo knowledge) */
export function getSpecifyDir(projectPath: string = process.cwd()): string {
  return join(resolve(projectPath), '.specify');
}

/** Get the state file path for a project */
export function getStatePath(projectPath: string = process.cwd()): string {
  return join(getSpecflowDir(projectPath), 'orchestration-state.json');
}

/** Get the manifest file path for a project */
export function getManifestPath(projectPath: string = process.cwd()): string {
  return join(getSpecflowDir(projectPath), 'manifest.json');
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

/** Get the phases directory for a project */
export function getPhasesDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'phases');
}

/** Get the archive directory for a project */
export function getArchiveDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'archive');
}

/** Get the history directory for a project */
export function getHistoryDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'history');
}

/** Get the discovery directory for a project */
export function getDiscoveryDir(projectPath: string = process.cwd()): string {
  return join(getSpecifyDir(projectPath), 'discovery');
}

/** Check if a path exists */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/** Check if current directory is a SpecFlow project */
export function isSpecflowProject(projectPath: string = process.cwd()): boolean {
  // Check for either operational state or repo knowledge directories
  return (
    pathExists(getSpecflowDir(projectPath)) ||
    pathExists(getSpecifyDir(projectPath))
  );
}

/** Find project root by looking for .specflow or .specify directory */
export function findProjectRoot(startPath: string = process.cwd()): string | null {
  let current = resolve(startPath);
  const root = '/';

  while (current !== root) {
    if (pathExists(join(current, '.specflow')) || pathExists(join(current, '.specify'))) {
      return current;
    }
    current = resolve(current, '..');
  }

  return null;
}
