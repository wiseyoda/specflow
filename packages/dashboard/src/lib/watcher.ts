import chokidar, { type FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import {
  RegistrySchema,
  OrchestrationStateSchema,
  type Registry,
  type OrchestrationState,
  type SSEEvent,
} from '@speckit/shared';

// Debounce delay in milliseconds
const DEBOUNCE_MS = 200;

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_MS = 30000;

// Global state for the watcher singleton
let watcher: FSWatcher | null = null;
let registryPath: string;
let currentRegistry: Registry | null = null;
let watchedStatePaths: Set<string> = new Set();

// Event listeners (SSE connections)
type EventListener = (event: SSEEvent) => void;
const listeners: Set<EventListener> = new Set();

// Debounce timers
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Broadcast event to all connected listeners
 */
function broadcast(event: SSEEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[Watcher] Error broadcasting event:', error);
    }
  });
}

/**
 * Debounced file change handler
 */
function debouncedChange(filePath: string, handler: () => Promise<void>): void {
  // Clear existing timer for this path
  const existingTimer = debounceTimers.get(filePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer
  const timer = setTimeout(async () => {
    debounceTimers.delete(filePath);
    try {
      await handler();
    } catch (error) {
      console.error(`[Watcher] Error handling change for ${filePath}:`, error);
    }
  }, DEBOUNCE_MS);

  debounceTimers.set(filePath, timer);
}

/**
 * Read and parse registry file
 */
async function readRegistry(): Promise<Registry | null> {
  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const parsed = RegistrySchema.parse(JSON.parse(content));
    return parsed;
  } catch (error) {
    // File doesn't exist or is invalid - return null
    console.error('[Watcher] Error reading registry:', error);
    return null;
  }
}

/**
 * Read and parse state file for a project
 */
async function readState(projectId: string, statePath: string): Promise<OrchestrationState | null> {
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const parsed = OrchestrationStateSchema.parse(JSON.parse(content));
    return parsed;
  } catch (error) {
    // File doesn't exist or is invalid
    console.error(`[Watcher] Error reading state for ${projectId}:`, error);
    return null;
  }
}

/**
 * Handle registry file change
 */
async function handleRegistryChange(): Promise<void> {
  const newRegistry = await readRegistry();
  if (!newRegistry) return;

  // Broadcast registry change
  broadcast({
    type: 'registry',
    timestamp: new Date().toISOString(),
    data: newRegistry,
  });

  // Update watched state paths
  await updateWatchedPaths(newRegistry);
  currentRegistry = newRegistry;
}

/**
 * Handle state file change
 */
async function handleStateChange(projectId: string, statePath: string): Promise<void> {
  const state = await readState(projectId, statePath);
  if (!state) return;

  broadcast({
    type: 'state',
    timestamp: new Date().toISOString(),
    projectId,
    data: state,
  });
}

/**
 * Update watched paths based on registry contents
 */
async function updateWatchedPaths(registry: Registry): Promise<void> {
  if (!watcher) return;

  const newPaths = new Set<string>();

  // Get state file paths for all projects
  for (const [projectId, project] of Object.entries(registry.projects)) {
    const statePath = path.join(project.path, '.specify', 'orchestration-state.json');
    newPaths.add(statePath);

    // Add new paths to watcher
    if (!watchedStatePaths.has(statePath)) {
      watcher.add(statePath);
      console.log(`[Watcher] Added state file: ${statePath}`);
    }
  }

  // Remove old paths from watcher
  for (const oldPath of watchedStatePaths) {
    if (!newPaths.has(oldPath)) {
      watcher.unwatch(oldPath);
      console.log(`[Watcher] Removed state file: ${oldPath}`);
    }
  }

  watchedStatePaths = newPaths;
}

/**
 * Get project ID for a state file path
 */
function getProjectIdForPath(statePath: string): string | null {
  if (!currentRegistry) return null;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const expectedPath = path.join(project.path, '.specify', 'orchestration-state.json');
    if (statePath === expectedPath) {
      return projectId;
    }
  }
  return null;
}

/**
 * Initialize the file watcher (singleton)
 */
export async function initWatcher(): Promise<void> {
  if (watcher) return; // Already initialized

  registryPath = path.join(homedir(), '.speckit', 'registry.json');
  console.log(`[Watcher] Initializing, watching: ${registryPath}`);

  // Create watcher for registry
  watcher = chokidar.watch(registryPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  // Handle registry changes
  watcher.on('change', (filePath) => {
    if (filePath === registryPath) {
      debouncedChange(filePath, handleRegistryChange);
    } else {
      // State file change
      const projectId = getProjectIdForPath(filePath);
      if (projectId) {
        debouncedChange(filePath, () => handleStateChange(projectId, filePath));
      }
    }
  });

  // Handle watcher errors
  watcher.on('error', (error) => {
    console.error('[Watcher] Error:', error);
  });

  // Load initial registry and set up state file watching
  currentRegistry = await readRegistry();
  if (currentRegistry) {
    await updateWatchedPaths(currentRegistry);
  }

  console.log('[Watcher] Initialized successfully');
}

/**
 * Add an event listener (SSE connection)
 */
export function addListener(listener: EventListener): () => void {
  listeners.add(listener);
  console.log(`[Watcher] Listener added, total: ${listeners.size}`);

  // Return cleanup function
  return () => {
    listeners.delete(listener);
    console.log(`[Watcher] Listener removed, total: ${listeners.size}`);
  };
}

/**
 * Get current registry data (for initial load)
 */
export function getCurrentRegistry(): Registry | null {
  return currentRegistry;
}

/**
 * Get all current state data for registered projects
 */
export async function getAllStates(): Promise<Map<string, OrchestrationState>> {
  const states = new Map<string, OrchestrationState>();

  if (!currentRegistry) return states;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const statePath = path.join(project.path, '.specify', 'orchestration-state.json');
    const state = await readState(projectId, statePath);
    if (state) {
      states.set(projectId, state);
    }
  }

  return states;
}

/**
 * Start heartbeat timer for a listener
 */
export function startHeartbeat(listener: EventListener): NodeJS.Timeout {
  return setInterval(() => {
    listener({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    });
  }, HEARTBEAT_MS);
}

/**
 * Cleanup watcher (for testing/shutdown)
 */
export async function closeWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    listeners.clear();
    watchedStatePaths.clear();
    currentRegistry = null;
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();
    console.log('[Watcher] Closed');
  }
}
