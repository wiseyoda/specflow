# Configuration

SpecKit configuration and state management.

## State File

SpecKit uses `.specify/orchestration-state.json` to track project state.

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
speckit state get                    # Show full state
speckit state get orchestration      # Get section
speckit state set "phase.number=0020"  # Set value
speckit state init                   # Initialize (generates UUID)
speckit state reset                  # Reset to defaults
speckit state validate               # Validate structure
```

## Central Registry

Projects are registered in `~/.speckit/registry.json` for web UI discovery.

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
speckit state registry list          # List registered projects
speckit state registry sync          # Sync current project
speckit state registry clean         # Remove stale entries
```

## Version Manifest

Optional `manifest.json` for version tracking:

```bash
speckit manifest init                # Create manifest
speckit manifest status              # Show version status
speckit manifest validate            # Check compatibility
speckit manifest upgrade             # Apply upgrades
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPECKIT_HOME` | System install location | `~/.claude/speckit-system` |
| `SPECKIT_REGISTRY` | Registry location | `~/.speckit/registry.json` |
| `SPECKIT_DEBUG` | Enable debug output | `false` |

## Project Detection

SpecKit auto-detects project type from files:

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
speckit scaffold --type python
```

## Migrating from v1.x

If you have an existing v1.x project:

```bash
speckit state migrate
```

This will:
1. Backup current state to `.specify/archive/`
2. Generate project UUID
3. Convert to v2.0 schema
4. Register in `~/.speckit/registry.json`

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
speckit migrate roadmap
```

## File Locations Summary

| File | Purpose |
|------|---------|
| `.specify/orchestration-state.json` | Project state |
| `.specify/discovery/` | Interview artifacts |
| `.specify/memory/` | Memory documents |
| `.specify/phases/` | Phase detail files |
| `.specify/issues/` | Local issue tracking |
| `.specify/templates/` | Project template overrides |
| `~/.speckit/registry.json` | Central project registry |
| `~/.claude/speckit-system/` | System installation |
