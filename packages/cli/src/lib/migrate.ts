import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { getSpecifyDir, getSpecflowDir, getManifestPath, getStatePath, pathExists, getRoadmapPath } from './paths.js';
import type { RepoVersion, ManifestV2, ManifestV3 } from './detect.js';

/**
 * Schema migration helpers for SpecFlow upgrade
 */

export interface PhaseHistoryItem {
  type: string;
  phase_number: string;
  phase_name: string;
  branch: string | null;
  completed_at: string;
  tasks_completed: number;
  tasks_total: number;
}

export interface MigrationResult {
  success: boolean;
  action: string;
  details?: string;
  error?: string;
}

/**
 * Create a v3.0 manifest from scratch or migrate from v2.0
 */
export function createV3Manifest(
  projectName: string,
  existingManifest?: ManifestV2 | ManifestV3,
): ManifestV3 {
  const now = new Date().toISOString();

  // Extract creation date from existing manifest if available
  const createdAt = (existingManifest as ManifestV2)?.compatibility?.created_at || now;

  return {
    manifest_schema: '1.0',
    specflow_version: '3.0.0',
    schema: {
      state: '3.0',
      roadmap: '3.0',
      commands: '3.0',
    },
    compatibility: {
      min_cli: '3.0.0',
      created_with: '3.0.0',
      created_at: createdAt,
    },
    migrations: existingManifest
      ? [
          {
            from: (existingManifest as ManifestV2).speckit_version || 'unknown',
            to: '3.0.0',
            date: now,
          },
        ]
      : [],
  };
}

/**
 * Migrate manifest file
 */
