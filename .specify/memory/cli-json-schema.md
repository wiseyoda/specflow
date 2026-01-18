# CLI JSON Output Schema

All SpecFlow CLI commands support a `--json` flag for machine-readable output. This document defines the output structure for each command.

## Global Conventions

- **Status field**: All outputs include `status: 'success' | 'error' | 'warning'`
- **Command field**: Identifies which command produced the output
- **Error format**: When `status: 'error'`, an `error` object is included with `message` and `hint`

```typescript
// Common error structure
interface ErrorInfo {
  message: string;
  hint: string;
}
```

---

## Core Commands

### `specflow status --json`

Complete project status snapshot.

```typescript
interface StatusOutput {
  status: 'success' | 'error';
  command: 'status';
  project: {
    name: string;
    path: string;
    id: string;
  };
  health: {
    status: 'healthy' | 'degraded' | 'initializing';
    issues: string[];
  };
  phase: {
    number: string | null;
    name: string | null;
    branch: string | null;
    status: 'in_progress' | 'complete' | 'not_started';
  };
  orchestration: {
    step: {
      current: string;
      index: number;
      status: string;
    };
  };
  artifacts: {
    discovery: boolean;
    spec: boolean;
    plan: boolean;
    tasks: boolean;
    checklists: boolean;
  };
  error?: ErrorInfo;
}
```

### `specflow next --json`

Returns the next actionable task with context.

```typescript
// When there's a task to do
interface NextTaskOutput {
  status: 'success' | 'error';
  command: 'next';
  type: 'task';
  task: {
    id: string;
    description: string;
    phase: number;
    userStory?: string;
    parallelizable: boolean;
    blocked?: string;
  };
  context: {
    phase: string;
    step: string;
    progress: {
      completed: number;
      total: number;
      percentage: number;
    };
  };
  error?: ErrorInfo;
}

// When in verify step
interface NextVerifyOutput {
  status: 'success' | 'error';
  command: 'next';
  type: 'verify';
  checklist: 'implementation' | 'verification';
  item: {
    id: string;
    description: string;
  };
  context: { /* same as above */ };
  error?: ErrorInfo;
}

// When no tasks remain
interface NextNoneOutput {
  status: 'success' | 'error';
  command: 'next';
  type: 'none';
  message: string;
  context: { /* same as above */ };
  error?: ErrorInfo;
}
```

### `specflow mark <items> --json`

Marks tasks or checklist items as complete/incomplete/blocked.

```typescript
interface MarkOutput {
  status: 'success' | 'error';
  command: 'mark';
  items: Array<{
    id: string;
    status: 'complete' | 'incomplete' | 'blocked';
    type: 'task' | 'implementation' | 'verification';
    blockedReason?: string;
  }>;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  error?: ErrorInfo;
}
```

### `specflow check --json`

Validates project artifacts and health.

```typescript
interface CheckOutput {
  status: 'success' | 'error' | 'warning';
  command: 'check';
  gate?: 'design' | 'implement' | 'verify' | 'memory';
  valid: boolean;
  issues: Array<{
    type: 'error' | 'warning';
    category: string;
    message: string;
    file?: string;
    line?: number;
    fixable: boolean;
  }>;
  fixed?: number;
  error?: ErrorInfo;
}
```

---

## State Commands

### `specflow state init --json`

Initializes a new project state file.

```typescript
interface StateInitOutput {
  status: 'success' | 'error';
  command: 'state init';
  project: {
    id: string;
    name: string;
    path: string;
  };
  statePath: string;
  registered: boolean;
  overwritten: boolean;
  error?: ErrorInfo;
}
```

**Example:**
```json
{
  "status": "success",
  "command": "state init",
  "project": {
    "id": "d6c99af0-0bcc-482d-9fc0-e10452c4c746",
    "name": "my-project",
    "path": "/Users/dev/my-project"
  },
  "statePath": "/Users/dev/my-project/.specify/orchestration-state.json",
  "registered": true,
  "overwritten": false
}
```

### `specflow state set <keyvalues> --json`

Sets one or more values in state.

```typescript
interface StateSetOutput {
  status: 'success' | 'error';
  command: 'state set';
  updates: Array<{
    key: string;
    value: unknown;
    previousValue?: unknown;
  }>;
  error?: ErrorInfo;
}
```

**Example:**
```json
{
  "status": "success",
  "command": "state set",
  "updates": [
    {
      "key": "orchestration.step.current",
      "value": "implement",
      "previousValue": "design"
    }
  ]
}
```

