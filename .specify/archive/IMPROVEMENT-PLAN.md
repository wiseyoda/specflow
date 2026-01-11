# SpecKit Improvement Plan

> Tracking document for SpecKit refactoring and improvements.
> Created: 2025-01-10

## Overview

This plan consolidates improvements to simplify, harden, and standardize the SpecKit workflow. Key themes:

1. **Scripting over prompting** - Move deterministic operations to bash scripts
2. **Unified CLI** - Single `speckit` command for all script operations
3. **Smart routing** - `speckit.start` detects state and routes appropriately
4. **Consistent config** - All commands load config from state file first
5. **Auto-sync** - CLAUDE.md updates automatically on phase completion

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sub-commands | Consolidate to args | `speckit.init status` vs `speckit.init-status` |
| Specs location | Keep at root (`specs/`) | Visible, configurable via state |
| Entry point | Add `speckit.start` | Smart router, single command |
| Templates | Copy + version check script | Suggest updates, don't force |
| State files | Unify to single JSON | Simpler, machine-parseable |
| Config loading | Load first in all commands | Consistent path handling |
| CLAUDE.md | Auto-update on completion | Fresh context for Claude |
| Diagnostics | Add `speckit.doctor` | Self-healing capabilities |
| Scripting | Full bash automation | Faster, deterministic |
| CLI | Unified `speckit` wrapper | Consistent interface |

---

## Target Architecture

```
~/.claude/speckit-system/
├── bin/
│   └── speckit                    # Main CLI wrapper (add to PATH)
├── scripts/
│   └── bash/
│       ├── lib/
│       │   ├── common.sh          # Shared functions (colors, logging)
│       │   └── json.sh            # JSON manipulation helpers
│       ├── speckit-state.sh       # State CRUD operations
│       ├── speckit-git.sh         # Git operations
│       ├── speckit-roadmap.sh     # ROADMAP.md updates
│       ├── speckit-claude-md.sh   # CLAUDE.md updates
│       ├── speckit-checklist.sh   # Checklist status
│       ├── speckit-tasks.sh       # Task counting
│       ├── speckit-templates.sh   # Template versioning
│       ├── speckit-doctor.sh      # Diagnostics
│       ├── speckit-scaffold.sh    # Project scaffolding
│       └── check-prerequisites.sh # Existing (keep)
├── templates/
│   └── (existing templates)
└── QUESTION_CATEGORIES.md
```

### Unified State Schema (v2.0)

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
  "project": {
    "name": null,
    "description": null,
    "type": null,
    "criticality": null
  },
  "interview": {
    "status": "not_started",
    "current_phase": 0,
    "current_question": 0,
    "decisions_count": 0,
    "phases": {
      "0": { "status": "pending", "decisions": 0 },
      "1": { "status": "pending", "decisions": 0 }
    },
    "started_at": null,
    "completed_at": null
  },
  "orchestration": {
    "phase_number": null,
    "phase_name": null,
    "branch": null,
    "step": null,
    "status": "not_started",
    "steps": {
      "specify": { "status": "pending", "completed_at": null, "artifacts": [] },
      "clarify": { "status": "pending", "completed_at": null, "artifacts": [] },
      "plan": { "status": "pending", "completed_at": null, "artifacts": [] },
      "tasks": { "status": "pending", "completed_at": null, "artifacts": [] },
      "analyze": { "status": "pending", "completed_at": null, "artifacts": [] },
      "checklist": { "status": "pending", "completed_at": null, "artifacts": [] },
      "implement": { "status": "pending", "completed_at": null, "tasks_completed": 0, "tasks_total": 0 },
      "verify": { "status": "pending", "completed_at": null, "artifacts": [] }
    }
  },
  "history": [],
  "last_updated": null
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅
> Foundation: CLI wrapper and essential scripts

- [x] Create `bin/` directory structure
- [x] Create `speckit` CLI wrapper script
- [x] Create `lib/common.sh` with shared functions
- [x] Create `lib/json.sh` for JSON manipulation (using jq)
- [x] Create `speckit-state.sh` for state CRUD
- [x] Create `speckit-scaffold.sh` for project structure
- [x] Test CLI wrapper with basic commands
- [x] Document CLI usage (README.md) - Completed in Phase 7

