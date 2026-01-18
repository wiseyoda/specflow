# Configuration

SpecFlow configuration and state management.

## State File

SpecFlow uses `.specify/orchestration-state.json` to track project state.

### v3.0 Schema

```json
{
  "schema_version": "3.0",
  "project": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "my-project",
    "path": "/absolute/path/to/project",
    "created_at": "2026-01-11T12:00:00Z"
  },
  "orchestration": {
    "phase": {
      "number": "0010",
      "name": "feature-name",
      "status": "in_progress"
    },
    "step": {
      "current": "implement",
      "index": 4
    }
  },
  "health": {
    "status": "healthy",
    "last_check": "2026-01-11T12:00:00Z"
  },
  "actions": []
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `schema_version` | Schema version (currently "3.0") |
| `project.id` | UUID for registry tracking |
| `project.name` | Project name |
| `project.path` | Absolute path to project |
| `orchestration.phase` | Current phase info |
| `orchestration.step` | Current workflow step |
| `health.status` | Health status (healthy, warning, error) |

### State Operations

```bash
specflow state                        # Show full state
specflow state show                   # Show full state
specflow state get                    # Show full state
specflow state get orchestration      # Get section
specflow state get orchestration.phase.number  # Get specific value
specflow state set "phase.number=0020"  # Set value
specflow state init                   # Initialize (generates UUID)
specflow state sync                   # Sync with central registry
```

### Filesystem-Derived State

The `specflow status` command derives progress from filesystem artifacts:

- **Step detection**: Determined by which files exist (spec.md → plan.md → tasks.md → checklists/)
- **Task counts**: Parsed directly from tasks.md checkbox status
- **Source of truth**: Filesystem artifacts take precedence over state file if ahead

This means orchestration can recover automatically if the state file is outdated.

## Central Registry

Projects are registered in `~/.specflow/registry.json` for discovery.

```json
{
  "projects": [
    {
      "id": "a1b2c3d4-...",
      "name": "my-project",
      "path": "/path/to/project",
      "last_accessed": "2026-01-11T12:00:00Z"
    }
  ]
}
```

### Registry Operations

```bash
specflow state sync                   # Sync current project to registry
```

## Project Detection

SpecFlow auto-detects project type from files:

| File | Detected Type |
|------|---------------|
| `tsconfig.json` | TypeScript |
| `package.json` | JavaScript |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pyproject.toml` | Python |
| `*.sh` files | Bash |
| None | Generic |

The project type affects:
- Default testing framework in templates
- Code style recommendations
- Build/lint command suggestions

## ROADMAP Phase Formats

### v3.0 Format (4-digit)

```markdown
### Phase 0010: Feature Name
**Status:** pending
**Branch:** `0010-feature-name`
```

### Legacy Format (3-digit)

Older projects may use 3-digit phase numbers:

```markdown
### Phase 001: Feature Name
```

The CLI handles both formats automatically.

## File Locations Summary

### Project Root

| Path | Purpose | Required |
|------|---------|----------|
| `ROADMAP.md` | Development phases and status | Yes |
| `BACKLOG.md` | Deferred items | Auto-created |
| `CLAUDE.md` | Claude Code project instructions | Recommended |
| `README.md` | Project documentation | Optional |

### State & Configuration (`.specify/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/orchestration-state.json` | Project state (v3.0 schema with UUID) | Yes |

### Discovery (`.specify/discovery/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/discovery/context.md` | Project identity and constraints | Created by `/flow.init` |
| `.specify/discovery/state.md` | Interview session progress | Created by `/flow.init` |
| `.specify/discovery/decisions.md` | Requirements decisions log | Created by `/flow.init` |

### Memory Documents (`.specify/memory/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/memory/constitution.md` | Project principles and governance | **Yes** |
| `.specify/memory/tech-stack.md` | Approved technologies | Recommended |
| `.specify/memory/coding-standards.md` | Code style and patterns | Recommended |
| `.specify/memory/testing-strategy.md` | Test approach and coverage | Recommended |
| `.specify/memory/glossary.md` | Project terminology | Optional |
| `.specify/memory/adrs/` | Architecture Decision Records | Optional |

### Phase Management (`.specify/phases/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/phases/` | Individual phase detail files | Auto-created |
| `.specify/phases/[NNNN]-[name].md` | Phase detail (scope, tasks, notes) | Per phase |

### History & Archives

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/history/` | Completed phases archive | Auto-created |
| `.specify/history/HISTORY.md` | Archived phase details | Auto-created |
| `.specify/archive/` | General archive directory | Auto-created |

### Specifications (`specs/`)

| Path | Purpose | Required |
|------|---------|----------|
| `specs/` | Feature specifications root | Yes |
| `specs/[NNNN]-[feature]/` | Feature directory (4-digit format) | Per feature |
| `specs/[NNNN]-[feature]/discovery.md` | Codebase examination | Yes |
| `specs/[NNNN]-[feature]/spec.md` | Feature specification | Yes |
| `specs/[NNNN]-[feature]/requirements.md` | Requirements checklist | Yes |
| `specs/[NNNN]-[feature]/plan.md` | Implementation plan | Yes |
| `specs/[NNNN]-[feature]/tasks.md` | Task breakdown and tracking | Yes |
| `specs/[NNNN]-[feature]/checklists/` | Verification checklists | Yes |

### Central Installation (User Home)

| Path | Purpose |
|------|---------|
| `~/.claude/commands/flow.*.md` | Slash commands |
| `~/.specflow/registry.json` | Central project registry |
