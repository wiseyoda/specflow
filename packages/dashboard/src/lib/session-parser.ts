/**
 * Session message from Claude JSONL files.
 * Only user and assistant messages are displayed; tool calls are parsed for metrics.
 */
export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Tool call metadata extracted from JSONL for metrics (not displayed as messages).
 */
export interface ToolCallMetrics {
  name: string;
  filesModified?: string[];
}

/**
 * Result of parsing a single JSONL line.
 */
export interface ParseResult {
  message: SessionMessage | null;
  toolCall?: ToolCallMetrics;
}

/**
 * Aggregated session data returned to clients.
 */
export interface SessionData {
  messages: SessionMessage[];
  filesModified: Set<string>;
  startTime?: string;
}

/**
 * Extract text content from a content block or array of content blocks.
 * Handles both string content and structured content blocks.
 */
function extractTextContent(content: unknown): string {
  // Direct string content
  if (typeof content === 'string') {
    return content;
  }

  // Array of content blocks
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (typeof block === 'object' && block !== null) {
        // Text block: {type: "text", text: "..."}
        if ('type' in block && block.type === 'text' && 'text' in block) {
          textParts.push(String(block.text));
        }
        // Tool result block: {type: "tool_result", content: "..."}
        if ('type' in block && block.type === 'tool_result' && 'content' in block) {
          // Skip tool results - they're verbose and not useful to display
        }
      }
    }
    return textParts.join('\n');
  }

  return '';
}

/**
 * Extract tool calls from content blocks for metrics.
 */
function extractToolCalls(content: unknown): ToolCallMetrics[] {
  const toolCalls: ToolCallMetrics[] = [];

  if (!Array.isArray(content)) {
    return toolCalls;
  }

  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'type' in block) {
      // Tool use block: {type: "tool_use", name: "...", input: {...}}
      if (block.type === 'tool_use' && 'name' in block) {
        const name = String(block.name);
        const filesModified: string[] = [];

        // Extract file paths from Write/Edit tools
        if ((name === 'Write' || name === 'Edit') && 'input' in block) {
          const input = block.input as Record<string, unknown>;
          const filePath = input?.file_path || input?.path;
          if (typeof filePath === 'string') {
            filesModified.push(filePath);
          }
        }

        toolCalls.push({
          name,
          filesModified: filesModified.length > 0 ? filesModified : undefined,
        });
      }
    }
  }

  return toolCalls;
}

/**
 * Parse a single JSONL line from a Claude session file.
 * Extracts user/assistant messages for display and tool call metadata for metrics.
 *
 * @param line - Single line from JSONL file
 * @returns ParseResult with message and/or tool call data
 */
export function parseSessionLine(line: string): ParseResult {
  if (!line.trim()) {
    return { message: null };
  }

  try {
    const data = JSON.parse(line);

    // User and assistant messages are in data.message.content
    if (data.type === 'user' || data.type === 'assistant') {
      const messageContent = data.message?.content;
      const textContent = extractTextContent(messageContent);

      // Skip messages that are only tool calls (no text content)
      if (!textContent) {
        // But still extract tool call metrics
        const toolCalls = extractToolCalls(messageContent);
        if (toolCalls.length > 0) {
          // Return first tool call for metrics
          return {
            message: null,
            toolCall: toolCalls[0],
          };
        }
        return { message: null };
      }

      // Also extract any tool calls for metrics
      const toolCalls = extractToolCalls(messageContent);

      return {
        message: {
          role: data.type,
          content: textContent,
          timestamp: data.timestamp,
        },
        toolCall: toolCalls.length > 0 ? toolCalls[0] : undefined,
      };
    }

    return { message: null };
  } catch {
    // Skip malformed lines silently
    return { message: null };
  }
}

/**
 * Parse multiple JSONL lines into aggregated session data.
 *
 * @param lines - Array of JSONL lines
 * @returns Aggregated session data with messages and metrics
 */
export function parseSessionLines(lines: string[]): SessionData {
  const messages: SessionMessage[] = [];
  const filesModified = new Set<string>();
  let startTime: string | undefined;

  for (const line of lines) {
    const result = parseSessionLine(line);

    if (result.message) {
      messages.push(result.message);
      // Track earliest timestamp as start time
      if (result.message.timestamp && (!startTime || result.message.timestamp < startTime)) {
        startTime = result.message.timestamp;
      }
    }

    if (result.toolCall?.filesModified) {
      for (const file of result.toolCall.filesModified) {
        filesModified.add(file);
      }
    }
  }

  return { messages, filesModified, startTime };
}

/**
 * Read the last N lines from a file content string (tail mode).
 *
 * @param content - Full file content
 * @param limit - Maximum number of lines to return
 * @returns Array of last N lines
 */
export function tailLines(content: string, limit: number): string[] {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length <= limit) {
    return lines;
  }
  return lines.slice(-limit);
}