### Phase 2: Git & Status Scripts ✅
> Automate git operations and status tracking

- [x] Create `speckit-git.sh` with operations:
  - [x] `branch create <name>` - Create and checkout branch
  - [x] `branch checkout <name>` - Checkout existing branch
  - [x] `commit <message>` - Stage all and commit
  - [x] `merge <branch>` - Merge branch to current
  - [x] `push` - Push current branch
  - [x] `sync` - Fetch all, show status
- [x] Create `speckit-roadmap.sh` with operations:
  - [x] `status` - Show phase statuses
  - [x] `update <phase> <status>` - Update phase status
  - [x] `next` - Get next pending phase
  - [x] `validate` - Check ROADMAP.md structure
- [x] Create `speckit-claude-md.sh` with operations:
  - [x] `update <phase> <description>` - Add to Recent Changes
  - [x] `sync` - Sync from ROADMAP.md completions
- [x] Test git workflow end-to-end

### Phase 3: Checklist & Task Scripts ✅
> Automate progress tracking

- [x] Create `speckit-checklist.sh` with operations:
  - [x] `status [dir]` - Count completed/total across checklists
  - [x] `list [dir]` - List all checklists with status
  - [x] `incomplete [dir]` - List incomplete items
  - [x] `show <file>` - Show specific checklist status
- [x] Create `speckit-tasks.sh` with operations:
  - [x] `status [file]` - Count completed/total tasks
  - [x] `incomplete [file]` - List incomplete tasks
  - [x] `mark <task_id>` - Mark task complete
  - [x] `phase-status [file]` - Status by phase
  - [x] `list [file]` - List all tasks
  - [x] `find` - Find all tasks.md files
- [x] Integrate with state updates (mark command updates state file)

### Phase 4: Doctor & Templates ✅
> Diagnostics and versioning

- [x] Create `speckit-doctor.sh` with checks:
  - [x] System installation (CLI, scripts, templates)
  - [x] Project structure (.specify/ directories)
  - [x] State file validity (JSON syntax, required sections)
  - [x] Config path existence
  - [x] Git repository status
  - [x] Template versions
  - [x] Auto-fix capabilities (--fix flag)
- [x] Create `speckit-templates.sh` with operations:
  - [x] `check` - Compare versions, show outdated
  - [x] `update [file]` - Update specific template
  - [x] `update-all` - Update all templates
  - [x] `diff [file]` - Show differences
  - [x] `list` - List available templates
  - [x] `copy [file]` - Copy template to project
- [x] Add version headers to all templates (v1.0)

### Phase 5: Command Refactoring ✅
> Update Claude commands to use scripts

- [x] Refactor `speckit.orchestrate.md`:
  - [x] Use `speckit state` for state operations
  - [x] Use `speckit git` for git operations
  - [x] Use `speckit roadmap` for status updates
  - [x] Use `speckit claude-md` for CLAUDE.md updates
  - [x] Add CLI Dependencies section
- [x] Refactor `speckit.init.md`:
  - [x] Consolidate sub-commands to arguments
  - [x] Use `speckit scaffold` for structure creation
  - [x] Add CLI Dependencies section
- [x] Refactor `speckit.verify.md`:
  - [x] Use `speckit checklist` for status
  - [x] Use `speckit tasks` for task status
  - [x] Use `speckit roadmap update` for completion
  - [x] Add CLI Dependencies section
- [x] Refactor `speckit.implement.md`:
  - [x] Use `speckit tasks` for progress tracking
  - [x] Use `speckit checklist` for pre-checks
  - [x] Add CLI Dependencies section
- [x] Update other commands for consistency:
  - [x] `speckit.roadmap.md` - Added CLI commands for validation and status

### Phase 6: Smart Entry Point ✅
> Create speckit.start with routing logic

