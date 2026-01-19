import { promises as fs } from 'fs';
import path from 'path';

/**
 * State file locations
 * v3.0 uses .specflow/, v2.0 used .specify/
 */
const STATE_DIR_V3 = '.specflow';
const STATE_DIR_V2 = '.specify';
const STATE_FILE = 'orchestration-state.json';
const MANIFEST_FILE = 'manifest.json';

/**
 * Get the state directory path, auto-migrating from v2 if needed
 * Returns the v3 path (.specflow/) after ensuring migration
 */
export async function getStateDirPath(projectPath: string): Promise<string> {
  const v3Dir = path.join(projectPath, STATE_DIR_V3);
  const v2Dir = path.join(projectPath, STATE_DIR_V2);

  // Check if v3 directory exists
  const v3Exists = await dirExists(v3Dir);
  if (v3Exists) {
    return v3Dir;
  }

  // Check if v2 directory exists with state files
  const v2Exists = await dirExists(v2Dir);
  if (v2Exists) {
    // Try to migrate
    await migrateStateFiles(projectPath);
  }

  return v3Dir;
}

/**
 * Get the state file path, auto-migrating from v2 if needed
 */
export async function getStateFilePath(projectPath: string): Promise<string> {
  const stateDir = await getStateDirPath(projectPath);
  return path.join(stateDir, STATE_FILE);
}

/**
 * Get the manifest file path, auto-migrating from v2 if needed
 */
export async function getManifestFilePath(projectPath: string): Promise<string> {
  const stateDir = await getStateDirPath(projectPath);
  return path.join(stateDir, MANIFEST_FILE);
}

/**
 * Synchronous version for cases where we can't await
 * Just returns the v3 path without migration
 */
export function getStateFilePathSync(projectPath: string): string {
  return path.join(projectPath, STATE_DIR_V3, STATE_FILE);
}

/**
 * Check both locations for state file (for watching)
 * Returns array of paths that exist
 */
export async function findStateFilePaths(projectPath: string): Promise<string[]> {
  const paths: string[] = [];

  const v3Path = path.join(projectPath, STATE_DIR_V3, STATE_FILE);
  const v2Path = path.join(projectPath, STATE_DIR_V2, STATE_FILE);

  if (await fileExists(v3Path)) {
    paths.push(v3Path);
  }
  if (await fileExists(v2Path)) {
    paths.push(v2Path);
  }

  return paths;
}

/**
 * Migrate state files from .specify/ to .specflow/
 * Moves orchestration-state.json and manifest.json if they exist
 */
export async function migrateStateFiles(projectPath: string): Promise<boolean> {
  const v3Dir = path.join(projectPath, STATE_DIR_V3);
  const v2Dir = path.join(projectPath, STATE_DIR_V2);

  // Check if v2 has files to migrate
  const v2StateFile = path.join(v2Dir, STATE_FILE);
  const v2ManifestFile = path.join(v2Dir, MANIFEST_FILE);

  const hasV2State = await fileExists(v2StateFile);
  const hasV2Manifest = await fileExists(v2ManifestFile);

  if (!hasV2State && !hasV2Manifest) {
    return false; // Nothing to migrate
  }

  // Ensure v3 directory exists
  await fs.mkdir(v3Dir, { recursive: true });

  let migrated = false;

  // Migrate state file
  if (hasV2State) {
    const v3StateFile = path.join(v3Dir, STATE_FILE);
    const v3StateExists = await fileExists(v3StateFile);

    if (!v3StateExists) {
      try {
        await fs.rename(v2StateFile, v3StateFile);
        console.log(`[Migration] Moved ${STATE_FILE} from .specify/ to .specflow/`);
        migrated = true;
      } catch (err) {
        console.error(`[Migration] Failed to move ${STATE_FILE}:`, err);
      }
    }
  }

  // Migrate manifest file
  if (hasV2Manifest) {
    const v3ManifestFile = path.join(v3Dir, MANIFEST_FILE);
    const v3ManifestExists = await fileExists(v3ManifestFile);

    if (!v3ManifestExists) {
      try {
        await fs.rename(v2ManifestFile, v3ManifestFile);
        console.log(`[Migration] Moved ${MANIFEST_FILE} from .specify/ to .specflow/`);
        migrated = true;
      } catch (err) {
        console.error(`[Migration] Failed to move ${MANIFEST_FILE}:`, err);
      }
    }
  }

  return migrated;
}

/**
 * Helper to check if directory exists
 */
async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Helper to check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
