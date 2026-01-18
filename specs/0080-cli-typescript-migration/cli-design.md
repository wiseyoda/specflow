# CLI Design: Smart Commands Architecture

> 5 commands that return exactly what Claude needs - rich, contextual data from single calls

## Design Principles

1. **Rich responses**: Each command returns everything Claude needs to continue work
2. **Minimize calls**: One smart call replaces 5-10 granular calls
3. **Aggregate data**: CLI parses files, Claude gets structured JSON
4. **Actionable output**: Commands suggest next actions, not just raw data
5. **Token efficient**: Claude doesn't read entire files, just command output

---

## The 5 Commands

| Command | Purpose | Replaces |
|---------|---------|----------|
| `specflow status` | Complete current state | state, roadmap, tasks status, context, doctor |
| `specflow next` | Next actionable item with context | tasks list, phase show, dependency analysis |
| `specflow mark <id>` | Mark complete + return new state | tasks mark + status |
| `specflow check` | Deep validation with fixes | doctor, gate, checklist |
| `specflow state` | Low-level state access | Escape hatch for edge cases |

---

## Command Specifications

### 1. `specflow status`

**Purpose**: Everything Claude needs to orient and decide what to do.

**Usage**:
```bash
specflow status              # Human-readable
specflow status --json       # Structured for Claude
```

**Output**:
```json
{
  "phase": {
    "number": "0076",
    "name": "CLI TypeScript Migration",
    "branch": "0076-cli-typescript-migration",
    "status": "in_progress",
    "has_user_gate": false
  },
  "step": {
    "current": "implement",
    "index": 2,
    "status": "in_progress"
  },
  "progress": {
    "tasks_completed": 5,
    "tasks_total": 12,
    "tasks_blocked": 0,
    "percentage": 42
  },
  "health": {
    "status": "ready",
    "issues": []
  },
  "next_action": "continue_implement",
  "blockers": [],
  "context": {
    "feature_dir": "specs/0076-cli-typescript-migration",
    "has_spec": true,
    "has_plan": true,
    "has_tasks": true
  }
}
```

**Data Sources**:
- `.specify/orchestration-state.json` - phase, step, health
- `ROADMAP.md` - phase metadata, user gate status
- `specs/<phase>/tasks.md` - progress counts
- Filesystem - context/artifact existence

**Next Action Values**:
- `start_phase` - No phase active, need to start one
- `run_design` - Phase started but no design artifacts
- `run_analyze` - Design done, need analysis
- `continue_implement` - In implementation, tasks remaining
- `run_verify` - All tasks done, need verification
- `ready_to_merge` - Verified, ready for merge
- `fix_health` - Health issues need attention
- `awaiting_user_gate` - Waiting for user approval

---

### 2. `specflow next`

**Purpose**: What to do right now, with full context to do it.

**Usage**:
```bash
specflow next                # Human-readable
specflow next --json         # Structured for Claude
specflow next --type task    # Only tasks (default)
specflow next --type verify  # Verification items
```

**Output (during implement)**:
```json
{
  "action": "implement_task",
  "task": {
    "id": "T006",
    "description": "Add error handling to API endpoints",
    "section": "User Stories",
    "phase": "US2",
    "line": 45,
    "file": "specs/0076-cli-typescript-migration/tasks.md"
  },
  "dependencies": {
    "met": true,
    "requires": ["T003", "T004"],
    "blocked_by": []
  },
  "hints": {
    "files_mentioned": ["src/api/handlers.ts", "src/lib/errors.ts"],
    "related_spec_section": "## Error Handling"
  },
  "queue": {
    "remaining_in_section": 2,
    "total_remaining": 7,
    "next_up": ["T007", "T008"]
  }
}
```

**Output (during verify)**:
```json
{
  "action": "verify_checklist",
  "item": {
    "id": "V-001",
    "description": "All API endpoints return proper error codes",
    "checklist": "verification",
    "line": 12,
    "file": "specs/0076-cli-typescript-migration/checklists/verification.md"
  },
  "queue": {
    "remaining": 5,
    "next_up": ["V-002", "V-003"]
  }
}
```

**Output (nothing to do)**:
```json
{
  "action": "none",
  "reason": "all_tasks_complete",
  "suggestion": "Run 'specflow check' to verify completion, then proceed to verification step"
}
```

**Data Sources**:
- `specs/<phase>/tasks.md` - Task list and status
- `specs/<phase>/checklists/*.md` - Verification items
- `specs/<phase>/spec.md` - For hints/context
- `.specify/orchestration-state.json` - Current step

---

### 3. `specflow mark <id>`

**Purpose**: Mark item complete and return updated state (no follow-up call needed).

**Usage**:
```bash
specflow mark T006                    # Mark single task
specflow mark T006 T007 T008          # Mark multiple
specflow mark T006..T010              # Mark range
specflow mark V-001                   # Mark verification item
specflow mark T006 --incomplete       # Unmark
specflow mark T006 --blocked "reason" # Mark blocked
```

**Output**:
```json
{
  "marked": ["T006"],
  "new_status": "complete",
  "progress": {
    "tasks_completed": 6,
    "tasks_total": 12,
    "percentage": 50
  },
  "section_status": {
    "name": "User Stories",
    "completed": 4,
    "total": 6,
    "is_complete": false
  },
  "next": {
    "id": "T007",
    "description": "Add validation middleware",
    "dependencies_met": true
  },
  "step_complete": false
}
```