- [x] Create `speckit.start.md` command:
  - [x] No `.specify/` → Route to `speckit.init`
  - [x] No state file → Route to `speckit.init`
  - [x] Interview incomplete → Route to `speckit.init continue`
  - [x] No ROADMAP.md → Route to `speckit.roadmap`
  - [x] Has orchestration state → Route to `speckit.orchestrate continue`
  - [x] All phases complete → Report completion
- [x] Add handoffs for each route
- [x] Document all routing scenarios with flowchart

### Phase 7: Cleanup & Documentation ✅
> Final polish

- [x] Add deprecation notices to `speckit.init-*` command files (kept for backwards compatibility)
- [x] Update all command descriptions
- [x] Update README.md with:
  - [x] Installation instructions
  - [x] CLI reference (all commands documented)
  - [x] Workflow overview (with ASCII diagram)
  - [x] Troubleshooting guide (with `speckit doctor`)
  - [x] Quick Start with smart entry point
- [x] Document `/speckit.start` as recommended entry point

### Phase 8: Edge Case Handling ✅
> Safe handling of all project states

- [x] Create EDGE-CASE-ANALYSIS.md documenting all scenarios
- [x] Add `speckit detect` command for existing content detection:
  - [x] System installation status
  - [x] SpecKit artifacts (.specify/, state, specs)
  - [x] Existing documentation (docs/, ADRs, RFCs)
  - [x] Key files (CLAUDE.md, ROADMAP.md)
  - [x] State file version checking
- [x] Add `speckit state migrate` command for v1.0 → v2.0 migration:
  - [x] Backup before migration
  - [x] Preserve all existing data
  - [x] Handle partial/unknown formats
- [x] Add `speckit reconcile` command for state/file sync:
  - [x] Task completion comparison
  - [x] Git branch comparison
  - [x] Spec artifacts comparison
  - [x] ROADMAP status comparison
  - [x] Interview state comparison
  - [x] --trust-files and --trust-state options
- [x] Update `speckit.start.md` with pre-flight checks:
  - [x] CLI availability check
  - [x] Existing content detection
  - [x] State version compatibility
- [x] Update CLI dispatcher with new commands

---

## CLI Reference (Target)

```bash
# Smart entry point (Claude command)
/speckit.start                    # Auto-detect and route

# Core operations (bash scripts via CLI)
speckit state get                 # Show current state
speckit state get config          # Show config section
speckit state set orchestration.step=plan  # Update value
speckit state init                # Initialize new state file
speckit state reset               # Reset to defaults

speckit scaffold                  # Create .specify/ structure
speckit scaffold --force          # Recreate (overwrites)

speckit git branch create 002-x   # Create and checkout branch
speckit git branch checkout 002-x # Checkout existing
speckit git commit "feat: thing"  # Stage all, commit
speckit git merge main            # Merge current to main
speckit git push                  # Push current branch
speckit git sync                  # Fetch all, status

speckit roadmap status            # Show all phases
speckit roadmap next              # Get next pending phase
speckit roadmap update 002 complete  # Mark phase complete
speckit roadmap update 002 in_progress  # Mark in progress

speckit claude-md update "002: Flow Engine"  # Add to recent changes
speckit claude-md sync            # Sync from ROADMAP completions

speckit checklist status          # All checklists status
speckit checklist incomplete      # List incomplete items

speckit tasks status              # Task completion status
speckit tasks incomplete          # List incomplete tasks
speckit tasks mark T001           # Mark task complete

speckit templates check           # Check for updates
speckit templates update          # Update all templates
speckit templates diff spec.md    # Show template differences

speckit doctor                    # Run all diagnostics
speckit doctor --fix              # Auto-fix issues
speckit doctor --check state      # Check specific area

speckit detect                    # Scan for existing content
speckit detect --check docs       # Check for existing documentation
speckit detect --check state      # Check state file format

speckit reconcile                 # Compare state with files
speckit reconcile --trust-files   # Update state from files
speckit reconcile --dry-run       # Preview changes only

speckit state migrate             # Migrate v1.0 state to v2.0
```

---

## Progress Log

