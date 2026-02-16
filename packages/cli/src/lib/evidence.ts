import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import { pathExists } from './paths.js';
import { atomicWriteFile } from './fs-utils.js';

/**
 * Evidence sidecar for verification tasks.
 *
 * Stores structured evidence of what was verified.
 * Location: {featureDir}/.evidence.json
 */

const EvidenceRecordSchema = z.object({
  itemId: z.string(),
  timestamp: z.string(),
  evidence: z.string(),
  sharedWith: z.array(z.string()).optional(),
});

const EvidenceFileSchema = z.object({
  version: z.literal('1.0'),
  featureDir: z.string(),
  items: z.record(z.string(), EvidenceRecordSchema),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceFile = z.infer<typeof EvidenceFileSchema>;

function getEvidencePath(featureDir: string): string {
  return join(featureDir, '.evidence.json');
}

/** Legacy path for backward compatibility */
function getLegacyEvidencePath(featureDir: string): string {
  return join(featureDir, 'checklists', '.evidence.json');
}

/** Read evidence file, returns null if it doesn't exist. Falls back to legacy path. */
export async function readEvidence(featureDir: string): Promise<EvidenceFile | null> {
  const evidencePath = getEvidencePath(featureDir);

  if (pathExists(evidencePath)) {
    const content = await readFile(evidencePath, 'utf-8');
    const data = JSON.parse(content);
    return EvidenceFileSchema.parse(data);
  }

  // Fallback to legacy checklists/.evidence.json path
  const legacyPath = getLegacyEvidencePath(featureDir);
  if (pathExists(legacyPath)) {
    const content = await readFile(legacyPath, 'utf-8');
    const data = JSON.parse(content);
    return EvidenceFileSchema.parse(data);
  }

  return null;
}

/** Write evidence file atomically */
export async function writeEvidence(featureDir: string, evidence: EvidenceFile): Promise<void> {
  const evidencePath = getEvidencePath(featureDir);
  await mkdir(dirname(evidencePath), { recursive: true });
  await atomicWriteFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
}

/**
 * Record evidence for one or more items.
 * If multiple itemIds are provided, they share the same evidence text
 * and each record's `sharedWith` lists the other items in the batch.
 */
export async function recordEvidence(
  featureDir: string,
  itemIds: string[],
  evidenceText: string,
): Promise<EvidenceFile> {
  const existing = await readEvidence(featureDir);
  const evidence: EvidenceFile = existing ?? {
    version: '1.0',
    featureDir,
    items: {},
  };

  const now = new Date().toISOString();
  const sharedWith = itemIds.length > 1 ? itemIds : undefined;

  for (const itemId of itemIds) {
    evidence.items[itemId] = {
      itemId,
      timestamp: now,
      evidence: evidenceText,
      sharedWith: sharedWith?.filter(id => id !== itemId),
    };
  }

  await writeEvidence(featureDir, evidence);
  return evidence;
}

/** Remove evidence for one or more items */
export async function removeEvidence(
  featureDir: string,
  itemIds: string[],
): Promise<void> {
  const evidence = await readEvidence(featureDir);
  if (!evidence) return;

  for (const itemId of itemIds) {
    delete evidence.items[itemId];
  }

  await writeEvidence(featureDir, evidence);
}

/** Check if all given item IDs have evidence recorded */
export function hasEvidence(evidence: EvidenceFile | null, itemIds: string[]): {
  complete: boolean;
  missing: string[];
} {
  if (!evidence) {
    return { complete: false, missing: itemIds };
  }

  const missing = itemIds.filter(id => !evidence.items[id]);
  return {
    complete: missing.length === 0,
    missing,
  };
}