### `specflow state sync --json`

Syncs state with filesystem.

```typescript
interface StateSyncOutput {
  status: 'success' | 'warning' | 'error';
  command: 'state sync';
  dryRun: boolean;
  changes: Array<{
    type: 'registered' | 'history_added' | 'phase_synced';
    description: string;
    details?: unknown;
  }>;
  warnings: string[];
  error?: ErrorInfo;
}
```

**Example:**
```json
{
  "status": "warning",
  "command": "state sync",
  "dryRun": false,
  "changes": [
    {
      "type": "history_added",
      "description": "Added: 0042 - api-integration",
      "details": { "phaseNumber": "0042", "phaseName": "api-integration" }
    }
  ],
  "warnings": ["ROADMAP.md not found"]
}
```

---

## Phase Commands

### `specflow phase --json` / `specflow phase status --json`

Current phase status.

```typescript
interface PhaseStatusOutput {
  status: 'success' | 'error';
  command: 'phase status';
  phase: {
    number: string | null;
    name: string | null;
    branch: string | null;
    status: 'in_progress' | 'complete' | 'not_started';
    dir: string | null;
  };
  error?: ErrorInfo;
}
```

### `specflow phase open <number> --json`

Opens a phase for development.

```typescript
interface PhaseOpenOutput {
  status: 'success' | 'error';
  command: 'phase open';
  phase: {
    number: string;
    name: string;
    branch: string;
    dir: string;
  };
  gitBranch: {
    created: boolean;
    checkedOut: boolean;
  };
  error?: ErrorInfo;
}
```

### `specflow phase close --json`

Closes the current phase.

```typescript
interface PhaseCloseOutput {
  status: 'success' | 'error';
  command: 'phase close';
  phase: {
    number: string;
    name: string;
  };
  actions: {
    roadmapUpdated: boolean;
    specsArchived: boolean;
    historyUpdated: boolean;
    branchName: string;
  };
  taskSummary?: {
    completed: number;
    total: number;
    incomplete: string[];
  };
  dryRun: boolean;
  error?: ErrorInfo;
}
```

### `specflow phase add <number> <name> --json`

Adds a phase to the roadmap.

```typescript
interface AddOutput {
  status: 'success' | 'error';
  command: 'phase add';
  phase: {
    number: string;
    name: string;
    userGate: boolean;
    gateDescription?: string;
  };
  error?: ErrorInfo;
}
```

### `specflow phase defer <items> --json`

Adds items to BACKLOG.md.

```typescript
interface PhaseDeferOutput {
  status: 'success' | 'error';
  command: 'phase defer';
  items: string[];
  backlogPath: string;
  error?: ErrorInfo;
}
```

### `specflow phase archive <number> --json`

Archives a completed phase.

```typescript
interface PhaseArchiveOutput {
  status: 'success' | 'error';
  command: 'phase archive';
  phase: {
    number: string;
    name: string;
  };
  archivePath: string;
  filesArchived: string[];
  dryRun: boolean;
  error?: ErrorInfo;
}
```

### `specflow phase scan --json`

Scans archives for incomplete tasks.

```typescript
interface ArchiveScanOutput {
  status: 'success' | 'error';
  command: 'phase scan';
  phases: Array<{
    number: string;
    name: string;
    incompleteTasks: Array<{
      id: string;
      description: string;
      blocked?: string;
    }>;
  }>;
  summary: {
    phasesScanned: number;
    phasesWithIncompleteTasks: number;
    totalIncompleteTasks: number;
  };
  suggestedBacklog?: string[];
  error?: ErrorInfo;
}
```

---

## Utility Commands

### `specflow upgrade --json`

Upgrades SpecFlow installation.

```typescript
interface UpgradeOutput {
  status: 'success' | 'error';
  command: 'upgrade';
  currentVersion: string;
  latestVersion: string;
  upgraded: boolean;
  changes?: string[];
  error?: ErrorInfo;
}
```

---

## Usage with jq

All commands are designed for easy parsing with jq:

```bash
# Get phase number
specflow status --json | jq -r '.phase.number'

# List incomplete tasks
specflow phase scan --json | jq '.phases[].incompleteTasks[].id'

# Check if state sync had changes
specflow state sync --json | jq '.changes | length > 0'

# Extract error message
specflow state init --json | jq -r 'if .status == "error" then .error.message else empty end'
```

---

## Version History

- **v3.0.0**: Added `--json` support to `state set`, `state init`, `state sync`
- **v3.0.0**: All 17 commands now support `--json` output
