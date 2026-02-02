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
  type WorkflowData,
  type PhasesData,
  type SessionContent,
  type SessionQuestion,
} from '@specflow/shared';
import { existsSync, readFileSync } from 'fs';
import { parseTasks, type ParseTasksOptions } from './task-parser';
import { parseRoadmapToPhasesData } from './roadmap-parser';
import {
  getStateFilePath,
  getStateFilePathSync,
  migrateStateFiles,
} from './state-paths';
import { getProjectSessionDir, getClaudeProjectsDir } from './project-hash';
import { reconcileRunners, runOrchestration, isRunnerActive } from './services/orchestration-runner';
import { orchestrationService, readDashboardState } from './services/orchestration-service';
import { workflowService } from './services/workflow-service';
import { buildWorkflowData, buildWorkflowDataFast } from './services/runtime-state';

// Debounce delay in milliseconds
const DEBOUNCE_MS = 200;

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_MS = 30000;

// Global state for the watcher singleton
let watcher: FSWatcher | null = null;
let sessionWatcher: FSWatcher | null = null;
let registryPath: string;
let currentRegistry: Registry | null = null;
let watchedStatePaths: Set<string> = new Set();
let watchedTasksPaths: Set<string> = new Set();
let watchedWorkflowPaths: Set<string> = new Set();
let watchedPhasesPaths: Set<string> = new Set();
let watchedSessionDirs: Set<string> = new Set();

// Cache workflow data to detect actual changes
const workflowCache: Map<string, string> = new Map(); // projectId -> JSON string

// Cache phases data to detect actual changes
const phasesCache: Map<string, string> = new Map(); // projectId -> JSON string

// Cache session content to detect actual changes
const sessionCache: Map<string, string> = new Map(); // sessionId -> JSON string

// Cache questions to detect actual changes and avoid duplicate session:question events
const questionCache: Map<string, string> = new Map(); // sessionId -> JSON string of questions

// Session debounce (faster for real-time feel)
const SESSION_DEBOUNCE_MS = 100;

// Event listeners (SSE connections)
type EventListener = (event: SSEEvent) => void;
const listeners: Set<EventListener> = new Set();

// Debounce timers
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();


/**
 * Broadcast event to all connected listeners
 */
export function broadcast(event: SSEEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[Watcher] Error broadcasting event:', error);
    }
  });
}

/**
 * Broadcast a session:question event for workflow-mode questions
 * Called by workflow-service when structured_output has questions
 * Uses questionCache to deduplicate - won't broadcast same questions twice
 */
