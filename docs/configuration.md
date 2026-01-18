# Configuration

SpecFlow configuration and state management.

## State File

SpecFlow uses `.specify/orchestration-state.json` to track project state.

### v2.0 Schema

```json
{
  "schema_version": "2.0",
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
| `schema_version` | Schema version (currently "2.0") |
| `project.id` | UUID for registry tracking |
| `project.name` | Project name |
| `project.path` | Absolute path to project |
| `orchestration.phase` | Current phase info |
| `orchestration.step` | Current workflow step |
| `health.status` | Health status (healthy, warning, error) |

### State Operations

```bash
specflow state get                    # Show full state
specflow state get orchestration      # Get section
specflow state set "phase.number=0020"  # Set value
specflow state init                   # Initialize (generates UUID)
specflow state reset                  # Reset to defaults
specflow state validate               # Validate structure
```

### Filesystem-Derived State

The `specflow status` command derives progress from filesystem artifacts:

- **Step detection**: Determined by which files exist (spec.md → plan.md → tasks.md → checklists/)
- **Task counts**: Parsed directly from tasks.md checkbox status
- **Source of truth**: Filesystem artifacts take precedence over state file if ahead

This means orchestration can recover automatically if the state file is outdated.

## Central Registry

Projects are registered in `~/.specflow/registry.json` for web UI discovery.

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
specflow state registry list          # List registered projects
specflow state registry sync          # Sync current project
specflow state registry clean         # Remove stale entries
```

## Version Manifest

Optional `manifest.json` for version tracking:

```bash
specflow manifest init                # Create manifest
specflow manifest status              # Show version status
specflow manifest validate            # Check compatibility
specflow manifest upgrade             # Apply upgrades
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPECFLOW_HOME` | System install location | `~/.claude/specflow-system` |
| `SPECFLOW_REGISTRY` | Registry location | `~/.specflow/registry.json` |
| `SPECFLOW_DEBUG` | Enable debug output | `false` |

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

Override detection:
```bash
specflow scaffold --type python
```

## Migrating from v1.x

If you have an existing v1.x project:

```bash
specflow state migrate
```

This will:
1. Backup current state to `.specify/archive/`
2. Generate project UUID
3. Convert to v2.0 schema
4. Register in `~/.specflow/registry.json`

In-progress interviews continue seamlessly.

## ROADMAP Phase Formats

### v2.0 Format (3-digit)

```markdown
### Phase 001: Feature Name
```

### v2.1 Format (4-digit)

```markdown
### Phase 0010: Feature Name
```

Migrate:
```bash
specflow migrate roadmap
```

## File Locations Summary

### Project Root

| Path | Purpose | Required |
|------|---------|----------|
| `ROADMAP.md` | Development phases and status | Yes |
| `CLAUDE.md` | Claude Code project instructions | Recommended |
| `README.md` | Project documentation | Optional |
| `CHANGELOG.md` | Version changelog | Optional |

### State & Configuration (`.specify/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/orchestration-state.json` | Project state (v2.0 schema with UUID) | Yes |
| `.specify/manifest.json` | Version tracking and compatibility | Recommended |

### Discovery (`.specify/discovery/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/discovery/context.md` | Project identity and constraints | Created by interview |
| `.specify/discovery/state.md` | Interview session progress | Created by interview |
| `.specify/discovery/decisions.md` | Requirements decisions log | Created by interview |

### Memory Documents (`.specify/memory/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/memory/constitution.md` | Project principles and governance | **Yes** |
| `.specify/memory/tech-stack.md` | Approved technologies | Recommended |
| `.specify/memory/coding-standards.md` | Code style and patterns | Recommended |
| `.specify/memory/api-standards.md` | API design patterns | Recommended |
| `.specify/memory/security-checklist.md` | Security requirements | Recommended |
| `.specify/memory/testing-strategy.md` | Test approach and coverage | Recommended |
| `.specify/memory/glossary.md` | Project terminology | Optional |
| `.specify/memory/adrs/` | Architecture Decision Records | Optional |
| `.specify/memory/pdrs/` | Product Design Requirements | Optional |

