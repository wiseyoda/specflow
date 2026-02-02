import path from 'path';
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getProjectSessionDir } from '@/lib/project-hash';
import { isCommandInjection } from '@/lib/session-parser';
import { getSessionStatus, readFileTail } from './process-health';
import type { WorkflowIndexEntry } from '@specflow/shared';

/**
 * Discover CLI sessions from Claude projects directory.
 * Scans ~/.claude/projects/{hash}/ for .jsonl files and creates WorkflowIndexEntry objects.
 * These are sessions started from CLI that weren't tracked by the dashboard.
 *
 * @param projectPath - Absolute path to the project
 * @param trackedSessionIds - Set of session IDs already tracked by dashboard (to avoid duplicates)
 * @param limit - Maximum number of sessions to return (default 50)
 */
export function discoverCliSessions(
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

    // Phase 1: Get file stats quickly and filter to candidates
    interface SessionCandidate {
      sessionId: string;
      fullPath: string;
      stats: { mtime: Date; birthtime: Date };
    }
    const candidates: SessionCandidate[] = [];

    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '');

      // Skip if already tracked by dashboard
      if (trackedSessionIds.has(sessionId)) {
        continue;
      }

      const fullPath = path.join(sessionDir, file);
      try {
        const stats = statSync(fullPath);
        candidates.push({ sessionId, fullPath, stats });
      } catch {
        // Could not stat file, skip
      }
    }

    // Phase 2: Sort by mtime and limit BEFORE doing expensive content reads
    candidates.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
    const topCandidates = candidates.slice(0, limit);

    // Phase 3: Process only the top candidates (expensive operations)
    const entries: WorkflowIndexEntry[] = [];

    for (const { sessionId, fullPath, stats } of topCandidates) {
      try {

        // Try to extract skill from JSONL content
        let skill = 'CLI Session';
        try {
          // Read enough to get past system messages to user prompt
          // Skill prompts can be large, so read generously
          const fd = openSync(fullPath, 'r');
          const buffer = Buffer.alloc(32768);
          const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
          closeSync(fd);

          const content = buffer.toString('utf-8', 0, bytesRead);
          const lines = content.split('\n').slice(0, 20);
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              // Check for explicit skill field
              if (msg.skill) {
                skill = msg.skill;
                break;
              }

              // Only check user messages for skill detection — assistant messages
              // may reference other skills (e.g., "after /flow.design completed")
              if (msg.type !== 'user') continue;

              // Extract text from message content (string or array format)
              let textContent = '';
              const msgContent = msg.message?.content;
              if (typeof msgContent === 'string') {
                textContent = msgContent;
              } else if (Array.isArray(msgContent)) {
                textContent = msgContent
                  .filter((b: { type: string }) => b.type === 'text')
                  .map((b: { text: string }) => b.text)
                  .join('\n');
              }

              if (textContent) {
                // Use isCommandInjection for robust skill detection — it has
                // content-specific patterns (e.g., [IMPL] → flow.implement)
                // that work even when skill prompts reference other skills
                const commandInfo = isCommandInjection(textContent);
                if (commandInfo.isCommand && commandInfo.commandName) {
                  skill = commandInfo.commandName;
                  break;
                }
                // Fallback: explicit header (e.g., "# flow.analyze")
                const headerMatch = textContent.match(/^# \/?flow\.(\w+)/m);
                if (headerMatch) {
                  skill = `flow.${headerMatch[1]}`;
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

        const ageMs = Date.now() - stats.mtime.getTime();

        // Read tail and get status from single source of truth
        let tail = '';
        try {
          tail = readFileTail(fullPath, 10000);
        } catch {
          // Ignore tail read failures
        }

        // Use centralized status detection (process-health.ts is the single source of truth)
        const status = getSessionStatus(tail, ageMs);

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
        // Could not process file, skip
      }
    }

    // Already sorted by mtime in Phase 2, just return entries
    return entries;
  } catch {
    return [];
  }
}