export async function migrateManifest(
  projectPath: string,
  projectName: string,
): Promise<MigrationResult> {
  const manifestPath = getManifestPath(projectPath);
  const legacyManifestPath = join(getSpecifyDir(projectPath), 'manifest.json');

  try {
    // Ensure .specflow directory exists
    await mkdir(dirname(manifestPath), { recursive: true });

    let existingManifest: ManifestV2 | ManifestV3 | undefined;

    // Check new location first, then legacy location
    if (pathExists(manifestPath)) {
      const content = await readFile(manifestPath, 'utf-8');
      existingManifest = JSON.parse(content);

      // Check if already v3.0
      if ((existingManifest as ManifestV3).specflow_version) {
        return {
          success: true,
          action: 'skipped',
          details: 'Manifest already at v3.0',
        };
      }
    } else if (pathExists(legacyManifestPath)) {
      // Read from legacy location for migration
      const content = await readFile(legacyManifestPath, 'utf-8');
      existingManifest = JSON.parse(content);
    }

    const newManifest = createV3Manifest(projectName, existingManifest);
    await writeFile(manifestPath, JSON.stringify(newManifest, null, 2) + '\n');

    return {
      success: true,
      action: existingManifest ? 'migrated' : 'created',
      details: existingManifest
        ? `Migrated from speckit ${(existingManifest as ManifestV2).speckit_version || 'unknown'}`
        : 'Created new v3.0 manifest',
    };
  } catch (err) {
    return {
      success: false,
      action: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Extract completed phases from ROADMAP.md
 * Handles various ROADMAP formats from v1.0 and v2.0 projects
 */
export async function extractHistoryFromRoadmap(
  projectPath: string,
): Promise<PhaseHistoryItem[]> {
  const roadmapPath = getRoadmapPath(projectPath);
  const history: PhaseHistoryItem[] = [];

  if (!pathExists(roadmapPath)) {
    return history;
  }

  try {
    const content = await readFile(roadmapPath, 'utf-8');
    const lines = content.split('\n');

    // Pattern 1: Table format with ✅ status
    // | 0010 | core-engine | ✅ |
    const tableRowPattern = /^\|\s*(\d{4})\s*\|\s*([^|]+?)\s*\|\s*(✅|COMPLETE|Done)/i;

    // Pattern 2: Heading format with COMPLETE marker
    // ## Phase 0010: core-engine - COMPLETE
    const headingPattern = /^#+\s*(?:Phase\s+)?(\d{4})[\s:-]+([^-\n]+?)(?:\s*-\s*(?:✅|COMPLETE|Done)|\s*\(COMPLETE\))/i;

    // Pattern 3: List format
    // - [x] 0010 core-engine
    const listPattern = /^[-*]\s*\[x\]\s*(\d{4})\s+(.+)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Try each pattern
      let match = line.match(tableRowPattern);
      if (match) {
        history.push({
          type: 'phase_completed',
          phase_number: match[1],
          phase_name: match[2].trim(),
          branch: `${match[1]}-${match[2].trim().toLowerCase().replace(/\s+/g, '-')}`,
          completed_at: new Date().toISOString(), // Unknown, use migration time
          tasks_completed: 0,
          tasks_total: 0,
        });
        continue;
      }

      match = line.match(headingPattern);
      if (match) {
        history.push({
          type: 'phase_completed',
          phase_number: match[1],
          phase_name: match[2].trim(),
          branch: `${match[1]}-${match[2].trim().toLowerCase().replace(/\s+/g, '-')}`,
          completed_at: new Date().toISOString(),
          tasks_completed: 0,
          tasks_total: 0,
        });
        continue;
      }

      match = line.match(listPattern);
      if (match) {
        history.push({
          type: 'phase_completed',
          phase_number: match[1],
          phase_name: match[2].trim(),
          branch: `${match[1]}-${match[2].trim().toLowerCase().replace(/\s+/g, '-')}`,
          completed_at: new Date().toISOString(),
          tasks_completed: 0,
          tasks_total: 0,
        });
        continue;
      }
    }

    // Sort by phase number
    history.sort((a, b) => parseInt(a.phase_number) - parseInt(b.phase_number));

    return history;
  } catch {
    return history;
  }
}

/**
 * Create v3.0 state schema structure
 */
export function createV3StateStructure(
  projectName: string,
  projectPath: string,
  existingState?: Record<string, unknown>,
  history?: PhaseHistoryItem[],
): Record<string, unknown> {
  const now = new Date().toISOString();

  // Preserve project info if available
  const projectInfo = existingState?.project as Record<string, unknown> | undefined;
  const orchestration = existingState?.orchestration as Record<string, unknown> | undefined;
  const health = existingState?.health as Record<string, unknown> | undefined;
  const existingActions = existingState?.actions as Record<string, unknown> | undefined;

  // Merge existing history with extracted history
  const existingHistory = (existingActions?.history as PhaseHistoryItem[]) || [];
  const mergedHistory = history && history.length > 0
    ? [...existingHistory, ...history.filter(h =>
        !existingHistory.some(eh => eh.phase_number === h.phase_number)
      )]
    : existingHistory;

  return {
    schema_version: '3.0',
    project: {
      id: projectInfo?.id || crypto.randomUUID(),
      name: projectInfo?.name || projectName,
      path: projectInfo?.path || projectPath,
    },
    last_updated: now,
    orchestration: {
      phase: orchestration?.phase || {
        id: null,
        number: null,
        name: null,
        branch: null,
        status: 'not_started',
      },
      next_phase: orchestration?.next_phase || null,
      step: orchestration?.step || {
        current: 'design',
        index: 0,
        status: 'not_started',
      },
      implement: orchestration?.implement || null,
    },
    actions: {
      available: existingActions?.available || [],
      pending: existingActions?.pending || [],
      history: mergedHistory,
    },
    health: {
      status: health?.status || 'ready',
      last_check: health?.last_check || now,
      issues: health?.issues || [],
    },
  };
}

/**
 * Migrate state file
 */
export async function migrateState(
  projectPath: string,
  projectName: string,
): Promise<MigrationResult & { historyExtracted?: number }> {
  const statePath = getStatePath(projectPath);
  const legacyStatePath = join(getSpecifyDir(projectPath), 'orchestration-state.json');

  try {
    // Ensure .specflow directory exists
    await mkdir(dirname(statePath), { recursive: true });

    let existingState: Record<string, unknown> | undefined;

    // Check new location first, then legacy location
    if (pathExists(statePath)) {
      const content = await readFile(statePath, 'utf-8');
      existingState = JSON.parse(content);

      // Check if already v3.0 with existing history
      const existingActions = existingState.actions as Record<string, unknown> | undefined;
      const existingHistory = (existingActions?.history as PhaseHistoryItem[]) || [];

      if (existingState.schema_version === '3.0' && existingHistory.length > 0) {
        return {
          success: true,
          action: 'skipped',
          details: 'State already at v3.0 with history',
        };
      }
    } else if (pathExists(legacyStatePath)) {
      // Read from legacy location for migration
      const content = await readFile(legacyStatePath, 'utf-8');
      existingState = JSON.parse(content);
    }

    // Extract history from ROADMAP.md for legacy projects
    const extractedHistory = await extractHistoryFromRoadmap(projectPath);

    const newState = createV3StateStructure(projectName, projectPath, existingState, extractedHistory);
    await writeFile(statePath, JSON.stringify(newState, null, 2) + '\n');

    const historyCount = (newState.actions as Record<string, unknown>)?.history as PhaseHistoryItem[] || [];

    return {
      success: true,
      action: existingState ? 'migrated' : 'created',
      details: existingState
        ? `Migrated from schema ${existingState.schema_version || 'unknown'}${extractedHistory.length > 0 ? ` (extracted ${extractedHistory.length} phases from ROADMAP)` : ''}`
        : `Created new v3.0 state${extractedHistory.length > 0 ? ` with ${extractedHistory.length} phases from ROADMAP` : ''}`,
      historyExtracted: extractedHistory.length,
    };
  } catch (err) {
    return {
      success: false,
      action: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Get migration steps needed for a version
 */
export function getMigrationSteps(fromVersion: RepoVersion): string[] {
  switch (fromVersion) {
    case 'v1.0':
      return [
        'Create manifest.json (v3.0)',
        'Create orchestration-state.json (v3.0)',
        'Create scaffolding directories',
        'Sync templates from specflow',
        'Remove legacy bash scripts',
        'Update command references in docs',
        'Generate migration guide for manual review',
      ];
    case 'v2.0':
      return [
        'Upgrade manifest.json to v3.0',
        'Upgrade orchestration-state.json to v3.0',
        'Verify scaffolding directories',
        'Sync templates from specflow',
        'Update /speckit.* → /flow.* references',
        'Update speckit → specflow CLI references',
        'Generate migration guide for manual review',
      ];
    case 'v3.0':
      return ['Already at v3.0 - no migration needed'];
    case 'uninitialized':
      return ['Run /flow.init to initialize project'];
  }
}

/**
 * Backup a file before migration
 */
export async function backupFile(
  filePath: string,
  suffix: string = '.pre-upgrade',
): Promise<boolean> {
  if (!pathExists(filePath)) {
    return false;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    await writeFile(filePath + suffix, content);
    return true;
  } catch {
    return false;
  }
}
