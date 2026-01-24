import chokidar, { type FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import {
  RegistrySchema,
  OrchestrationStateSchema,
  WorkflowIndexSchema,
  type Registry,
  type OrchestrationState,
  type SSEEvent,
  type TasksData,
  type WorkflowIndex,
  type WorkflowIndexEntry,
  type WorkflowData,
  type PhasesData,
  type SessionContent,
  type SessionQuestion,
} from '@specflow/shared';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseTasks, type ParseTasksOptions } from './task-parser';
import { parseRoadmapToPhasesData } from './roadmap-parser';
import {
  getStateFilePath,
  getStateFilePathSync,
  migrateStateFiles,
} from './state-paths';
import { getProjectSessionDir, getClaudeProjectsDir } from './project-hash';
import { reconcileRunners } from './services/orchestration-runner';
import { orchestrationService } from './services/orchestration-service';

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
 * Read and parse workflow index file for a project
 */
async function readWorkflowIndex(indexPath: string): Promise<WorkflowIndex | null> {
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const parsed = WorkflowIndexSchema.parse(JSON.parse(content));
    return parsed;
  } catch {
    // File doesn't exist or is invalid - return empty
    return { sessions: [] };
  }
}

/**
 * Build WorkflowData from index
 * Finds current active execution and includes all sessions
 */
function buildWorkflowData(index: WorkflowIndex): WorkflowData {
  // Find current active execution (running or waiting_for_input)
  const activeStates = ['running', 'waiting_for_input', 'detached', 'stale'];
  const currentExecution = index.sessions.find(s => activeStates.includes(s.status)) ?? null;

  return {
    currentExecution,
    sessions: index.sessions,
  };
}

/**
 * Discover CLI sessions from Claude projects directory.
 * Scans ~/.claude/projects/{hash}/ for .jsonl files and creates WorkflowIndexEntry objects.
 * These are sessions started from CLI that weren't tracked by the dashboard.
 *
 * @param projectPath - Absolute path to the project
 * @param trackedSessionIds - Set of session IDs already tracked by dashboard (to avoid duplicates)
 * @param limit - Maximum number of sessions to return (default 50)
 */
function discoverCliSessions(
  projectPath: string,
  trackedSessionIds: Set<string>,
  limit: number = 50
): WorkflowIndexEntry[] {
  const sessionDir = getProjectSessionDir(projectPath);

  if (!existsSync(sessionDir)) {
    return [];
  }

  try {
    const files = readdirSync(sessionDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    // Get file stats and create entries
    const entries: WorkflowIndexEntry[] = [];

    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '');

      // Skip if already tracked by dashboard
      if (trackedSessionIds.has(sessionId)) {
        continue;
      }

      const fullPath = path.join(sessionDir, file);
      try {
        const stats = statSync(fullPath);

        // Try to extract skill from first line of JSONL (lazy - only read if needed)
        let skill = 'CLI Session';
        try {
          // Read just the first few KB to find skill info
          const fd = require('fs').openSync(fullPath, 'r');
          const buffer = Buffer.alloc(4096);
          require('fs').readSync(fd, buffer, 0, 4096, 0);
          require('fs').closeSync(fd);

          const firstLines = buffer.toString('utf-8').split('\n').slice(0, 5);
          for (const line of firstLines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              // Look for skill in various places
              if (msg.skill) {
                skill = msg.skill;
                break;
              }
              if (msg.message?.content && typeof msg.message.content === 'string') {
                // Check for /flow.* commands in first user message
                const flowMatch = msg.message.content.match(/\/flow\.(\w+)/);
                if (flowMatch) {
                  skill = `flow.${flowMatch[1]}`;
                  break;
                }
              }
            } catch {
              // Invalid JSON line, continue
            }
          }
        } catch {
          // Could not read file content, use default skill
        }

        // Determine status based on file age
        const fileAgeMs = Date.now() - stats.mtime.getTime();
        const isRecent = fileAgeMs < 30 * 60 * 1000; // 30 minutes
        const status: WorkflowIndexEntry['status'] = isRecent ? 'detached' : 'completed';

        entries.push({
          sessionId,
          executionId: uuidv4(), // Generate placeholder ID for CLI sessions
          skill,
          status,
          startedAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          costUsd: 0, // Unknown for CLI sessions
        });
      } catch {
        // Could not stat file, skip
      }
    }

    // Sort by updatedAt descending (newest first)
    entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Return limited number
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Handle workflow index file change.
 * Merges dashboard-tracked sessions with discovered CLI sessions.
 */
