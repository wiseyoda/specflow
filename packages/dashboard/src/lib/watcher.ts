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
  type TasksData,
} from '@specflow/shared';
import { parseTasks, type ParseTasksOptions } from './task-parser';

// Debounce delay in milliseconds
const DEBOUNCE_MS = 200;

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_MS = 30000;

// Global state for the watcher singleton
let watcher: FSWatcher | null = null;
let registryPath: string;
let currentRegistry: Registry | null = null;
let watchedStatePaths: Set<string> = new Set();
let watchedTasksPaths: Set<string> = new Set();

// Event listeners (SSE connections)
type EventListener = (event: SSEEvent) => void;
const listeners: Set<EventListener> = new Set();

// Debounce timers
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();


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
 * Also includes file modification time for activity tracking
 */
async function readState(projectId: string, statePath: string): Promise<OrchestrationState | null> {
  try {
    const [content, stats] = await Promise.all([
      fs.readFile(statePath, 'utf-8'),
      fs.stat(statePath),
    ]);
    const parsed = OrchestrationStateSchema.parse(JSON.parse(content));
    // Add file mtime for activity tracking (more reliable than last_updated field)
    return {
      ...parsed,
      _fileMtime: stats.mtime.toISOString(),
    };
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
 * Read and parse tasks file for a project
 * @param projectId The project UUID
 * @param tasksPath Path to tasks.md file
 * @param options Optional parsing options (e.g., current_tasks from state)
 */
async function readTasks(
  projectId: string,
  tasksPath: string,
  options?: ParseTasksOptions
): Promise<TasksData | null> {
  try {
    const content = await fs.readFile(tasksPath, 'utf-8');
    const parsed = parseTasks(content, projectId, options);
    return parsed;
  } catch (error) {
    // File doesn't exist or is invalid
    console.error(`[Watcher] Error reading tasks for ${projectId}:`, error);
    return null;
  }
}

/**
 * Handle tasks file change
 * Also reads state to get current in-progress tasks for status derivation
 */
async function handleTasksChange(projectId: string, tasksPath: string): Promise<void> {
  // Get state to check for current_tasks (for in_progress status)
  let currentTasks: string[] | undefined;
  if (currentRegistry) {
    const project = currentRegistry.projects[projectId];
    if (project) {
      const statePath = path.join(project.path, '.specify', 'orchestration-state.json');
      const state = await readState(projectId, statePath);
      currentTasks = state?.orchestration?.implement?.current_tasks as string[] | undefined;
    }
  }

  const tasks = await readTasks(projectId, tasksPath, { currentTasks });
  if (!tasks) return;

  broadcast({
    type: 'tasks',
    timestamp: new Date().toISOString(),
    projectId,
    data: tasks,
  });
}

/**
 * Get tasks.md path for a project based on current phase
 * Tasks are in specs/{phase_number}-{phase_name}/tasks.md
 */
async function getTasksPathForProject(projectPath: string, statePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    const phase = state?.orchestration?.phase;

    if (phase?.number && phase?.name) {
      // Try exact match: specs/{number}-{name}/tasks.md
      const tasksPath = path.join(projectPath, 'specs', `${phase.number}-${phase.name}`, 'tasks.md');
      try {
        await fs.access(tasksPath);
        return tasksPath;
      } catch {
        // File doesn't exist yet, still watch the path for when it's created
        return tasksPath;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Track which tasks path each project is using (to detect phase changes)
const projectTasksPaths: Map<string, string> = new Map();

/**
 * Update watched paths based on registry contents
 */
async function updateWatchedPaths(registry: Registry): Promise<void> {
  if (!watcher) return;

  const newStatePaths = new Set<string>();
  const newTasksPaths = new Set<string>();

  // Get state and tasks file paths for all projects
  for (const [projectId, project] of Object.entries(registry.projects)) {
    const statePath = path.join(project.path, '.specify', 'orchestration-state.json');
    newStatePaths.add(statePath);

    // Add new state paths to watcher
    if (!watchedStatePaths.has(statePath)) {
      watcher.add(statePath);
      console.log(`[Watcher] Added state file: ${statePath}`);
    }

    // Get tasks path based on current phase from state
    const tasksPath = await getTasksPathForProject(project.path, statePath);
    const previousTasksPath = projectTasksPaths.get(projectId);

    if (tasksPath) {
      newTasksPaths.add(tasksPath);

      // Check if the tasks path changed (phase changed)
      const pathChanged = previousTasksPath && previousTasksPath !== tasksPath;

      // Add new tasks paths to watcher and broadcast initial data
      if (!watchedTasksPaths.has(tasksPath) || pathChanged) {
        watcher.add(tasksPath);
        console.log(`[Watcher] Added tasks file: ${tasksPath}`);

        // Read state to get current_tasks for in_progress status
        const state = await readState(projectId, statePath);
        const currentTasks = state?.orchestration?.implement?.current_tasks as string[] | undefined;

        // Broadcast tasks data for newly watched path (or empty if file doesn't exist)
        const tasks = await readTasks(projectId, tasksPath, { currentTasks });
        broadcast({
          type: 'tasks',
          timestamp: new Date().toISOString(),
          projectId,
          data: tasks || { projectId, tasks: [], totalCount: 0, completedCount: 0, lastUpdated: new Date().toISOString() },
        });
      }

      // Track the current tasks path for this project
      projectTasksPaths.set(projectId, tasksPath);
    } else {
      // No tasks path (no phase set) - clear any existing tasks
      if (previousTasksPath) {
        broadcast({
          type: 'tasks',
          timestamp: new Date().toISOString(),
          projectId,
          data: { projectId, tasks: [], totalCount: 0, completedCount: 0, lastUpdated: new Date().toISOString() },
        });
        projectTasksPaths.delete(projectId);
      }
    }
  }

  // Remove old state paths from watcher
  for (const oldPath of watchedStatePaths) {
    if (!newStatePaths.has(oldPath)) {
      watcher.unwatch(oldPath);
      console.log(`[Watcher] Removed state file: ${oldPath}`);
    }
  }

  // Remove old tasks paths from watcher
  for (const oldPath of watchedTasksPaths) {
    if (!newTasksPaths.has(oldPath)) {
      watcher.unwatch(oldPath);
      console.log(`[Watcher] Removed tasks file: ${oldPath}`);
    }
  }

  watchedStatePaths = newStatePaths;
  watchedTasksPaths = newTasksPaths;
}

/**
 * Get project ID and file type for a watched file path
 */
function getProjectInfoForPath(filePath: string): { projectId: string; fileType: 'state' | 'tasks' } | null {
  if (!currentRegistry) return null;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const statePath = path.join(project.path, '.specify', 'orchestration-state.json');

    if (filePath === statePath) {
      return { projectId, fileType: 'state' };
    }

    // Check if this is a tasks file for this project
    // Tasks are in specs/{phase}/tasks.md
    const specsPrefix = path.join(project.path, 'specs') + path.sep;
    if (filePath.startsWith(specsPrefix) &&
        filePath.endsWith(`${path.sep}tasks.md`) &&
        watchedTasksPaths.has(filePath)) {
      return { projectId, fileType: 'tasks' };
    }
  }
  return null;
}

/**
 * Initialize the file watcher (singleton)
 */
export async function initWatcher(): Promise<void> {
  if (watcher) return; // Already initialized

  registryPath = path.join(homedir(), '.specflow', 'registry.json');
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

  // Handle file change/add events
  const handleFileEvent = (filePath: string) => {
    if (filePath === registryPath) {
      debouncedChange(filePath, handleRegistryChange);
    } else {
      // State or tasks file change
      const info = getProjectInfoForPath(filePath);
      if (info) {
        if (info.fileType === 'state') {
          debouncedChange(filePath, async () => {
            await handleStateChange(info.projectId, filePath);
            // When state changes, phase might have changed - update watched tasks paths
            if (currentRegistry) {
              await updateWatchedPaths(currentRegistry);
            }
          });
        } else if (info.fileType === 'tasks') {
          debouncedChange(filePath, () => handleTasksChange(info.projectId, filePath));
        }
      }
    }
  };

  // Listen for both change and add events
  watcher.on('change', handleFileEvent);
  watcher.on('add', handleFileEvent);

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
 * Get all current tasks data for registered projects
 * Also reads state to get current in-progress tasks for status derivation
 */
export async function getAllTasks(): Promise<Map<string, TasksData>> {
  const tasks = new Map<string, TasksData>();

  if (!currentRegistry) return tasks;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const statePath = path.join(project.path, '.specify', 'orchestration-state.json');
    const tasksPath = await getTasksPathForProject(project.path, statePath);
    if (tasksPath) {
      // Read state to get current_tasks for in_progress status
      const state = await readState(projectId, statePath);
      const currentTasks = state?.orchestration?.implement?.current_tasks as string[] | undefined;

      const projectTasks = await readTasks(projectId, tasksPath, { currentTasks });
      if (projectTasks) {
        tasks.set(projectId, projectTasks);
      }
    }
  }

  return tasks;
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
    watchedTasksPaths.clear();
    projectTasksPaths.clear();
    currentRegistry = null;
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();
    console.log('[Watcher] Closed');
  }
}