export function broadcastWorkflowQuestions(
  sessionId: string,
  projectId: string,
  questions: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>
): void {
  if (!questions || questions.length === 0) return;

  // Check if these questions were already broadcast (deduplication)
  const questionsFingerprint = JSON.stringify(questions.map(q => ({ q: q.question, h: q.header })));
  const cachedQuestions = questionCache.get(sessionId) ?? '';
  if (questionsFingerprint === cachedQuestions) {
    // Same questions already broadcast, skip
    return;
  }
  questionCache.set(sessionId, questionsFingerprint);

  const mappedQuestions = questions.map((q) => ({
    question: q.question,
    header: q.header,
    options: (q.options || []).map((opt) => ({
      label: opt.label,
      description: opt.description ?? '',
    })),
    multiSelect: q.multiSelect,
  }));

  broadcast({
    type: 'session:question',
    timestamp: new Date().toISOString(),
    projectId,
    sessionId,
    data: {
      questions: mappedQuestions,
    },
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
    // Use safeParse to gracefully handle older/incompatible state file formats
    // from other projects without spamming logs
    const result = OrchestrationStateSchema.safeParse(JSON.parse(content));
    if (!result.success) {
      // Silently skip projects with incompatible state schemas
      // These are typically older projects that haven't been updated
      return null;
    }
    // Add file mtime for activity tracking (more reliable than last_updated field)
    return {
      ...result.data,
      _fileMtime: stats.mtime.toISOString(),
    };
  } catch (error) {
    // Silently return null for missing files (ENOENT) or JSON parse errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    // Also silently handle JSON parse errors (corrupted files)
    if (error instanceof SyntaxError) {
      return null;
    }
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

  // Update project path map for session watching
  updateProjectPathMap();
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
    // Silently return null for missing files (ENOENT)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
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
      const statePath = await getStateFilePath(project.path);
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
 * Handle workflow index file change.
 * Uses runtime aggregation instead of reading index.json directly.
 */
async function handleWorkflowChange(projectId: string, _indexPath: string): Promise<void> {
  const projectPath = projectPathMap.get(projectId);
  if (!projectPath) return;

  const data = await buildWorkflowData(projectId, projectPath);

  // Check if data actually changed (avoid duplicate broadcasts)
  const dataJson = JSON.stringify(data);
  const cached = workflowCache.get(projectId);
  if (cached === dataJson) {
    return; // No change
  }
  workflowCache.set(projectId, dataJson);

  broadcast({
    type: 'workflow',
    timestamp: new Date().toISOString(),
    projectId,
    data,
  });
}

/**
 * Read and parse ROADMAP.md for a project
 */
async function readPhases(projectId: string, roadmapPath: string): Promise<PhasesData | null> {
  try {
    const content = await fs.readFile(roadmapPath, 'utf-8');
    return parseRoadmapToPhasesData(content, projectId);
  } catch (error) {
    // Silently return null for missing files (ENOENT)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    console.error(`[Watcher] Error reading ROADMAP.md for ${projectId}:`, error);
    return null;
  }
}

/**
 * Handle ROADMAP.md file change
 */
async function handlePhasesChange(projectId: string, roadmapPath: string): Promise<void> {
  const data = await readPhases(projectId, roadmapPath);
  if (!data) return;

  // Check if data actually changed (avoid duplicate broadcasts)
  const dataJson = JSON.stringify(data);
  const cached = phasesCache.get(projectId);
  if (cached === dataJson) {
    return; // No change
  }
  phasesCache.set(projectId, dataJson);

  broadcast({
    type: 'phases',
    timestamp: new Date().toISOString(),
    projectId,
    data,
  });
}

/**
 * Get tasks.md path for a project based on current phase
 * Tasks are in specs/{phase_number}-{phase_name_slug}/tasks.md
 * The directory name uses the branch format (lowercase, hyphenated)
 */
async function getTasksPathForProject(projectPath: string, statePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    const phase = state?.orchestration?.phase;

    if (phase?.number) {
      // The branch field has the correct format for the directory name
      // e.g., branch: "0082-code-review-20260118" -> directory is "0082-code-review-20260118"
      let dirName: string;
      if (phase.branch) {
        dirName = phase.branch;
      } else if (phase.name) {
        // Fallback: derive slug from name (lowercase, spaces to hyphens)
        const nameSlug = phase.name.toLowerCase().replace(/\s+/g, '-');
        dirName = `${phase.number}-${nameSlug}`;
      } else {
        return null;
      }

      const tasksPath = path.join(projectPath, 'specs', dirName, 'tasks.md');
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
  const newWorkflowPaths = new Set<string>();
  const newPhasesPaths = new Set<string>();

  // Get state, tasks, workflow, and phases file paths for all projects
  for (const [projectId, project] of Object.entries(registry.projects)) {
    // Auto-migrate state files from .specify/ to .specflow/ if needed
    await migrateStateFiles(project.path);

    const statePath = await getStateFilePath(project.path);
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

    // Add workflow index path for this project
    const workflowIndexPath = path.join(project.path, '.specflow', 'workflows', 'index.json');
    newWorkflowPaths.add(workflowIndexPath);

    // Add new workflow paths to watcher and broadcast initial data
    if (!watchedWorkflowPaths.has(workflowIndexPath)) {
      watcher.add(workflowIndexPath);
      console.log(`[Watcher] Added workflow index: ${workflowIndexPath}`);

      const data = await buildWorkflowData(projectId, project.path);
      workflowCache.set(projectId, JSON.stringify(data));
      broadcast({
        type: 'workflow',
        timestamp: new Date().toISOString(),
        projectId,
        data,
      });
    }

    // Add ROADMAP.md path for this project
    const roadmapPath = path.join(project.path, 'ROADMAP.md');
    newPhasesPaths.add(roadmapPath);

    // Add new phases paths to watcher and broadcast initial data
    if (!watchedPhasesPaths.has(roadmapPath)) {
      watcher.add(roadmapPath);
      console.log(`[Watcher] Added ROADMAP.md: ${roadmapPath}`);

      // Broadcast initial phases data
      const data = await readPhases(projectId, roadmapPath);
      if (data) {
        phasesCache.set(projectId, JSON.stringify(data));
        broadcast({
          type: 'phases',
          timestamp: new Date().toISOString(),
          projectId,
          data,
        });
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

  // Remove old workflow paths from watcher
  for (const oldPath of watchedWorkflowPaths) {
    if (!newWorkflowPaths.has(oldPath)) {
      watcher.unwatch(oldPath);
      console.log(`[Watcher] Removed workflow index: ${oldPath}`);
    }
  }

  // Remove old phases paths from watcher
  for (const oldPath of watchedPhasesPaths) {
    if (!newPhasesPaths.has(oldPath)) {
      watcher.unwatch(oldPath);
      console.log(`[Watcher] Removed ROADMAP.md: ${oldPath}`);
    }
  }

  watchedStatePaths = newStatePaths;
  watchedTasksPaths = newTasksPaths;
  watchedWorkflowPaths = newWorkflowPaths;
  watchedPhasesPaths = newPhasesPaths;
}

/**
 * Get project ID and file type for a watched file path
 */
function getProjectInfoForPath(filePath: string): { projectId: string; fileType: 'state' | 'tasks' | 'workflow' | 'phases' } | null {
  if (!currentRegistry) return null;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    // Check both v3 (.specflow/) and v2 (.specify/) paths for state file
    const statePathV3 = path.join(project.path, '.specflow', 'orchestration-state.json');
    const statePathV2 = path.join(project.path, '.specify', 'orchestration-state.json');

    if (filePath === statePathV3 || filePath === statePathV2) {
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

    // Check if this is a workflow index file for this project
    const workflowIndexPath = path.join(project.path, '.specflow', 'workflows', 'index.json');
    if (filePath === workflowIndexPath && watchedWorkflowPaths.has(filePath)) {
      return { projectId, fileType: 'workflow' };
    }

    // Check if this is a ROADMAP.md file for this project
    const roadmapPath = path.join(project.path, 'ROADMAP.md');
    if (filePath === roadmapPath && watchedPhasesPaths.has(filePath)) {
      return { projectId, fileType: 'phases' };
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
      // State, tasks, workflow, or phases file change
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
        } else if (info.fileType === 'workflow') {
          debouncedChange(filePath, () => handleWorkflowChange(info.projectId, filePath));
        } else if (info.fileType === 'phases') {
          debouncedChange(filePath, () => handlePhasesChange(info.projectId, filePath));
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
    updateProjectPathMap(); // For session watching

    // G5.10: Reconcile runners for all registered projects on startup
    // This detects orphaned runner state files from crashed processes
    for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
      try {
        const cleanedUpIds = reconcileRunners(project.path);
        const repoName = project.path.split('/').pop();

        // Use CLI dashboard state as single source of truth for orchestration status.
        // The legacy orchestration file can be out of sync (e.g., saying 'running'
        // when the CLI has moved to 'waiting_merge'). Dashboard state is more reliable.
        const dashboardState = readDashboardState(project.path);
        const activeId = dashboardState?.active?.id;
        const dashboardStatus = dashboardState?.active?.status;

        // Fallback to legacy file only if dashboard state is unavailable
        const legacyActive = orchestrationService.getActive(project.path);
        const effectiveId = activeId || legacyActive?.id;
        const effectiveStatus = dashboardStatus || legacyActive?.status;

        console.log(`[Watcher] Checking ${repoName}: id=${effectiveId ?? 'none'}, dashboardStatus=${dashboardStatus ?? 'none'}, legacyStatus=${legacyActive?.status ?? 'none'}, runnerActive=${effectiveId ? isRunnerActive(effectiveId) : 'n/a'}`);

        if (effectiveId && effectiveStatus === 'running' && !isRunnerActive(effectiveId)) {
          // Only auto-restart if we found a runner state file (= dashboard was managing it).
          // If no runner state file exists, this was likely CLI-managed or the server was
          // stopped gracefully. User can click "Resume" to restart manually.
          if (cleanedUpIds.has(effectiveId)) {
            console.log(`[Watcher] Restarting runner for orchestration ${effectiveId} in ${repoName} (previous runner was orphaned)`);
            runOrchestration(projectId, effectiveId).catch(error => {
              console.error(`[Watcher] Failed to restart runner for ${effectiveId}:`, error);
            });
          } else {
            console.log(`[Watcher] Active orchestration in ${repoName} has no previous runner state (manual resume available)`);
          }
        }
      } catch (error) {
        console.error(`[Watcher] Error reconciling runners for ${projectId}:`, error);
      }
    }
  }

  // Initialize session file watcher
  await initSessionWatcher();

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

  // Load states for all projects in parallel
  const projectEntries = Object.entries(currentRegistry.projects);
  const results = await Promise.all(
    projectEntries.map(async ([projectId, project]) => {
      const statePath = await getStateFilePath(project.path);
      const state = await readState(projectId, statePath);
      return state ? { projectId, state } : null;
    })
  );

  for (const result of results) {
    if (result) {
      states.set(result.projectId, result.state);
    }
  }

  return states;
}

/**
 * Get all current tasks data for registered projects
 * Also reads state to get current in-progress tasks for status derivation
 * @param cachedStates Optional pre-loaded states to avoid redundant reads
 */
export async function getAllTasks(
  cachedStates?: Map<string, OrchestrationState>
): Promise<Map<string, TasksData>> {
  const tasks = new Map<string, TasksData>();

  if (!currentRegistry) return tasks;

  // Load tasks for all projects in parallel
  const projectEntries = Object.entries(currentRegistry.projects);
  const results = await Promise.all(
    projectEntries.map(async ([projectId, project]) => {
      const statePath = await getStateFilePath(project.path);
      const tasksPath = await getTasksPathForProject(project.path, statePath);
      if (!tasksPath) return null;

      // Use cached state if available, otherwise read
      let state = cachedStates?.get(projectId);
      if (!state) {
        state = (await readState(projectId, statePath)) ?? undefined;
      }
      const currentTasks = state?.orchestration?.implement?.current_tasks as string[] | undefined;

      const projectTasks = await readTasks(projectId, tasksPath, { currentTasks });
      return projectTasks ? { projectId, tasks: projectTasks } : null;
    })
  );

  for (const result of results) {
    if (result) {
      tasks.set(result.projectId, result.tasks);
    }
  }

  return tasks;
}

/**
 * Get all current workflow data for registered projects.
 * Includes both dashboard-tracked sessions AND discovered CLI sessions.
 * @param fastMode If true, skips expensive session discovery for faster initial load
 */
export async function getAllWorkflows(fastMode = false): Promise<Map<string, WorkflowData>> {
  const workflows = new Map<string, WorkflowData>();

  if (!currentRegistry) return workflows;

  // Load workflows for all projects in parallel
  const projectEntries = Object.entries(currentRegistry.projects);
  const results = await Promise.all(
    projectEntries.map(async ([projectId, project]) => {
      const data = fastMode
        ? await buildWorkflowDataFast(projectId, project.path)
        : await buildWorkflowData(projectId, project.path);
      return { projectId, data };
    })
  );

  for (const { projectId, data } of results) {
    workflows.set(projectId, data);
    // Update cache
    workflowCache.set(projectId, JSON.stringify(data));
  }

  return workflows;
}

/**
 * Get all current phases data for registered projects
 */
export async function getAllPhases(): Promise<Map<string, PhasesData>> {
  const phases = new Map<string, PhasesData>();

  if (!currentRegistry) return phases;

  // Load phases for all projects in parallel
  const projectEntries = Object.entries(currentRegistry.projects);
  const results = await Promise.all(
    projectEntries.map(async ([projectId, project]) => {
      const roadmapPath = path.join(project.path, 'ROADMAP.md');
      const data = await readPhases(projectId, roadmapPath);
      return data ? { projectId, data } : null;
    })
  );

  for (const result of results) {
    if (result) {
      phases.set(result.projectId, result.data);
      // Update cache
      phasesCache.set(result.projectId, JSON.stringify(result.data));
    }
  }

  return phases;
}

/**
 * Load all data in parallel for fast initial SSE connection.
 * Optimizes by:
 * 1. Running states, workflows (fast), and phases in parallel
 * 2. Passing cached states to tasks loading (avoids redundant reads)
 * 3. Passing cached workflows to sessions loading (avoids redundant calls)
 */
export async function getAllDataParallel(): Promise<{
  states: Map<string, OrchestrationState>;
  tasks: Map<string, TasksData>;
  workflows: Map<string, WorkflowData>;
  phases: Map<string, PhasesData>;
  sessions: SessionWithProject[];
}> {
  // Phase 1: Load states, workflows (fast mode), and phases in parallel
  // These have no dependencies on each other
  const [states, workflows, phases] = await Promise.all([
    getAllStates(),
    getAllWorkflows(true), // Fast mode: skip expensive session discovery
    getAllPhases(),
  ]);

  // Phase 2: Load tasks and sessions in parallel
  // Tasks uses cached states, sessions uses cached workflows
  const [tasks, sessions] = await Promise.all([
    getAllTasks(states), // Pass cached states to avoid re-reading
    getAllSessions(workflows), // Pass cached workflows to avoid re-computing
  ]);

  return { states, tasks, workflows, phases, sessions };
}

/**
 * Session data with project context for initial load
 */
export interface SessionWithProject {
  projectId: string;
  sessionId: string;
  content: SessionContent;
}

// Staleness threshold - sessions not modified in 30 minutes are considered stale
const SESSION_STALE_MS = 30 * 60 * 1000;

/**
 * Check if a session file is stale (not modified recently)
 */
async function isSessionStale(sessionPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(sessionPath);
    const age = Date.now() - stat.mtimeMs;
    return age > SESSION_STALE_MS;
  } catch {
    return true; // File doesn't exist or can't be accessed
  }
}

/**
 * Get all current session content for active sessions
 * Called on SSE connect to send initial session data
 * @param cachedWorkflows Optional pre-loaded workflows to avoid redundant calls
 */
export async function getAllSessions(
  cachedWorkflows?: Map<string, WorkflowData>
): Promise<SessionWithProject[]> {
  if (!currentRegistry) return [];

  // Use cached workflows or load them (fast mode since we only need session IDs)
  const workflows = cachedWorkflows ?? await getAllWorkflows(true);

  // Collect all session load tasks to run in parallel
  const sessionLoadTasks: Promise<SessionWithProject | null>[] = [];

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const workflowData = workflows.get(projectId);
    if (!workflowData) continue;

    // Collect session IDs to load - current execution and recent active sessions
    const sessionIdsToLoad: string[] = [];

    // Add current execution's session if it's active
    if (workflowData.currentExecution) {
      const status = workflowData.currentExecution.status;
      if (status === 'running' || status === 'waiting_for_input' || status === 'detached') {
        sessionIdsToLoad.push(workflowData.currentExecution.sessionId);
      }
    }

    // Also check recent sessions that might be active
    for (const session of workflowData.sessions) {
      const status = session.status;
      if ((status === 'running' || status === 'waiting_for_input' || status === 'detached') &&
          !sessionIdsToLoad.includes(session.sessionId)) {
        sessionIdsToLoad.push(session.sessionId);
      }
    }

    // Create parallel load tasks for each session
    const sessionDir = getSessionDirectory(project.path);
    for (const sessionId of sessionIdsToLoad) {
      sessionLoadTasks.push(
        (async (): Promise<SessionWithProject | null> => {
          const sessionPath = path.join(sessionDir, `${sessionId}.jsonl`);
          try {
            // Skip stale sessions - they're marked as "running" but haven't been modified recently
            if (await isSessionStale(sessionPath)) {
              return null;
            }

            const content = await parseSessionContent(sessionPath);
            if (content) {
              // Update caches for future change detection
              sessionProjectMap.set(sessionId, projectId);
              sessionCache.set(sessionId, JSON.stringify(content));
              return { projectId, sessionId, content };
            }
          } catch {
            // Session file might not exist yet or is inaccessible
          }
          return null;
        })()
      );
    }
  }

  // Run all session loads in parallel
  const results = await Promise.all(sessionLoadTasks);
  return results.filter((r): r is SessionWithProject => r !== null);
}

// ============================================================================
// Session File Watching (T011-T015)
// ============================================================================

import { parseSessionLines, type SessionData } from './session-parser';

/**
 * Map of projectId to projectPath for session directory lookup
 */
const projectPathMap: Map<string, string> = new Map();

/**
 * Map of sessionId to projectId for event broadcasting
 */
const sessionProjectMap: Map<string, string> = new Map();

/**
 * Get session directory path for a project
 * T011: Uses getProjectSessionDir from project-hash.ts
 */
function getSessionDirectory(projectPath: string): string {
  return getProjectSessionDir(projectPath);
}

/**
 * Parse session JSONL file and return SessionContent for SSE
 * T013/T014: Parse JSONL and extract messages
 */
async function parseSessionContent(sessionPath: string): Promise<SessionContent | null> {
  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const sessionData = parseSessionLines(lines);

    if (!sessionData || sessionData.messages.length === 0) {
      return null;
    }

    return {
      messages: sessionData.messages,
      filesModified: Array.from(sessionData.filesModified),
      elapsedMs: calculateElapsedMs(sessionData.startTime),
      currentTodos: sessionData.currentTodos,
      workflowOutput: sessionData.workflowOutput,
      agentTasks: sessionData.agentTasks,
    };
  } catch (error) {
    console.error(`[Watcher] Error parsing session file ${sessionPath}:`, error);
    return null;
  }
}

/**
 * Calculate elapsed time from start time
 */
function calculateElapsedMs(startTime?: string): number {
  if (!startTime) return 0;
  try {
    return Date.now() - new Date(startTime).getTime();
  } catch {
    return 0;
  }
}

/**
 * Extract questions from session content for session:question events
 * T015: Detect AskUserQuestion tool calls AND structured_output questions (CLI mode)
 */
function extractPendingQuestions(content: SessionContent): SessionQuestion[] {
  let latestQuestions: SessionQuestion[] = [];
  let latestQuestionIndex = -1;

  const normalizeOptions = (
    options: unknown
  ): Array<{ label: string; description?: string }> => {
    if (!Array.isArray(options)) {
      return [];
    }
    const normalized: Array<{ label: string; description?: string }> = [];
    for (const opt of options) {
      if (typeof opt === 'string') {
        normalized.push({ label: opt, description: '' });
      } else if (typeof opt === 'object' && opt !== null && 'label' in opt) {
        const optObj = opt as { label?: unknown; description?: unknown };
        if (typeof optObj.label === 'string') {
          normalized.push({
            label: optObj.label,
            description: typeof optObj.description === 'string' ? optObj.description : '',
          });
        }
      }
    }
    return normalized;
  };

  // Helper to process a questions array (replace latest question set)
  const processQuestions = (questionList: unknown[], messageIndex: number) => {
    const processed: SessionQuestion[] = [];
    for (const q of questionList) {
      if (typeof q === 'object' && q !== null && 'question' in q) {
        const qObj = q as Record<string, unknown>;
        const options = normalizeOptions(qObj.options);
        const multiSelectValue = typeof qObj.multiSelect === 'boolean'
          ? qObj.multiSelect
          : typeof qObj.multiselect === 'boolean'
            ? qObj.multiselect
            : undefined;

        processed.push({
          question: String(qObj.question),
          header: typeof qObj.header === 'string' ? qObj.header : undefined,
          options,
          multiSelect: multiSelectValue,
        });
      }
    }

    if (processed.length > 0) {
      latestQuestions = processed;
      latestQuestionIndex = messageIndex;
    }
  };

  for (let i = 0; i < content.messages.length; i++) {
    const message = content.messages[i];
    // Check for AskUserQuestion tool calls (interactive mode)
    if (message.role === 'assistant' && message.toolCalls) {
      for (const toolCall of message.toolCalls) {
        if (toolCall.name === 'AskUserQuestion' && toolCall.input) {
          const input = toolCall.input as Record<string, unknown>;
          const questionList = input?.questions;
          if (Array.isArray(questionList)) {
            processQuestions(questionList, i);
          }
        }
      }
    }

    // Check for structured_output questions (CLI/workflow mode)
    // In CLI mode, questions are in the result's structured_output when status is 'needs_input'
    const msgAny = message as Record<string, unknown>;
    if (msgAny.type === 'result' && msgAny.structured_output) {
      const structured = msgAny.structured_output as Record<string, unknown>;
      if (structured.status === 'needs_input' && Array.isArray(structured.questions)) {
        processQuestions(structured.questions, i);
      }
    }
  }

  if (latestQuestionIndex >= 0) {
    const hasUserResponse = content.messages
      .slice(latestQuestionIndex + 1)
      .some((msg) => msg.role === 'user');
    if (hasUserResponse) {
      return [];
    }
  }

  return latestQuestions;
}

/**
 * Handle session file change
 * T013: Called when JSONL file changes, parses and broadcasts events
 * Returns true if content actually changed and was broadcast
 */
async function handleSessionFileChange(sessionPath: string): Promise<boolean> {
  const sessionId = path.basename(sessionPath, '.jsonl');
  const projectId = sessionProjectMap.get(sessionId);

  if (!projectId) {
    // Try to find project from path
    const claudeProjectsDir = getClaudeProjectsDir();
    const relativePath = sessionPath.replace(claudeProjectsDir + path.sep, '');
    const dirName = relativePath.split(path.sep)[0];

    // Find project with matching hash
    for (const [id, projectPath] of projectPathMap.entries()) {
      const expectedDir = path.basename(getSessionDirectory(projectPath));
      if (dirName === expectedDir) {
        sessionProjectMap.set(sessionId, id);
        break;
      }
    }
  }

  const resolvedProjectId = sessionProjectMap.get(sessionId);
  if (!resolvedProjectId) {
    return false;
  }

  const content = await parseSessionContent(sessionPath);
  if (!content) return false;

  // Check if content actually changed (exclude volatile fields like elapsedMs
  // which change on every parse due to Date.now(), causing false cache misses)
  const cacheKey = sessionId;
  const stableContent = {
    messageCount: content.messages.length,
    lastMessage: content.messages.at(-1)?.content?.slice(0, 200),
    filesModified: content.filesModified,
    todoCount: content.currentTodos?.length ?? 0,
  };
  const contentFingerprint = JSON.stringify(stableContent);
  if (sessionCache.get(cacheKey) === contentFingerprint) {
    return false; // No actual change
  }
  sessionCache.set(cacheKey, contentFingerprint);

  // G6.6: Update orchestration activity when external session activity is detected
  const projectPath = projectPathMap.get(resolvedProjectId);
  if (projectPath) {
    const activeOrchestration = orchestrationService.getActive(projectPath);
    if (activeOrchestration) {
      orchestrationService.touchActivity(projectPath, activeOrchestration.id);
    }
  }

  // Broadcast session:message event
  broadcast({
    type: 'session:message',
    timestamp: new Date().toISOString(),
    projectId: resolvedProjectId,
    sessionId,
    data: content,
  });

  // Check for pending questions with deduplication
  const questions = extractPendingQuestions(content);
  const questionsFingerprint = questions.length > 0
    ? JSON.stringify(questions.map(q => ({ q: q.question, h: q.header })))
    : '';
  const cachedQuestions = questionCache.get(sessionId) ?? '';

  if (questions.length > 0 && questionsFingerprint !== cachedQuestions) {
    // New questions detected - update cache and broadcast
    questionCache.set(sessionId, questionsFingerprint);
    // Align workflow status with AskUserQuestion-driven waits
    workflowService.markWaitingForInput(sessionId, resolvedProjectId, questions);
    broadcast({
      type: 'session:question',
      timestamp: new Date().toISOString(),
      projectId: resolvedProjectId,
      sessionId,
      data: { questions },
    });
  } else if (questions.length === 0 && cachedQuestions !== '') {
    // Questions were cleared (user answered) - clear cache
    questionCache.delete(sessionId);
  }

  // Check for session end (explicit markers)
  if (content.messages.some(m => m.isSessionEnd)) {
    // Ensure workflow index reflects graceful completion
    workflowService.cancelBySession(sessionId, resolvedProjectId, 'completed');
    // Clear question cache for this session
    questionCache.delete(sessionId);

    broadcast({
      type: 'session:end',
      timestamp: new Date().toISOString(),
      projectId: resolvedProjectId,
      sessionId,
    });
  }

  // Always refresh workflow data on session change - this catches:
  // - Session ending with assistant text (no explicit end marker)
  // - Session transitioning to/from waiting_for_input
  // - Any other status changes based on file content
  if (projectPath) {
    const data = await buildWorkflowData(resolvedProjectId, projectPath);
    const dataJson = JSON.stringify(data);
    const cached = workflowCache.get(resolvedProjectId);
    if (cached !== dataJson) {
      workflowCache.set(resolvedProjectId, dataJson);
      broadcast({
        type: 'workflow',
        timestamp: new Date().toISOString(),
        projectId: resolvedProjectId,
        data,
      });
    }
  }

  return true;
}

/**
 * Find project ID for a session file path
 * Used for emitting session:created and session:activity events (G6.4, G6.5)
 */
function findProjectIdForSession(sessionPath: string): string | undefined {
  const claudeProjectsDir = getClaudeProjectsDir();
  const relativePath = sessionPath.replace(claudeProjectsDir + path.sep, '');
  const dirName = relativePath.split(path.sep)[0];

  // Find project with matching hash
  for (const [id, projectPath] of projectPathMap.entries()) {
    const expectedDir = path.basename(getSessionDirectory(projectPath));
    if (dirName === expectedDir) {
      return id;
    }
  }
  return undefined;
}

/**
 * Initialize session file watcher
 * T012: Watch ~/.claude/projects/{hash}/*.jsonl files
 */
async function initSessionWatcher(): Promise<void> {
  if (sessionWatcher) return; // Already initialized

  const claudeProjectsDir = getClaudeProjectsDir();
  console.log(`[Watcher] Initializing session watcher for ${claudeProjectsDir}`);

  // Build mapping of project paths
  if (currentRegistry) {
    for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
      projectPathMap.set(projectId, project.path);
    }
  }

  // Watch all JSONL files in the Claude projects directory
  sessionWatcher = chokidar.watch(`${claudeProjectsDir}/**/*.jsonl`, {
    persistent: true,
    ignoreInitial: true, // Don't emit events for existing files
    awaitWriteFinish: {
      stabilityThreshold: SESSION_DEBOUNCE_MS,
      pollInterval: 50,
    },
    depth: 2, // Only go 2 levels deep (project dir -> session file)
  });

  // Handle session file changes (G6.5: session:activity)
  sessionWatcher.on('change', (filePath) => {
    debouncedChange(filePath, async () => {
      const changed = await handleSessionFileChange(filePath);
      if (!changed) return; // Content unchanged, skip activity broadcast
      // G6.5: Emit session:activity for file modifications
      const sessionId = path.basename(filePath, '.jsonl');
      const projectId = sessionProjectMap.get(sessionId) || findProjectIdForSession(filePath);
      if (projectId) {
        broadcast({
          type: 'session:activity',
          timestamp: new Date().toISOString(),
          projectId,
          sessionId,
        });
      }
    });
  });

  // Handle new session files (G6.4: session:created)
  sessionWatcher.on('add', (filePath) => {
    debouncedChange(filePath, async () => {
      await handleSessionFileChange(filePath);
      // G6.4: Emit session:created for new files
      const sessionId = path.basename(filePath, '.jsonl');
      const projectId = sessionProjectMap.get(sessionId) || findProjectIdForSession(filePath);
      if (projectId) {
        broadcast({
          type: 'session:created',
          timestamp: new Date().toISOString(),
          projectId,
          sessionId,
        });

        // Refresh workflow data so new session appears in dropdown immediately.
        // The workflow index may not have been updated yet (sessionId assigned later),
        // but runtime aggregation will discover the new JSONL session.
        const projectPath = projectPathMap.get(projectId);
        if (projectPath) {
          const indexPath = path.join(projectPath, '.specflow', 'workflows', 'index.json');
          await handleWorkflowChange(projectId, indexPath);
        }
      }
    });
  });

  sessionWatcher.on('error', (error) => {
    console.error('[Watcher] Session watcher error:', error);
  });

  console.log('[Watcher] Session watcher initialized');
}

/**
 * Update project path mapping when registry changes
 */
function updateProjectPathMap(): void {
  projectPathMap.clear();
  if (currentRegistry) {
    for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
      projectPathMap.set(projectId, project.path);
    }
  }
}

// ============================================================================
// End Session File Watching
// ============================================================================

/**
 * Refresh workflow data for all projects.
 * Called periodically to catch sessions that become stale over time.
 */
async function refreshAllWorkflowData(): Promise<void> {
  if (!currentRegistry) return;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    try {
      const data = await buildWorkflowData(projectId, project.path);
      const dataJson = JSON.stringify(data);
      const cached = workflowCache.get(projectId);

      // Only broadcast if data changed
      if (cached !== dataJson) {
        workflowCache.set(projectId, dataJson);
        broadcast({
          type: 'workflow',
          timestamp: new Date().toISOString(),
          projectId,
          data,
        });
      }
    } catch {
      // Ignore errors during periodic refresh
    }
  }
}

/**
 * Start heartbeat timer for a listener
 */
export function startHeartbeat(listener: EventListener): NodeJS.Timeout {
  return setInterval(async () => {
    listener({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    });

    // Refresh workflow data to catch sessions that become stale
    await refreshAllWorkflowData();
  }, HEARTBEAT_MS);
}

// Delay before running full workflow refresh after initial connection
const INITIAL_FULL_REFRESH_DELAY_MS = 1500;

/**
 * Schedule a full workflow refresh shortly after initial connection.
 * Called after fast initial data is sent to populate CLI sessions
 * without waiting for the 30-second heartbeat.
 */
export function scheduleFullWorkflowRefresh(): void {
  setTimeout(async () => {
    await refreshAllWorkflowData();
  }, INITIAL_FULL_REFRESH_DELAY_MS);
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
    watchedWorkflowPaths.clear();
    watchedPhasesPaths.clear();
    watchedSessionDirs.clear();
    projectTasksPaths.clear();
    workflowCache.clear();
    phasesCache.clear();
    sessionCache.clear();
    projectPathMap.clear();
    sessionProjectMap.clear();
    currentRegistry = null;
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();
    console.log('[Watcher] Closed');
  }

  // Close session watcher
  if (sessionWatcher) {
    await sessionWatcher.close();
    sessionWatcher = null;
    console.log('[Watcher] Session watcher closed');
  }
}