### Phase Management (`.specify/phases/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/phases/` | Individual phase detail files | Auto-created |
| `.specify/phases/[NNNN]-[name].md` | Phase detail (scope, tasks, notes) | Per phase |
| `.specify/phases/[NNNN]-handoff.md` | Phase handoff for deferred items | As needed |

### History & Archives

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/history/` | Completed phases archive | Auto-created |
| `.specify/history/HISTORY.md` | Archived phase details | Auto-created |
| `.specify/archive/` | General archive directory | Auto-created |

### Issue Tracking (`.specify/issues/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/issues/` | Local issue tracking | Auto-created |
| `.specify/issues/index.json` | Issue index and metadata | Auto-created |

### Templates (`.specify/templates/`)

| Path | Purpose | Required |
|------|---------|----------|
| `.specify/templates/` | Project-specific template overrides | Optional |

> **Note**: Templates are optional at project level. Central templates at `~/.claude/specflow-system/templates/` are used if project templates don't exist.

### Specifications (`specs/`)

| Path | Purpose | Required |
|------|---------|----------|
| `specs/` | Feature specifications root | Yes |
| `specs/[NNNN]-[feature]/` | Feature directory (4-digit ABBC format) | Per feature |
| `specs/[NNNN]-[feature]/spec.md` | Feature specification | Yes |
| `specs/[NNNN]-[feature]/plan.md` | Implementation plan | Yes |
| `specs/[NNNN]-[feature]/tasks.md` | Task breakdown and tracking | Yes |
| `specs/[NNNN]-[feature]/checklist.md` | Feature verification checklist | Optional |
| `specs/[NNNN]-[feature]/review.md` | Code review findings | Optional |
| `specs/[NNNN]-[feature]/lessons-learned.md` | Retrospective notes | Optional |
| `specs/[NNNN]-[feature]/checklists/deferred.md` | Deferred items | As needed |
| `specs/[NNNN]-[feature]/ui/design.md` | UI design document | If applicable |
| `specs/[NNNN]-[feature]/adrs/` | Feature-specific ADRs | Optional |

### Central Installation (User Home)

| Path | Purpose |
|------|---------|
| `~/.claude/specflow-system/` | SpecFlow system installation |
| `~/.claude/specflow-system/bin/specflow` | CLI dispatcher |
| `~/.claude/specflow-system/scripts/bash/` | Implementation scripts |
| `~/.claude/specflow-system/scripts/bash/lib/` | Shared libraries |
| `~/.claude/specflow-system/templates/` | Central templates |
| `~/.claude/commands/specflow.*.md` | Slash commands |
| `~/.specflow/registry.json` | Central project registry |

### State Config Paths

These paths are stored in `.specify/orchestration-state.json` under `config`:

| Key | Default | Purpose |
|-----|---------|---------|
| `config.roadmap_path` | `ROADMAP.md` | ROADMAP location |
| `config.memory_path` | `.specify/memory/` | Memory docs location |
| `config.specs_path` | `specs/` | Specs location |
| `config.scripts_path` | `~/.claude/specflow-system/scripts/` | Scripts location (central) |
| `config.templates_path` | `.specify/templates/` | Templates location |

### Default Scaffold Structure

Running `specflow scaffold` creates:

```
project-root/
├── .specify/
│   ├── orchestration-state.json
│   ├── discovery/
│   │   ├── context.md
│   │   ├── state.md
│   │   └── decisions.md
│   ├── memory/
│   │   ├── constitution.md
│   │   ├── tech-stack.md
│   │   ├── adrs/
│   │   └── pdrs/
│   ├── templates/          (optional, for overrides)
│   ├── phases/
│   ├── history/
│   ├── issues/
│   └── archive/
├── specs/
├── ROADMAP.md
└── CLAUDE.md               (if not present)
```
