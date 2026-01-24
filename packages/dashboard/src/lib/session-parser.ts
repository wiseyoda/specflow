/**
 * Question option from AskUserQuestion tool call.
 */
export interface QuestionOption {
  label: string;
  description?: string;
}

/**
 * Question from AskUserQuestion tool call.
 */
export interface QuestionInfo {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

/**
 * Structured output from workflow completion (StructuredOutput tool call).
 */
export interface WorkflowOutput {
  status: 'completed' | 'error' | 'needs_input' | 'cancelled' | string;
  phase?: string;
  message?: string;
  artifacts?: Array<{ path: string; action: string }>;
  questions?: QuestionInfo[];
}

/**
 * Session message from Claude JSONL files.
 * Only user and assistant messages are displayed; tool calls are parsed for metrics.
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  /** Tool calls associated with this message (for assistant messages) */
  toolCalls?: ToolCallInfo[];
  /** Whether this message is a command injection (for user messages) */
  isCommandInjection?: boolean;
  /** Detected command name for command injections */
  commandName?: string;
  /** Whether this is a session end indicator */
  isSessionEnd?: boolean;
  /** Questions from AskUserQuestion tool call (for assistant messages) */
  questions?: QuestionInfo[];
  /** Agent tasks launched from this message */
  agentTasks?: AgentTaskInfo[];
}

/**
 * Tool call metadata extracted from JSONL for metrics (not displayed as messages).
 */
export interface ToolCallMetrics {
  name: string;
  filesModified?: string[];
}

/**
 * Detailed tool call information for UI display.
 */
export interface ToolCallInfo {
  name: string;
  operation: 'read' | 'write' | 'edit' | 'search' | 'execute' | 'todo' | 'agent';
  files: string[];
  input?: Record<string, unknown>;
}

/**
 * Agent task information from Task tool calls.
 */
export interface AgentTaskInfo {
  id: string;
  description: string;
  subagentType: string;
  status: 'running' | 'completed';
}

/**
 * Todo item from TodoWrite tool calls.
 */
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/**
 * Result of parsing a single JSONL line.
 */
export interface ParseResult {
  message: SessionMessage | null;
  toolCall?: ToolCallMetrics;
  toolCalls?: ToolCallInfo[];
  todos?: TodoItem[];
  workflowOutput?: WorkflowOutput;
  agentTasks?: AgentTaskInfo[];
  /** Tool IDs that received results (to mark agents as completed) */
  completedToolIds?: string[];
}

/**
 * Aggregated session data returned to clients.
 */
