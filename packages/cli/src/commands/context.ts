import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { output } from '../lib/output.js';
import { getStatus, type StatusOutput } from '../lib/status.js';
import { findProjectRoot, getMemoryDir, pathExists } from '../lib/paths.js';
import { handleError } from '../lib/errors.js';

/**
 * Memory document key to filename mapping
 */
const MEMORY_FILE_MAP: Record<string, string> = {
  constitution: 'constitution.md',
  techStack: 'tech-stack.md',
  glossary: 'glossary.md',
  codingStandards: 'coding-standards.md',
  testingStrategy: 'testing-strategy.md',
};

/**
 * Context command output structure
 */
export interface ContextOutput {
  status: StatusOutput;
  memory: Record<string, string | null> | null;
  memoryDir: string | null;
}

/**
 * Load memory documents from the memory directory
 */
async function loadMemoryDocs(
  memDir: string,
  keys?: string[],
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  const keysToLoad = keys ?? Object.keys(MEMORY_FILE_MAP);

  for (const key of keysToLoad) {
    const filename = MEMORY_FILE_MAP[key];
    if (!filename) {
      result[key] = null;
      continue;
    }

    const filePath = join(memDir, filename);
    try {
      result[key] = await readFile(filePath, 'utf-8');
    } catch {
      result[key] = null;
    }
  }

  return result;
}

/**
 * Resolve memory keys from the --memory-keys flag value
 * Accepts both camelCase keys and kebab-case filenames
 */
function resolveMemoryKeys(raw: string): string[] {
  const kebabToKey: Record<string, string> = {
    'constitution': 'constitution',
    'tech-stack': 'techStack',
    'glossary': 'glossary',
    'coding-standards': 'codingStandards',
    'testing-strategy': 'testingStrategy',
  };

  return raw.split(',').map(k => {
    const trimmed = k.trim();
    return kebabToKey[trimmed] ?? trimmed;
  });
}

/**
 * Context command - bundles status + memory document contents
 */
export const contextCommand = new Command('context')
  .description('Get project status with memory document contents')
  .option('--json', 'Output as JSON')
  .option('--no-memory', 'Skip loading memory documents')
  .option('--memory-keys <keys>', 'Comma-separated memory doc keys to include (e.g., constitution,tech-stack)')
  .action(async (options) => {
    try {
      const status = await getStatus();

      let memory: Record<string, string | null> | null = null;
      let memoryDir: string | null = null;

      if (options.memory !== false) {
        const projectRoot = findProjectRoot();
        if (projectRoot) {
          const memDir = getMemoryDir(projectRoot);
          memoryDir = memDir;
          if (pathExists(memDir)) {
            const keys = options.memoryKeys
              ? resolveMemoryKeys(options.memoryKeys)
              : undefined;
            memory = await loadMemoryDocs(memDir, keys);
          }
        }
      }

      const result: ContextOutput = { status, memory, memoryDir };

      if (options.json) {
        output(result);
      } else {
        // Human-readable: show status summary + memory doc names
        const lines: string[] = [];

        if (status.phase.number) {
          lines.push(`Phase ${status.phase.number}: ${status.phase.name ?? 'Unknown'}`);
          lines.push(`Step: ${status.step.current ?? 'none'} | Status: ${status.step.status ?? 'unknown'}`);
        } else {
          lines.push('No active phase');
        }

        if (status.progress.tasksTotal > 0) {
          lines.push(`Tasks: ${status.progress.tasksCompleted}/${status.progress.tasksTotal} (${status.progress.percentage}%)`);
        }

        if (memory) {
          lines.push('');
          lines.push('Memory documents:');
          for (const [key, content] of Object.entries(memory)) {
            const status = content ? `loaded (${content.length} chars)` : 'not found';
            lines.push(`  ${key}: ${status}`);
          }
        }

        output(result, lines.join('\n'));
      }
    } catch (err) {
      handleError(err);
    }
  });
