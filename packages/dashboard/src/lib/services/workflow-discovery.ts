import path from 'path';
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getProjectSessionDir } from '@/lib/project-hash';
import { isCommandInjection } from '@/lib/session-parser';
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

        // CLI-discovered sessions are always 'completed' — "detached" means the
        // dashboard lost track of a session it was actively monitoring, which doesn't
        // apply to sessions the dashboard never started. Marking recent CLI sessions
        // as 'detached' caused false "Session May Still Be Running" banners.
        const status: WorkflowIndexEntry['status'] = 'completed';

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