### 2026-01-10 (Phase 8)
- **Phase 8 Complete**: Edge Case Handling
  - Created EDGE-CASE-ANALYSIS.md documenting 6 project state scenarios
  - Added `speckit detect` command for non-destructive content scanning
  - Added `speckit state migrate` command with v1.0 → v2.0 migration
  - Added `speckit reconcile` command for state/file synchronization
  - Updated `speckit.start.md` with pre-flight checks (CLI, content, version)
  - Updated CLI dispatcher with detect and reconcile commands
  - **North Star principle**: Only improve and enable, never be destructive

### 2026-01-10 (Phases 6 & 7)
- **Phase 7 Complete**: Cleanup & Documentation
  - Added deprecation notices to all 11 `speckit.init-*` command files (kept for backwards compatibility)
  - Updated README.md with comprehensive documentation:
    - Installation instructions with quick install
    - Complete CLI reference for all commands
    - Workflow overview with ASCII diagram
    - Troubleshooting section with `speckit doctor`
  - Documented `/speckit.start` as the recommended entry point
- **Phase 6 Complete**: Smart Entry Point
  - Created `speckit.start.md` command with detection logic
  - Routing: No `.specify/` → init, No ROADMAP → roadmap, In progress → orchestrate continue
  - Added flowchart diagram for routing logic
  - Added handoffs for each route with appropriate context
  - Added CLI Dependencies section

### 2026-01-10 (Phase 5)
- **Phase 5 Complete**: Refactored Claude commands to use CLI scripts
  - `speckit.orchestrate.md`: Updated 15+ sections to use `speckit state/git/roadmap/claude-md/tasks/checklist/doctor` commands
  - `speckit.verify.md`: Updated task verification, checklist verification, and ROADMAP updates to use CLI
  - `speckit.implement.md`: Updated checklist pre-checks and task marking to use CLI
  - `speckit.init.md`: Consolidated sub-commands to argument format (e.g., `/speckit.init status` instead of `/speckit.init-status`), added `speckit scaffold` usage
  - `speckit.roadmap.md`: Added CLI commands for ROADMAP validation and status checks
  - Added CLI Dependencies section to all refactored commands documenting required CLI tools

### 2026-01-10
- **Phase 4 Complete**: Created Doctor & Templates Scripts
  - `speckit-doctor.sh` with system, project, state, paths, git, templates checks + auto-fix
  - `speckit-templates.sh` with check, update, update-all, diff, list, copy
  - Added version headers (v1.0) to all 9 templates
- **Phase 3 Complete**: Created Checklist & Task Scripts
  - `speckit-checklist.sh` with status, list, incomplete, show
  - `speckit-tasks.sh` with status, incomplete, mark, phase-status, list, find
  - State integration: mark command updates orchestration state
- **Phase 2 Complete**: Created Git & Status Scripts
  - `speckit-git.sh` with branch (create/checkout/current/list), commit, merge, push, sync, status
  - `speckit-roadmap.sh` with status, update, next, current, validate, path
  - `speckit-claude-md.sh` with update, sync, init, show, path
- All scripts support `--json` output flag
- Updated CLAUDE.md with improved architecture documentation

### 2025-01-10 (continued)
- **Phase 1 Complete**: Created core CLI infrastructure
  - `speckit` wrapper in `~/.claude/speckit-system/bin/`
  - `lib/common.sh` with colors, logging, path utilities
  - `lib/json.sh` with jq-based JSON operations
  - `speckit-state.sh` for state CRUD (get, set, init, reset, validate)
  - `speckit-scaffold.sh` for project scaffolding
- Tested all commands successfully
- Note: Existing story-sprout state file uses v1.0 format (config in `.project`), new format uses `.config`

### 2025-01-10
- Created improvement plan document
- Documented all decisions from user discussion
- Defined target architecture
- Outlined 7 implementation phases

---

## Notes

- All scripts should be POSIX-compliant bash for portability
- Use `jq` for JSON manipulation (check availability, suggest install if missing)
- Scripts should have `--help` and `--json` output options
- Error messages should be actionable
- Scripts exit with appropriate codes (0=success, 1=error, 2=warning)
