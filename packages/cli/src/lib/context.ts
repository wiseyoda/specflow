import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import {
  findProjectRoot,
  getSpecsDir,
  getSpecifyDir,
  getMemoryDir,
  getTemplatesDir,
  getRoadmapPath,
  getStatePath,
  pathExists,
} from './paths.js';
import { readState } from './state.js';
import { NotFoundError } from './errors.js';
import type { OrchestrationState } from '@specflow/shared';

/**
 * Feature artifact existence flags
 */
export interface FeatureArtifacts {
  discovery: boolean;
  spec: boolean;
  requirements: boolean;
  uiDesign: boolean;
  plan: boolean;
  tasks: boolean;
}

/**
 * Current feature context
 */
export interface FeatureContext {
  dir: string;
  name: string;
  phaseNumber?: string;
  artifacts: FeatureArtifacts;
  isComplete: boolean;
}

/**
 * Project-level context
 */
export interface ProjectContext {
  root: string;
  name: string;
  hasState: boolean;
  hasRoadmap: boolean;
  hasMemory: boolean;
  hasTemplates: boolean;
  featureDirs: string[];
  activeFeature?: FeatureContext;
  state?: OrchestrationState;
}

/**
 * Check which artifacts exist in a feature directory
 */
async function checkFeatureArtifacts(featureDir: string): Promise<FeatureArtifacts> {
  return {
    discovery: pathExists(join(featureDir, 'discovery.md')),
    spec: pathExists(join(featureDir, 'spec.md')),
    requirements: pathExists(join(featureDir, 'requirements.md')),
    uiDesign: pathExists(join(featureDir, 'ui-design.md')),
    plan: pathExists(join(featureDir, 'plan.md')),
    tasks: pathExists(join(featureDir, 'tasks.md')),
  };
}

/**
 * Check if feature has all required artifacts for completion
 */
function isFeatureComplete(artifacts: FeatureArtifacts): boolean {
  return (
    artifacts.spec &&
    artifacts.plan &&
    artifacts.tasks
  );
}

/**
 * Extract phase number from feature directory name
 */
function extractPhaseNumber(dirName: string): string | undefined {
  const match = dirName.match(/^(\d{4})-/);
  return match ? match[1] : undefined;
}

/**
 * Get feature context for a specific directory
 */
export async function getFeatureContext(featureDir: string): Promise<FeatureContext> {
  const name = basename(featureDir);
  const artifacts = await checkFeatureArtifacts(featureDir);

  return {
    dir: featureDir,
    name,
    phaseNumber: extractPhaseNumber(name),
    artifacts,
    isComplete: isFeatureComplete(artifacts),
  };
}

/**
 * Find the active feature directory based on state
 */
async function findActiveFeatureDir(
  specsDir: string,
  state?: OrchestrationState,
): Promise<string | undefined> {
  // If state has active phase, use that
  if (state?.orchestration?.phase?.number && state?.orchestration?.phase?.name) {
    const phaseNumber = state.orchestration.phase.number;
    const phaseName = state.orchestration.phase.name;

    // Try exact match first
    const exactMatch = `${phaseNumber}-${phaseName}`;
    if (pathExists(join(specsDir, exactMatch))) {
      return join(specsDir, exactMatch);
    }

    // Try finding by phase number prefix
    if (pathExists(specsDir)) {
      const entries = await readdir(specsDir, { withFileTypes: true });
      const matching = entries.find(
        e => e.isDirectory() && e.name.startsWith(`${phaseNumber}-`),
      );
      if (matching) {
        return join(specsDir, matching.name);
      }
    }
  }

  // Fallback: find most recent feature directory
  if (pathExists(specsDir)) {
    const entries = await readdir(specsDir, { withFileTypes: true });
    const featureDirs = entries
      .filter(e => e.isDirectory() && /^\d{4}-/.test(e.name))
      .map(e => ({ name: e.name, path: join(specsDir, e.name) }))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (featureDirs.length > 0) {
      return featureDirs[0].path;
    }
  }

  return undefined;
}

/**
 * Get full project context
 */