export interface SessionData {
  messages: SessionMessage[];
  filesModified: Set<string>;
  startTime?: string;
  toolCalls: ToolCallInfo[];
  currentTodos: TodoItem[];
  /** Final structured output from workflow completion (if any) */
  workflowOutput?: WorkflowOutput;
  /** Currently running or recently completed agent tasks */
  agentTasks: AgentTaskInfo[];
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
 * Extract tool calls from content blocks for metrics (legacy format).
 */
function extractToolCallMetrics(content: unknown): ToolCallMetrics[] {
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
 * Get operation type for a tool name.
 */
function getToolOperation(name: string): ToolCallInfo['operation'] {
  switch (name) {
    case 'Read':
      return 'read';
    case 'Write':
      return 'write';
    case 'Edit':
      return 'edit';
    case 'Glob':
    case 'Grep':
      return 'search';
    case 'TodoWrite':
      return 'todo';
    case 'Task':
      return 'agent';
    case 'Bash':
    default:
      return 'execute';
  }
}

/**
 * Extract detailed tool call information for UI display.
 */
function extractToolCallInfos(content: unknown): {
  toolCalls: ToolCallInfo[];
  todos: TodoItem[];
  questions: QuestionInfo[];
  workflowOutput?: WorkflowOutput;
  agentTasks: AgentTaskInfo[];
} {
  const toolCalls: ToolCallInfo[] = [];
  let todos: TodoItem[] = [];
  const questions: QuestionInfo[] = [];
  let workflowOutput: WorkflowOutput | undefined;
  const agentTasks: AgentTaskInfo[] = [];

  if (!Array.isArray(content)) {
    return { toolCalls, todos, questions, agentTasks };
  }

  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'type' in block) {
      if (block.type === 'tool_use' && 'name' in block) {
        const name = String(block.name);
        const input = 'input' in block ? (block.input as Record<string, unknown>) : {};
        const files: string[] = [];
        const operation = getToolOperation(name);

        // Extract file paths based on tool type
        switch (name) {
          case 'Read':
          case 'Write':
          case 'Edit': {
            const filePath = input?.file_path || input?.path;
            if (typeof filePath === 'string') {
              files.push(filePath);
            }
            break;
          }
          case 'Glob': {
            // Glob returns pattern and path
            const pattern = input?.pattern;
            const path = input?.path;
            if (typeof pattern === 'string') {
              files.push(path ? `${path}/${pattern}` : pattern);
            }
            break;
          }
          case 'Grep': {
            const path = input?.path;
            if (typeof path === 'string') {
              files.push(path);
            }
            break;
          }
          case 'TodoWrite': {
            // Extract todos from TodoWrite calls
            const todoItems = input?.todos;
            if (Array.isArray(todoItems)) {
              todos = todoItems
                .filter(
                  (t): t is { content: string; status: string; activeForm: string } =>
                    typeof t === 'object' &&
                    t !== null &&
                    typeof t.content === 'string' &&
                    typeof t.status === 'string' &&
                    typeof t.activeForm === 'string'
                )
                .map((t) => ({
                  content: t.content,
                  status: t.status as TodoItem['status'],
                  activeForm: t.activeForm,
                }));
            }
            break;
          }
          case 'AskUserQuestion': {
            // Extract questions from AskUserQuestion calls
            const questionItems = input?.questions;
            if (Array.isArray(questionItems)) {
              for (const q of questionItems) {
                if (typeof q === 'object' && q !== null && typeof q.question === 'string') {
                  const questionInfo: QuestionInfo = {
                    question: q.question,
                    header: typeof q.header === 'string' ? q.header : undefined,
                    options: [],
                    multiSelect: typeof q.multiSelect === 'boolean' ? q.multiSelect : false,
                  };
                  // Extract options
                  if (Array.isArray(q.options)) {
                    for (const opt of q.options) {
                      if (typeof opt === 'object' && opt !== null && typeof opt.label === 'string') {
                        questionInfo.options.push({
                          label: opt.label,
                          description: typeof opt.description === 'string' ? opt.description : undefined,
                        });
                      }
                    }
                  }
                  questions.push(questionInfo);
                }
              }
            }
            break;
          }
          case 'StructuredOutput': {
            // Extract structured output from workflow completion
            if (input && typeof input.status === 'string') {
              workflowOutput = {
                status: input.status as WorkflowOutput['status'],
                phase: typeof input.phase === 'string' ? input.phase : undefined,
                message: typeof input.message === 'string' ? input.message : undefined,
              };
              // Extract artifacts if present
              if (Array.isArray(input.artifacts)) {
                workflowOutput.artifacts = input.artifacts
                  .filter(
                    (a): a is { path: string; action: string } =>
                      typeof a === 'object' &&
                      a !== null &&
                      typeof a.path === 'string' &&
                      typeof a.action === 'string'
                  );
              }
              // Extract questions if present (for needs_input status)
              if (Array.isArray(input.questions)) {
                workflowOutput.questions = input.questions
                  .filter(
                    (q): q is { question: string } =>
                      typeof q === 'object' && q !== null && typeof q.question === 'string'
                  )
                  .map((q) => ({
                    question: q.question,
                    header: typeof (q as Record<string, unknown>).header === 'string'
                      ? (q as Record<string, unknown>).header as string
                      : undefined,
                    options: Array.isArray((q as Record<string, unknown>).options)
                      ? ((q as Record<string, unknown>).options as unknown[])
                          .filter(
                            (o): o is { label: string } =>
                              typeof o === 'object' && o !== null && typeof (o as Record<string, unknown>).label === 'string'
                          )
                          .map((o) => ({
                            label: (o as Record<string, unknown>).label as string,
                            description: typeof (o as Record<string, unknown>).description === 'string'
                              ? (o as Record<string, unknown>).description as string
                              : undefined,
                          }))
                      : [],
                    multiSelect: typeof (q as Record<string, unknown>).multiSelect === 'boolean'
                      ? (q as Record<string, unknown>).multiSelect as boolean
                      : false,
                  }));
              }
            }
            break;
          }
          case 'Task': {
            // Extract agent task information
            const id = 'id' in block ? String(block.id) : '';
            const description = typeof input?.description === 'string' ? input.description : 'Running task...';
            const subagentType = typeof input?.subagent_type === 'string' ? input.subagent_type : 'general-purpose';
            agentTasks.push({
              id,
              description,
              subagentType,
              status: 'running', // Will be updated to 'completed' when result is found
            });
            break;
          }
        }

        toolCalls.push({
          name,
          operation,
          files,
          input,
        });
      }
    }
  }

