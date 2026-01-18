import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { getRegistryPath } from './paths.js';
import type { Registry, Project } from '@specflow/shared';

/**
 * Registry management for SpecFlow projects
 * Maintains a central registry at ~/.specflow/registry.json
 */

/** Default empty registry */
function createEmptyRegistry(): Registry {
  return {
    projects: {},
    config: {
      dev_folders: ['~/dev'],
    },
  };
}

/** Read the registry file, creating it if it doesn't exist */
export function readRegistry(): Registry {
  const registryPath = getRegistryPath();

  if (!existsSync(registryPath)) {
    const registry = createEmptyRegistry();
    writeRegistry(registry);
    return registry;
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    return JSON.parse(content) as Registry;
  } catch {
    // If corrupted, recreate
    const registry = createEmptyRegistry();
    writeRegistry(registry);
    return registry;
  }
}

/** Write the registry file */
export function writeRegistry(registry: Registry): void {
  const registryPath = getRegistryPath();
  const dir = dirname(registryPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

/** Register a project in the registry */
export function registerProject(
  id: string,
  name: string,
  path: string,
): void {
  const registry = readRegistry();

  registry.projects[id] = {
    path,
    name,
    registered_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };

  writeRegistry(registry);
}

/** Update the last_seen timestamp for a project */
export function touchProject(id: string): void {
  const registry = readRegistry();

  if (registry.projects[id]) {
    registry.projects[id].last_seen = new Date().toISOString();
    writeRegistry(registry);
  }
}

/** Remove a project from the registry */
export function unregisterProject(id: string): boolean {
  const registry = readRegistry();

  if (registry.projects[id]) {
    delete registry.projects[id];
    writeRegistry(registry);
    return true;
  }

  return false;
}

/** Check if a project is registered */
export function isRegistered(id: string): boolean {
  const registry = readRegistry();
  return id in registry.projects;
}

/** Get all registered projects */
export function getRegisteredProjects(): Record<string, Project> {
  const registry = readRegistry();
  return registry.projects;
}