export async function getProjectContext(projectPath?: string): Promise<ProjectContext> {
  const root = projectPath || findProjectRoot();
  if (!root) {
    throw new NotFoundError(
      'SpecFlow project',
      'Ensure you are in a SpecFlow project directory',
    );
  }

  const specsDir = getSpecsDir(root);
  const specifyDir = getSpecifyDir(root);
  const memoryDir = getMemoryDir(root);
  const templatesDir = getTemplatesDir(root);
  const roadmapPath = getRoadmapPath(root);
  const statePath = getStatePath(root);

  // Check state existence and read if available
  const hasState = pathExists(statePath);
  let state: OrchestrationState | undefined;

  if (hasState) {
    try {
      state = await readState(root);
    } catch {
      // State exists but couldn't be read - treat as unavailable
    }
  }

  // Get list of feature directories
  let featureDirs: string[] = [];
  if (pathExists(specsDir)) {
    const entries = await readdir(specsDir, { withFileTypes: true });
    featureDirs = entries
      .filter(e => e.isDirectory() && /^\d{4}-/.test(e.name))
      .map(e => e.name)
      .sort();
  }

  // Get active feature context
  let activeFeature: FeatureContext | undefined;
  const activeFeatureDir = await findActiveFeatureDir(specsDir, state);
  if (activeFeatureDir && pathExists(activeFeatureDir)) {
    activeFeature = await getFeatureContext(activeFeatureDir);
  }

  // Get project name from state or directory name
  const name = state?.project?.name || basename(root);

  return {
    root,
    name,
    hasState,
    hasRoadmap: pathExists(roadmapPath),
    hasMemory: pathExists(memoryDir),
    hasTemplates: pathExists(templatesDir),
    featureDirs,
    activeFeature,
    state,
  };
}

/**
 * Resolve feature directory from various inputs
 * - Phase number: "0080"
 * - Feature name: "cli-typescript-migration"
 * - Full name: "0080-cli-typescript-migration"
 * - Undefined: use active feature from state
 */
export async function resolveFeatureDir(
  identifier?: string,
  projectPath?: string,
): Promise<string | undefined> {
  const root = projectPath || findProjectRoot();
  if (!root) return undefined;

  const specsDir = getSpecsDir(root);
  if (!pathExists(specsDir)) return undefined;

  // No identifier - use active feature
  if (!identifier) {
    let state: OrchestrationState | undefined;
    try {
      state = await readState(root);
    } catch {
      // No state available
    }
    return findActiveFeatureDir(specsDir, state);
  }

  // Exact directory name
  if (pathExists(join(specsDir, identifier))) {
    return join(specsDir, identifier);
  }

  // Try phase number prefix
  if (/^\d{4}$/.test(identifier)) {
    const entries = await readdir(specsDir, { withFileTypes: true });
    const matching = entries.find(
      e => e.isDirectory() && e.name.startsWith(`${identifier}-`),
    );
    if (matching) {
      return join(specsDir, matching.name);
    }
  }

  // Try feature name suffix
  const entries = await readdir(specsDir, { withFileTypes: true });
  const matching = entries.find(
    e => e.isDirectory() && e.name.endsWith(`-${identifier}`),
  );
  if (matching) {
    return join(specsDir, matching.name);
  }

  return undefined;
}

/**
 * Get summary of what design artifacts are missing
 */
export function getMissingArtifacts(artifacts: FeatureArtifacts): string[] {
  const missing: string[] = [];

  if (!artifacts.discovery) missing.push('discovery.md');
  if (!artifacts.spec) missing.push('spec.md');
  if (!artifacts.plan) missing.push('plan.md');
  if (!artifacts.tasks) missing.push('tasks.md');

  return missing;
}

/**
 * Determine current workflow step based on artifacts
 */
export function inferStepFromArtifacts(artifacts: FeatureArtifacts): string {
  if (!artifacts.spec) return 'design';
  if (!artifacts.plan) return 'design';
  if (!artifacts.tasks) return 'design';
  // All design artifacts exist - could be analyze or later
  return 'analyze';
}
