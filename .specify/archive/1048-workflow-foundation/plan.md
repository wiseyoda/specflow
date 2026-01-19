# Implementation Plan: Workflow Foundation

**Branch**: `1048-workflow-foundation` | **Date**: 2026-01-18 | **Spec**: [spec.md](spec.md)

## Summary

Refactor the proven POC workflow executor into a production-grade service that links workflow executions to registered dashboard projects, exposes clean API routes, and adds robust error handling including timeout and cancellation.

## Technical Context

**Language/Version**: TypeScript 5.7+
**Primary Dependencies**: Next.js 16.x (App Router), Zod 3.x
**Storage**: File-based JSON at `~/.specflow/workflows/{id}.json`
**Testing**: Vitest (for service unit tests)
**Target Platform**: Node.js server (Next.js API routes)
**Project Type**: Monorepo - packages/dashboard
**Constraints**: Must preserve exact Claude CLI invocation pattern from POC

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| IIa. TypeScript for CLI Packages | PASS | Using TypeScript with strict mode |
| III. CLI Over Direct Edits | PASS | State managed through service, not direct file edits |
| IV. Simplicity Over Cleverness | PASS | File-based persistence, polling (no SSE complexity) |
| V. Helpful Error Messages | PASS | All errors include context and next steps |
| VII. Three-Line Output Rule | N/A | API routes, not CLI output |

## Project Structure

### Source Code

```text
packages/dashboard/src/
├── lib/
│   └── services/
│       └── workflow-service.ts    # Main service (refactored from workflow-executor.ts)
└── app/
    └── api/
        └── workflow/
            ├── start/
            │   └── route.ts       # POST /api/workflow/start
            ├── status/
            │   └── route.ts       # GET /api/workflow/status
            ├── list/
            │   └── route.ts       # GET /api/workflow/list
            ├── answer/
            │   └── route.ts       # POST /api/workflow/answer
            └── cancel/
                └── route.ts       # POST /api/workflow/cancel

packages/dashboard/tests/
└── services/
    └── workflow-service.test.ts   # Unit tests for service
```

### Reference Files (POC)

```text
packages/dashboard/src/
├── lib/
│   └── workflow-executor.ts       # POC to refactor (DO NOT DELETE until production verified)
└── app/
    ├── debug/workflow/page.tsx    # POC UI patterns (reference only)
    └── api/debug/workflow/        # POC API routes (reference only)
```

## Data Model

### WorkflowExecution

```typescript
interface WorkflowExecution {
  id: string;                 // UUID v4
  projectId: string;          // Registry project UUID
  sessionId?: string;         // Claude CLI session ID (from output)
  skill: string;              // Skill name (e.g., "flow.design")
  status: 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled';
  output?: WorkflowOutput;    // Structured output from Claude
  answers: Record<string, string>;  // Accumulated user answers
  logs: string[];             // Timestamped log entries
  stdout: string;             // Raw CLI stdout
  stderr: string;             // Raw CLI stderr
  error?: string;             // Error message if failed
  costUsd: number;            // Accumulated API cost
  startedAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp
  timeoutMs: number;          // Configured timeout (default 600000)
  pid?: number;               // Child process ID (for cancel)
  cancelledAt?: string;       // ISO timestamp when cancelled
}
```

### WorkflowOutput

```typescript
interface WorkflowOutput {
  status: 'completed' | 'needs_input' | 'error';
  phase?: string;
  message?: string;
  questions?: WorkflowQuestion[];
  artifacts?: Array<{ path: string; action: 'created' | 'modified' }>;
}
```

### WorkflowQuestion

```typescript
interface WorkflowQuestion {
  question: string;
  header?: string;
  options?: Array<{ label: string; description: string }>;
  multiSelect?: boolean;
}
```

## API Contracts

### POST /api/workflow/start

**Request**:
```typescript
{
  projectId: string;    // Required: Registry project UUID
  skill: string;        // Required: Skill name (e.g., "flow.design")
  timeoutMs?: number;   // Optional: Override default timeout
}
```

**Response** (201):
```typescript
{
  id: string;           // Execution UUID
  status: 'running';
  projectId: string;
  skill: string;
  startedAt: string;
}
```

**Errors**:
- 400: Invalid request body
- 404: Project not found in registry

### GET /api/workflow/status

**Query**: `?id=<execution-id>`

**Response** (200): Full `WorkflowExecution` object

**Errors**:
- 400: Missing id parameter
- 404: Execution not found

### GET /api/workflow/list

**Query**: `?projectId=<project-id>` (optional)

**Response** (200):
```typescript
{
  executions: WorkflowExecution[];  // Sorted by updatedAt desc
}
```

### POST /api/workflow/answer

**Request**:
```typescript
{
  id: string;                       // Execution UUID
  answers: Record<string, string>;  // Key-value answers
}
```

**Response** (200): Updated `WorkflowExecution` with status "running"

**Errors**:
- 400: Workflow not in waiting_for_input state
- 404: Execution not found

### POST /api/workflow/cancel

**Query**: `?id=<execution-id>`

**Response** (200): Updated `WorkflowExecution` with status "cancelled"

**Errors**:
- 400: Cannot cancel workflow in current state
- 404: Execution not found

## CLI Invocation Pattern

Preserve exact pattern from POC:

```bash
# Initial execution
claude -p --output-format json \
  --dangerously-skip-permissions \
  --disallowedTools "AskUserQuestion" \
  --json-schema "$(cat schema.json)" \
  < prompt.txt > output.json 2>&1

# Resume execution
claude -p --output-format json \
  --resume "{sessionId}" \
  --dangerously-skip-permissions \
  --disallowedTools "AskUserQuestion" \
  --json-schema "$(cat schema.json)" \
  < resume-prompt.txt > output.json 2>&1
```

## Service Methods

| Method | Purpose |
|--------|---------|
| `start(projectId, skill, timeoutMs?)` | Create execution, spawn Claude process |
| `resume(id, answers)` | Merge answers, spawn resume process |
| `get(id)` | Load execution by ID |
| `list(projectId?)` | List executions, optionally filtered |
| `cancel(id)` | Kill process, update status |
| `runClaude(id, isResume)` | Internal: spawn and monitor Claude CLI |

## Error Handling

| Scenario | Handling |
|----------|----------|
| Process exit non-zero | Set status="failed", capture stderr |
| Timeout exceeded | Kill process, set status="failed", error="Timeout exceeded" |
| Cancel requested | SIGTERM process, set status="cancelled" |
| JSON parse error | Set status="failed", log raw output |
| Project not found | 404 before execution starts |
| Disk write failure | Log error, keep in-memory state, retry |

## Timeout Implementation

```typescript
// Set timeout when process spawns
const timeout = setTimeout(() => {
  if (process.pid) {
    process.kill('SIGTERM');
  }
  updateExecution(id, {
    status: 'failed',
    error: `Timeout exceeded (${timeoutMs}ms)`
  });
}, timeoutMs);

// Clear timeout on normal completion
process.on('exit', () => clearTimeout(timeout));
```

## State Directory

- Production: `~/.specflow/workflows/`
- Files: `{execution-id}.json`
- Created on first use via `fs.mkdirSync(path, { recursive: true })`
