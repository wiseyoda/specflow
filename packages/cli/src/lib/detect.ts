import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  pathExists,
  getSpecifyDir,
  getSpecflowDir,
  getManifestPath,
  getStatePath,
  getRoadmapPath,
  getSpecsDir,
} from './paths.js';

/**
 * Repository version detection for SpecFlow upgrade
 */

export type RepoVersion = 'v1.0' | 'v2.0' | 'v3.0' | 'uninitialized';

export interface ManifestV2 {
  speckit_version?: string;
  schema?: {
    state?: string;
    roadmap?: string;
    commands?: string;
  };
  compatibility?: {
    min_cli?: string;
    created_with?: string;
    created_at?: string;
  };
}

export interface ManifestV3 {
  manifest_schema?: string;
  specflow_version?: string;
  schema?: {
    state?: string;
    roadmap?: string;
    commands?: string;
  };
  compatibility?: {
    min_cli?: string;
    created_with?: string;
    created_at?: string;
  };
  migrations?: unknown[];
}

export interface StateV2 {
  schema_version?: string;
  project?: {
    id?: string;
    name?: string;
    path?: string;
  };
}

export interface DetectionResult {
  version: RepoVersion;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
  manifest?: ManifestV2 | ManifestV3;
  stateSchemaVersion?: string;
}

/**
 * Read and parse JSON file safely
 */
async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    if (!pathExists(path)) return null;
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Check for v1.0 indicators
 */
async function checkV1Indicators(projectPath: string): Promise<string[]> {
  const indicators: string[] = [];
  const specifyDir = getSpecifyDir(projectPath);

  // v1.0 has bash scripts in .specify/scripts/bash/
  if (pathExists(join(specifyDir, 'scripts', 'bash'))) {
    indicators.push('.specify/scripts/bash/ exists');
  }

  // v1.0 has no manifest.json
  if (!pathExists(join(specifyDir, 'manifest.json'))) {
    indicators.push('No manifest.json');
  }

  // v1.0 may have specifications/ folder (reference docs)
  if (pathExists(join(projectPath, 'specifications'))) {
    indicators.push('specifications/ folder exists');
  }

  return indicators;
}

/**
 * Check for v2.0 indicators
 */
async function checkV2Indicators(projectPath: string): Promise<string[]> {
  const indicators: string[] = [];
  const specifyDir = getSpecifyDir(projectPath);

  // v2.0 has speckit_version in manifest
  const manifest = await readJsonFile<ManifestV2>(join(specifyDir, 'manifest.json'));
  if (manifest?.speckit_version) {
    indicators.push(`manifest has speckit_version: ${manifest.speckit_version}`);
  }

  // v2.0 has schema.state = '2.0' or '2.1'
  if (manifest?.schema?.state?.startsWith('2.')) {
    indicators.push(`manifest schema.state: ${manifest.schema.state}`);
  }

  // v2.0 state file has schema_version = '2.0'
  const state = await readJsonFile<StateV2>(join(specifyDir, 'orchestration-state.json'));
  if (state?.schema_version?.startsWith('2.')) {
    indicators.push(`state schema_version: ${state.schema_version}`);
  }

  return indicators;
}

/**
 * Check for v3.0 indicators
 * Note: v3.0 stores manifest and state in .specflow/ (not .specify/)
 */
async function checkV3Indicators(projectPath: string): Promise<string[]> {
  const indicators: string[] = [];

  // v3.0 has manifest and state in .specflow/ directory
  const manifestPath = getManifestPath(projectPath);
  const statePath = getStatePath(projectPath);

  // v3.0 has specflow_version in manifest (key differentiator from v2.0)
  const manifest = await readJsonFile<ManifestV3>(manifestPath);
  if (manifest?.specflow_version) {
    indicators.push(`manifest has specflow_version: ${manifest.specflow_version}`);
  }

  // v3.0 has schema.state = '3.0'
  if (manifest?.schema?.state === '3.0') {
    indicators.push('manifest schema.state: 3.0');
  }

  // v3.0 state file has schema_version = '3.0'
  const state = await readJsonFile<StateV2>(statePath);
  if (state?.schema_version === '3.0') {
    indicators.push('state schema_version: 3.0');
  }

  // Also check for .specflow/ directory existence
  if (pathExists(getSpecflowDir(projectPath))) {
    indicators.push('.specflow/ directory exists');
  }

  return indicators;
}