  return { toolCalls, todos, questions, workflowOutput, agentTasks };
}

/**
 * Detect if a message content is a command injection (workflow command).
 */
export function isCommandInjection(content: string): {
  isCommand: boolean;
  commandName: string | null;
} {
  // Patterns that indicate workflow commands
  const commandPatterns = [
    /^## Critical Rules/i,
    /^\*\*NEVER edit tasks\.md directly\*\*/,
    /\$ARGUMENTS/,
    /## Execution/,
    /\[IMPL\] INITIALIZE/,
    /## Memory Protocol/,
    /## Phase Lifecycle/,
    /# @\w+ Agent/,
    /## Design Phase/,
    /## Implement Phase/,
    /## Verify Phase/,
    /^# flow\./,
    /## Orchestration State/,
  ];

  // Check if content matches command patterns
  const isCommand = commandPatterns.some((pattern) => pattern.test(content));

  if (!isCommand) {
    return { isCommand: false, commandName: null };
  }

  // Extract command name from content
  // Order matters - more specific patterns first
  const namePatterns = [
    // Most specific: explicit command header or description line
    { pattern: /^# \/flow\.(\w+)/m, prefix: 'flow.' },
    { pattern: /^description:\s*.*flow\.(\w+)/im, prefix: 'flow.' },
    // Phase-specific patterns
    { pattern: /\[IMPL\]/i, prefix: '', name: 'flow.implement' },
    { pattern: /\[MERGE\]/i, prefix: '', name: 'flow.merge' },
    { pattern: /\[VERIFY\]/i, prefix: '', name: 'flow.verify' },
    { pattern: /\[DESIGN\]/i, prefix: '', name: 'flow.design' },
    { pattern: /## Design Phase/i, prefix: '', name: 'flow.design' },
    { pattern: /## Verify Phase/i, prefix: '', name: 'flow.verify' },
    { pattern: /## Memory Protocol/i, prefix: '', name: 'flow.memory' },
    // Agent patterns
    { pattern: /# @(\w+) Agent/i, prefix: '' },
    { pattern: /## (\w+) Phase/i, prefix: '' },
    // Generic flow pattern - only at start of line to avoid matching mentions in content
    { pattern: /^flow\.(\w+)/im, prefix: 'flow.' },
  ];

  for (const { pattern, prefix, name } of namePatterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        isCommand: true,
        commandName: name || (prefix + match[1]),
      };
    }
  }

  return { isCommand: true, commandName: 'Command' };
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

    // Detect Stop hook meta messages and convert to session end indicator
    if (data.isMeta === true && data.type === 'user') {
      const content = extractTextContent(data.message?.content);
      if (content.startsWith('Stop hook feedback:')) {
        return {
          message: {
            role: 'system',
            content: 'Session Ended',
            timestamp: data.timestamp,
            isSessionEnd: true,
          },
        };
      }
    }

    // User and assistant messages are in data.message.content
    if (data.type === 'user' || data.type === 'assistant') {
      const messageContent = data.message?.content;
      const textContent = extractTextContent(messageContent);

      // Extract detailed tool call info (for assistant messages)
      const { toolCalls: detailedToolCalls, todos, questions, workflowOutput, agentTasks } = extractToolCallInfos(messageContent);

      // Extract completed tool IDs from tool_result blocks (user messages contain these)
      const completedToolIds: string[] = [];
      if (Array.isArray(messageContent)) {
        for (const block of messageContent) {
          if (typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_result' && 'tool_use_id' in block) {
            completedToolIds.push(String(block.tool_use_id));
          }
        }
      }

      // Skip messages that are only tool calls (no text content)
      // BUT: If there are questions, workflowOutput, or agentTasks, we still want to capture them
      if (!textContent && questions.length === 0 && !workflowOutput && agentTasks.length === 0) {
        // But still extract tool call metrics
        const toolCallMetrics = extractToolCallMetrics(messageContent);
        if (toolCallMetrics.length > 0 || detailedToolCalls.length > 0 || completedToolIds.length > 0) {
          return {
            message: null,
            toolCall: toolCallMetrics[0],
            toolCalls: detailedToolCalls.length > 0 ? detailedToolCalls : undefined,
            todos: todos.length > 0 ? todos : undefined,
            workflowOutput,
            agentTasks: agentTasks.length > 0 ? agentTasks : undefined,
            completedToolIds: completedToolIds.length > 0 ? completedToolIds : undefined,
          };
        }
        return { message: null };
      }

      // Also extract any tool calls for metrics
      const toolCallMetrics = extractToolCallMetrics(messageContent);

      // Check if user message is a command injection
      const isUser = data.type === 'user';
      const commandInfo = isUser ? isCommandInjection(textContent) : null;

      return {
        message: {
          role: data.type,
          content: textContent || '', // May be empty if only questions
          timestamp: data.timestamp,
          toolCalls: detailedToolCalls.length > 0 ? detailedToolCalls : undefined,
          isCommandInjection: commandInfo?.isCommand,
          commandName: commandInfo?.commandName ?? undefined,
          questions: questions.length > 0 ? questions : undefined,
          agentTasks: agentTasks.length > 0 ? agentTasks : undefined,
        },
        toolCall: toolCallMetrics.length > 0 ? toolCallMetrics[0] : undefined,
        toolCalls: detailedToolCalls.length > 0 ? detailedToolCalls : undefined,
        todos: todos.length > 0 ? todos : undefined,
        workflowOutput,
        agentTasks: agentTasks.length > 0 ? agentTasks : undefined,
        completedToolIds: completedToolIds.length > 0 ? completedToolIds : undefined,
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
 * Handles the case where Claude Code writes tool calls on separate lines
 * from text content by associating tool calls with the preceding assistant message.
 *
 * @param lines - Array of JSONL lines
 * @returns Aggregated session data with messages and metrics
 */
export function parseSessionLines(lines: string[]): SessionData {
  const messages: SessionMessage[] = [];
  const filesModified = new Set<string>();
  const allToolCalls: ToolCallInfo[] = [];
  let currentTodos: TodoItem[] = [];
  let startTime: string | undefined;
  let workflowOutput: WorkflowOutput | undefined;
  // Track agent tasks by ID for status updates
  const agentTasksMap = new Map<string, AgentTaskInfo>();

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

    // Track agent tasks
    if (result.agentTasks && result.agentTasks.length > 0) {
      for (const task of result.agentTasks) {
        agentTasksMap.set(task.id, task);
      }
      // Also associate with the message that launched them
      if (result.message) {
        result.message.agentTasks = result.agentTasks;
      } else {
        // Associate with last assistant message
        const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistantMessage) {
          lastAssistantMessage.agentTasks = [
            ...(lastAssistantMessage.agentTasks ?? []),
            ...result.agentTasks,
          ];
        }
      }
    }

    // Mark agent tasks as completed when we see their tool_result
    if (result.completedToolIds && result.completedToolIds.length > 0) {
      for (const toolId of result.completedToolIds) {
        const task = agentTasksMap.get(toolId);
        if (task) {
          task.status = 'completed';
        }
      }
    }

    // Aggregate tool calls and associate with preceding assistant message
    if (result.toolCalls && result.toolCalls.length > 0) {
      allToolCalls.push(...result.toolCalls);

      // If this line has tool calls but no message, associate them with the last assistant message
      if (!result.message) {
        const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistantMessage) {
          // Merge tool calls into the last assistant message
          lastAssistantMessage.toolCalls = [
            ...(lastAssistantMessage.toolCalls ?? []),
            ...result.toolCalls,
          ];
        }
      }

      // Track files from detailed tool calls
      for (const tc of result.toolCalls) {
        if (tc.operation === 'write' || tc.operation === 'edit') {
          for (const file of tc.files) {
            filesModified.add(file);
          }
        }
      }
    }

    // Update current todos (last TodoWrite wins)
    if (result.todos && result.todos.length > 0) {
      currentTodos = result.todos;
    }

    // Track workflow output (last StructuredOutput wins)
    if (result.workflowOutput) {
      workflowOutput = result.workflowOutput;
    }
  }

  // Convert agent tasks map to array (preserves status updates)
  const agentTasks = Array.from(agentTasksMap.values());

  return { messages, filesModified, startTime, toolCalls: allToolCalls, currentTodos, workflowOutput, agentTasks };
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