**When step completes**:
```json
{
  "marked": ["T012"],
  "new_status": "complete",
  "progress": {
    "tasks_completed": 12,
    "tasks_total": 12,
    "percentage": 100
  },
  "step_complete": true,
  "next_action": "run_verify",
  "message": "All tasks complete! Ready for verification."
}
```

**Data Sources**:
- `specs/<phase>/tasks.md` - Read and update
- `specs/<phase>/checklists/*.md` - For verification items
- `.specify/orchestration-state.json` - Update progress

---

### 4. `specflow check`

**Purpose**: Deep validation with actionable fixes.

**Usage**:
```bash
specflow check                # Full validation
specflow check --json         # Structured output
specflow check --fix          # Auto-fix what's possible
specflow check --gate design  # Check specific gate
```

**Output**:
```json
{
  "passed": false,
  "summary": {
    "errors": 2,
    "warnings": 1,
    "info": 3
  },
  "gates": {
    "design": {
      "passed": true,
      "checks": ["spec_exists", "plan_exists", "tasks_exist"]
    },
    "implement": {
      "passed": false,
      "reason": "3 tasks incomplete",
      "checks": {
        "tasks_complete": false,
        "no_blocked_tasks": true
      }
    },
    "verify": {
      "passed": false,
      "reason": "implementation gate not passed",
      "checks": {
        "implementation_gate": false,
        "checklists_complete": false
      }
    }
  },
  "issues": [
    {
      "severity": "error",
      "code": "TASKS_INCOMPLETE",
      "message": "3 tasks still pending: T010, T011, T012",
      "fix": "Complete remaining tasks or mark as deferred",
      "auto_fixable": false
    },
    {
      "severity": "error",
      "code": "CHECKLIST_INCOMPLETE",
      "message": "Verification checklist has 5 unchecked items",
      "fix": "Complete verification checklist",
      "auto_fixable": false
    },
    {
      "severity": "warning",
      "code": "STATE_DRIFT",
      "message": "State shows step=design but artifacts suggest implement",
      "fix": "Run: specflow state set orchestration.step.current=implement",
      "auto_fixable": true
    }
  ],
  "auto_fixable_count": 1,
  "suggested_action": "complete_tasks"
}
```

**With --fix**:
```json
{
  "passed": false,
  "fixed": [
    {
      "code": "STATE_DRIFT",
      "action": "Updated orchestration.step.current to 'implement'"
    }
  ],
  "remaining_issues": [
    {
      "severity": "error",
      "code": "TASKS_INCOMPLETE",
      "message": "3 tasks still pending"
    }
  ]
}
```

**Data Sources**:
- All project files for comprehensive validation
- `.specify/orchestration-state.json`
- `ROADMAP.md`
- `specs/<phase>/*.md`

---

### 5. `specflow state`

**Purpose**: Low-level state access for edge cases.

**Usage**:
```bash
specflow state get <key>              # Get by dot-path
specflow state get orchestration      # Get subtree
specflow state get --json             # Full state as JSON
specflow state set <key>=<value>      # Set value
specflow state show                   # Human-readable summary
specflow state init                   # Initialize new project
specflow state reset --confirm        # Reset state
```

**This is the escape hatch** - use when the smart commands don't cover an edge case.

---

## CLI Call Reduction

### Before (Bash - typical orchestrate flow):
```bash
specflow state get orchestration.phase.number    # What phase?
specflow state get orchestration.step.current    # What step?
specflow roadmap status                          # Phase details
specflow tasks status --json                     # Task progress
specflow doctor                                  # Health check
specflow context                                 # Feature context
# ... 6 calls just to orient
```

### After (Smart Commands):
```bash
specflow status --json
# One call, all the context
```

### Typical Workflow Call Counts

| Workflow Step | Before (Bash) | After (Smart) |
|---------------|---------------|---------------|
| Orient/Resume | 6-8 calls | 1 call |
| Get next task | 3-4 calls | 1 call |
| Mark task done | 2 calls | 1 call |
| Check completion | 4-5 calls | 1 call |
| **Full phase** | **50-100 calls** | **10-15 calls** |

---

## File Structure

```
packages/cli/src/
├── index.ts                    # CLI entry
├── commands/
│   ├── status.ts              # specflow status
│   ├── next.ts                # specflow next
│   ├── mark.ts                # specflow mark
│   ├── check.ts               # specflow check
│   └── state/                 # specflow state (subcommands)
│       ├── index.ts
│       ├── get.ts
│       ├── set.ts
│       └── init.ts
├── lib/
│   ├── state.ts               # State file operations
│   ├── tasks.ts               # Task parsing
│   ├── roadmap.ts             # ROADMAP parsing
│   ├── checklist.ts           # Checklist parsing
│   ├── context.ts             # Project context resolution
│   ├── health.ts              # Health checks
│   ├── output.ts              # Output formatting
│   ├── errors.ts              # Error handling
│   └── paths.ts               # Path resolution
└── types/
    └── index.ts               # Shared types
```

---

## Implementation Priority

1. **`status`** - Foundation, most frequently called
2. **`next`** - Core workflow driver
3. **`mark`** - Task completion with state updates
4. **`check`** - Validation and health
5. **`state`** - Already implemented, just refine

---

## Success Metrics

| Metric | Old (24 Bash) | New (5 Smart) |
|--------|---------------|---------------|
| Commands | 24 | 5 |
| Lines of code | ~18,000 | ~2,000-3,000 |
| CLI calls per phase | 50-100 | 10-15 |
| Token usage per call | Variable | Predictable |
| Data redundancy | High | None |
