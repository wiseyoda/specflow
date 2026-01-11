# SpecKit Development Handoff

> This document provides context for the Claude instance continuing development on SpecKit.

## Project Overview

**SpecKit** is a spec-driven development framework for Claude Code. It provides:
- Claude Code commands (`/speckit.*`) for structured development workflows
- Bash CLI (`speckit`) for automated operations
- Templates for specifications, plans, tasks, etc.
- State management for workflow orchestration

## Current State

### Completed (Phase 1)
- ✅ Core CLI infrastructure created:
  - `bin/speckit` - Main CLI wrapper
  - `scripts/bash/lib/common.sh` - Shared functions (colors, logging, paths)
  - `scripts/bash/lib/json.sh` - jq-based JSON operations
  - `scripts/bash/speckit-state.sh` - State CRUD operations
  - `scripts/bash/speckit-scaffold.sh` - Project scaffolding
- ✅ Install script (`install.sh`) with upgrade/uninstall support
- ✅ All existing commands copied from `~/.claude/commands/`
- ✅ Templates copied from user-scope

### In Progress (Phase 2-7)
See `IMPROVEMENT-PLAN.md` for detailed task breakdown. Key remaining work:

**Phase 2: Git & Status Scripts**
- `speckit-git.sh` - branch, commit, merge, push, sync
- `speckit-roadmap.sh` - ROADMAP.md status updates
- `speckit-claude-md.sh` - CLAUDE.md Recent Changes updates

**Phase 3: Checklist & Task Scripts**
- `speckit-checklist.sh` - Checklist status/completion
- `speckit-tasks.sh` - Task counting/marking

**Phase 4: Doctor & Templates**
- `speckit-doctor.sh` - Diagnostics and auto-fix
- `speckit-templates.sh` - Version checking and updates

**Phase 5: Command Refactoring**
- Update all `speckit.*.md` commands to use bash scripts
- Consolidate `speckit.init-*` sub-commands to arguments
- Unify state file format (v1.0 → v2.0)

**Phase 6: Smart Entry Point**
- Create `speckit.start.md` - Auto-detect state and route

**Phase 7: Cleanup & Documentation**
- Remove deprecated commands
- Complete documentation

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sub-commands | Consolidate to args | `speckit.init status` vs `speckit.init-status` |
| Specs location | Keep at root (`specs/`) | Visible, configurable via state |
| Entry point | Add `speckit.start` | Smart router, single command |
| Templates | Copy + version check | Suggest updates, don't force |
| State files | Unify to single JSON | Simpler, machine-parseable |
| Config loading | Load first in all commands | Consistent path handling |
| CLAUDE.md | Auto-update on completion | Fresh context for Claude |
| Diagnostics | Add `speckit.doctor` | Self-healing capabilities |
| Scripting | Full bash automation | Faster, deterministic |
| CLI | Unified `speckit` wrapper | Consistent interface |

## Architecture

```
claude-speckit-orchestration/
├── bin/
│   └── speckit                    # Main CLI (dispatches to scripts)
├── scripts/bash/
│   ├── lib/
│   │   ├── common.sh              # Shared: colors, logging, paths
│   │   └── json.sh                # jq-based JSON operations
│   ├── speckit-state.sh           # ✅ State CRUD
│   ├── speckit-scaffold.sh        # ✅ Project scaffolding
│   ├── speckit-git.sh             # TODO: Git operations
│   ├── speckit-roadmap.sh         # TODO: ROADMAP.md ops
│   ├── speckit-claude-md.sh       # TODO: CLAUDE.md ops
│   ├── speckit-checklist.sh       # TODO: Checklist ops
│   ├── speckit-tasks.sh           # TODO: Task ops
│   ├── speckit-templates.sh       # TODO: Template versioning
│   ├── speckit-doctor.sh          # TODO: Diagnostics
│   └── check-prerequisites.sh     # Existing prereqs check
├── commands/
│   └── speckit.*.md               # Claude Code commands
├── templates/
│   └── *.md, *.yaml               # Document templates
├── install.sh                     # Installation script
├── VERSION                        # Version file (1.0.0)
├── IMPROVEMENT-PLAN.md            # Detailed task breakdown
└── README.md                      # User documentation
```

## State File Schema (v2.0 Target)

```json
{
  "version": "2.0",
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
  },
  "project": { "name": null, "description": null },
  "interview": { "status": "not_started", "current_phase": 0, ... },
  "orchestration": { "phase_number": null, "step": null, "steps": {...} },
  "history": [],
  "last_updated": null
}
```

Note: Existing projects may have v1.0 format with config in `.project` instead of `.config`.

## Testing Commands

```bash
# Test CLI
./bin/speckit help
./bin/speckit version
./bin/speckit state --help
./bin/speckit scaffold --help

# In a test project directory:
./bin/speckit scaffold --status
./bin/speckit state init
./bin/speckit state get
./bin/speckit state validate
```

## Development Guidelines

1. **Scripts should be POSIX-compliant bash** for portability
2. **Use jq for JSON** - check availability, suggest install if missing
3. **Scripts should have `--help` and `--json` output options**
4. **Error messages should be actionable**
5. **Exit codes**: 0=success, 1=error, 2=warning
6. **Guard against double-sourcing** in library files
7. **Use `find` with `-print0` for safe file iteration**

## Important Files to Read

1. `IMPROVEMENT-PLAN.md` - Full task breakdown with checkboxes
2. `scripts/bash/lib/common.sh` - Understand available utilities
3. `scripts/bash/speckit-state.sh` - Reference implementation
4. `commands/speckit.orchestrate.md` - Main workflow command

## Next Steps

1. Continue with **Phase 2** - Git & Status Scripts
2. Create `speckit-git.sh` first (most commonly needed)
3. Test each script before moving to next
4. Update `IMPROVEMENT-PLAN.md` as tasks complete

## Context from Previous Session

The user (ppatterson) is building SpecKit to improve their development workflow with Claude Code. They're actively using it on a project called "story-sprout" (an AI-powered children's storybook app). The improvements being made here will be deployed back to their local `~/.claude/` directory via the install script.

Key user preferences:
- Prefers bash scripts over having Claude do repetitive operations
- Wants version checking for templates (suggest updates, don't force)
- Values clear documentation and consistent interfaces
- Uses pnpm, Vitest, TypeScript strict mode (see their global CLAUDE.md)