/**
 * Check for any SDD artifacts
 */
async function hasAnyArtifacts(projectPath: string): Promise<boolean> {
  const specifyDir = getSpecifyDir(projectPath);
  const specflowDir = getSpecflowDir(projectPath);
  const specsDir = getSpecsDir(projectPath);
  const roadmapPath = getRoadmapPath(projectPath);

  // Check for .specflow directory (v3.0)
  if (pathExists(specflowDir)) return true;

  // Check for .specify directory
  if (pathExists(specifyDir)) return true;

  // Check for specs/ directory
  if (pathExists(specsDir)) return true;

  // Check for ROADMAP.md
  if (pathExists(roadmapPath)) return true;

  // Check for specifications/ (v1.0 pattern)
  if (pathExists(join(projectPath, 'specifications'))) return true;

  return false;
}

/**
 * Detect the version of a repository
 */
export async function detectRepoVersion(projectPath: string): Promise<DetectionResult> {
  // First, check if there are any artifacts at all
  const hasArtifacts = await hasAnyArtifacts(projectPath);
  if (!hasArtifacts) {
    return {
      version: 'uninitialized',
      confidence: 'high',
      indicators: ['No .specify/, specs/, or ROADMAP.md found'],
    };
  }

  // Check for each version
  const v1Indicators = await checkV1Indicators(projectPath);
  const v2Indicators = await checkV2Indicators(projectPath);
  const v3Indicators = await checkV3Indicators(projectPath);

  // Read manifest for return value - check both locations
  const specifyDir = getSpecifyDir(projectPath);
  // Try v3.0 location first, then fall back to legacy location
  let manifest = await readJsonFile<ManifestV2 | ManifestV3>(getManifestPath(projectPath));
  if (!manifest) {
    manifest = await readJsonFile<ManifestV2 | ManifestV3>(join(specifyDir, 'manifest.json'));
  }
  // Try v3.0 location first for state
  let state = await readJsonFile<StateV2>(getStatePath(projectPath));
  if (!state) {
    state = await readJsonFile<StateV2>(join(specifyDir, 'orchestration-state.json'));
  }

  // Prioritize v3.0 detection
  if (v3Indicators.length > 0) {
    return {
      version: 'v3.0',
      confidence: v3Indicators.length >= 2 ? 'high' : 'medium',
      indicators: v3Indicators,
      manifest: manifest ?? undefined,
      stateSchemaVersion: state?.schema_version,
    };
  }

  // Then v2.0
  if (v2Indicators.length > 0) {
    return {
      version: 'v2.0',
      confidence: v2Indicators.length >= 2 ? 'high' : 'medium',
      indicators: v2Indicators,
      manifest: manifest ?? undefined,
      stateSchemaVersion: state?.schema_version,
    };
  }

  // Then v1.0
  if (v1Indicators.length > 0) {
    return {
      version: 'v1.0',
      confidence: v1Indicators.length >= 2 ? 'high' : 'medium',
      indicators: v1Indicators,
      manifest: manifest ?? undefined,
      stateSchemaVersion: state?.schema_version,
    };
  }

  // Has artifacts but can't determine version - assume v1.0 with low confidence
  return {
    version: 'v1.0',
    confidence: 'low',
    indicators: ['Has artifacts but version unclear - assuming v1.0'],
    manifest: manifest ?? undefined,
    stateSchemaVersion: state?.schema_version,
  };
}

/**
 * Check if repo needs upgrade
 */
export async function needsUpgrade(projectPath: string): Promise<boolean> {
  const result = await detectRepoVersion(projectPath);
  return result.version !== 'v3.0' && result.version !== 'uninitialized';
}

/**
 * Get readable version description
 */
export function getVersionDescription(version: RepoVersion): string {
  switch (version) {
    case 'v1.0':
      return 'SpecKit v1.0 (bash scripts, no state management)';
    case 'v2.0':
      return 'SpecKit v2.0 (speckit CLI, /speckit.* commands)';
    case 'v3.0':
      return 'SpecFlow v3.0 (specflow CLI, /flow.* commands)';
    case 'uninitialized':
      return 'Uninitialized (no SDD artifacts found)';
  }
}