async function handleWorkflowChange(projectId: string, indexPath: string): Promise<void> {
  const index = await readWorkflowIndex(indexPath);
  if (!index) return;

  // Get project path for CLI session discovery
  const projectPath = projectPathMap.get(projectId);

  // Get tracked session IDs to avoid duplicates
  const trackedSessionIds = new Set<string>(
    index.sessions.map(s => s.sessionId)
  );

  // Discover CLI sessions that aren't tracked by dashboard
  const cliSessions = projectPath
    ? discoverCliSessions(projectPath, trackedSessionIds, 50)
    : [];

  // Merge sessions: dashboard-tracked first, then CLI-discovered
  const allSessions = [
    ...index.sessions,
    ...cliSessions,
  ];

  // Sort all sessions by updatedAt (newest first)
  allSessions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Build workflow data with merged sessions
  const activeStates = ['running', 'waiting_for_input', 'detached', 'stale'];
  const currentExecution = allSessions.find(s => activeStates.includes(s.status)) ?? null;

  const data: WorkflowData = {
    currentExecution,
    sessions: allSessions.slice(0, 100), // Limit to 100 total sessions
  };

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

      // Broadcast initial workflow data (including CLI sessions)
      const index = await readWorkflowIndex(workflowIndexPath);
      if (index) {
        // Get tracked session IDs to avoid duplicates
        const trackedSessionIds = new Set<string>(
          index.sessions.map(s => s.sessionId)
        );

        // Discover CLI sessions
        const cliSessions = discoverCliSessions(project.path, trackedSessionIds, 50);

        // Merge sessions
        const allSessions = [...index.sessions, ...cliSessions];
        allSessions.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        // Build workflow data with merged sessions
        const activeStates = ['running', 'waiting_for_input', 'detached', 'stale'];
        const currentExecution = allSessions.find(s => activeStates.includes(s.status)) ?? null;

        const data: WorkflowData = {
          currentExecution,
          sessions: allSessions.slice(0, 100),
        };

        workflowCache.set(projectId, JSON.stringify(data));
        broadcast({
          type: 'workflow',
          timestamp: new Date().toISOString(),
          projectId,
          data,
        });
      }
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
        reconcileRunners(project.path);
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

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const statePath = await getStateFilePath(project.path);
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
    const statePath = await getStateFilePath(project.path);
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
 * Get all current workflow data for registered projects.
 * Includes both dashboard-tracked sessions AND discovered CLI sessions.
 */
export async function getAllWorkflows(): Promise<Map<string, WorkflowData>> {
  const workflows = new Map<string, WorkflowData>();

  if (!currentRegistry) return workflows;

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const workflowIndexPath = path.join(project.path, '.specflow', 'workflows', 'index.json');
    const index = await readWorkflowIndex(workflowIndexPath);

    // Get tracked session IDs to avoid duplicates
    const trackedSessionIds = new Set<string>(
      index?.sessions.map(s => s.sessionId) ?? []
    );

    // Discover CLI sessions that aren't tracked by dashboard
    const cliSessions = discoverCliSessions(project.path, trackedSessionIds, 50);

    // Merge sessions: dashboard-tracked first, then CLI-discovered
    const allSessions = [
      ...(index?.sessions ?? []),
      ...cliSessions,
    ];

    // Sort all sessions by updatedAt (newest first)
    allSessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Build workflow data with merged sessions
    const activeStates = ['running', 'waiting_for_input', 'detached', 'stale'];
    const currentExecution = allSessions.find(s => activeStates.includes(s.status)) ?? null;

    const data: WorkflowData = {
      currentExecution,
      sessions: allSessions.slice(0, 100), // Limit to 100 total sessions
    };

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

  for (const [projectId, project] of Object.entries(currentRegistry.projects)) {
    const roadmapPath = path.join(project.path, 'ROADMAP.md');
    const data = await readPhases(projectId, roadmapPath);
    if (data) {
      phases.set(projectId, data);
      // Update cache
      phasesCache.set(projectId, JSON.stringify(data));
    }
  }

  return phases;
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
 */
export async function getAllSessions(): Promise<SessionWithProject[]> {
  const sessions: SessionWithProject[] = [];

  if (!currentRegistry) return sessions;

  // Get workflow data to find active sessions
  const workflows = await getAllWorkflows();

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

    // Load content for each session (skip stale sessions)
    const sessionDir = getSessionDirectory(project.path);
    for (const sessionId of sessionIdsToLoad) {
      const sessionPath = path.join(sessionDir, `${sessionId}.jsonl`);
      try {
        // Skip stale sessions - they're marked as "running" but haven't been modified recently
        if (await isSessionStale(sessionPath)) {
          console.log(`[Watcher] Skipping stale session ${sessionId} (not modified in 30+ minutes)`);
          continue;
        }

        const content = await parseSessionContent(sessionPath);
        if (content) {
          // Update caches for future change detection
          sessionProjectMap.set(sessionId, projectId);
          sessionCache.set(sessionId, JSON.stringify(content));

          sessions.push({ projectId, sessionId, content });
        }
      } catch (error) {
        // Session file might not exist yet or is inaccessible
        console.log(`[Watcher] Could not load session ${sessionId} for project ${projectId}:`, error);
      }
    }
  }

  return sessions;
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
  const questions: SessionQuestion[] = [];

  // Helper to process a questions array
  const processQuestions = (questionList: unknown[]) => {
    for (const q of questionList) {
      if (typeof q === 'object' && q !== null && 'question' in q) {
        const qObj = q as Record<string, unknown>;
        // Map to SessionQuestion format, ensuring description has a default value
        const options = Array.isArray(qObj.options)
          ? qObj.options.map((opt: { label: string; description?: string }) => ({
              label: opt.label,
              description: opt.description ?? '', // Default to empty string
            }))
          : [];

        questions.push({
          question: String(qObj.question),
          header: typeof qObj.header === 'string' ? qObj.header : undefined,
          options,
          multiSelect: typeof qObj.multiSelect === 'boolean' ? qObj.multiSelect : undefined,
        });
      }
    }
  };

  for (const message of content.messages) {
    // Check for AskUserQuestion tool calls (interactive mode)
    if (message.role === 'assistant' && message.toolCalls) {
      for (const toolCall of message.toolCalls) {
        if (toolCall.name === 'AskUserQuestion' && toolCall.input) {
          const input = toolCall.input as Record<string, unknown>;
          const questionList = input?.questions;
          if (Array.isArray(questionList)) {
            processQuestions(questionList);
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
        processQuestions(structured.questions);
      }
    }
  }

  return questions;
}

/**
 * Handle session file change
 * T013: Called when JSONL file changes, parses and broadcasts events
 */
async function handleSessionFileChange(sessionPath: string): Promise<void> {
  const sessionId = path.basename(sessionPath, '.jsonl');
  const projectId = sessionProjectMap.get(sessionId);

  console.log(`[Watcher] Session file change: ${sessionId}, cached projectId: ${projectId || 'none'}`);

  if (!projectId) {
    // Try to find project from path
    const claudeProjectsDir = getClaudeProjectsDir();
    const relativePath = sessionPath.replace(claudeProjectsDir + path.sep, '');
    const dirName = relativePath.split(path.sep)[0];

    console.log(`[Watcher] Looking up project for session ${sessionId}: dir=${dirName}, projectPathMap size=${projectPathMap.size}`);

    // Find project with matching hash
    for (const [id, projectPath] of projectPathMap.entries()) {
      const expectedDir = path.basename(getSessionDirectory(projectPath));
      console.log(`[Watcher]   Checking project ${id}: expectedDir=${expectedDir}, match=${dirName === expectedDir}`);
      if (dirName === expectedDir) {
        sessionProjectMap.set(sessionId, id);
        console.log(`[Watcher]   Matched! Setting sessionProjectMap[${sessionId}] = ${id}`);
        break;
      }
    }
  }

  const resolvedProjectId = sessionProjectMap.get(sessionId);
  if (!resolvedProjectId) {
    // Session from external CLI not registered with dashboard - this is expected
    console.log(`[Watcher] Could not resolve projectId for session ${sessionId}, skipping`);
    return;
  }

  console.log(`[Watcher] Processing session ${sessionId} for project ${resolvedProjectId}`);

  const content = await parseSessionContent(sessionPath);
  if (!content) return;

  // Check if content actually changed
  const cacheKey = sessionId;
  const contentJson = JSON.stringify(content);
  if (sessionCache.get(cacheKey) === contentJson) {
    return; // No actual change
  }
  sessionCache.set(cacheKey, contentJson);

  // G6.6: Update orchestration activity when external session activity is detected
  const projectPath = projectPathMap.get(resolvedProjectId);
  if (projectPath) {
    const activeOrchestration = orchestrationService.getActive(projectPath);
    if (activeOrchestration) {
      orchestrationService.touchActivity(projectPath, activeOrchestration.id);
    }
  }

  // Broadcast session:message event
  console.log(`[Watcher] Broadcasting session:message for ${sessionId} (${content.messages.length} messages)`);
  broadcast({
    type: 'session:message',
    timestamp: new Date().toISOString(),
    projectId: resolvedProjectId,
    sessionId,
    data: content,
  });

  // Check for pending questions
  const questions = extractPendingQuestions(content);
  if (questions.length > 0) {
    broadcast({
      type: 'session:question',
      timestamp: new Date().toISOString(),
      projectId: resolvedProjectId,
      sessionId,
      data: { questions },
    });
  }

  // Check for session end
  if (content.messages.some(m => m.isSessionEnd)) {
    broadcast({
      type: 'session:end',
      timestamp: new Date().toISOString(),
      projectId: resolvedProjectId,
      sessionId,
    });
  }
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
      await handleSessionFileChange(filePath);
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
