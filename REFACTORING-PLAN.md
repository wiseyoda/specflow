# SpecKit Refactoring Plan

> Simplification and hardening of SpecKit based on analysis of [GitHub's vanilla spec-kit](https://github.com/github/spec-kit), [Anthropic's best practices](https://www.anthropic.com/engineering/claude-code-best-practices), and industry SDD patterns.

**Created**: 2026-01-10
**Status**: Planning
**Target**: v2.0

---

## Executive Summary

SpecKit has grown beyond the simplicity of vanilla spec-kit. This plan outlines how to:

1. **Simplify** - Reduce 26 commands to ~12, consolidate 12 init files to 2
2. **Harden** - Fix CLI gaps, replace workarounds with proper implementations
3. **Future-Proof** - Design state schema for web UI dashboard integration

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [State Schema v2.0 (Web UI Ready)](#state-schema-v20-web-ui-ready)
4. [Refactoring Phases](#refactoring-phases)
5. [Command Consolidation Map](#command-consolidation-map)
6. [CLI Gaps to Fix](#cli-gaps-to-fix)
7. [Web UI Considerations](#web-ui-considerations)
8. [Migration Guide](#migration-guide)

---

## Current State Analysis

### Complexity Comparison

| Metric | Vanilla Spec-Kit | Our SpecKit | Target v2.0 |
|--------|------------------|-------------|-------------|
| Core commands | 3 | 26 | 12 |
| Init commands | 0 | 12 | 2 |
| Required memory docs | 1 | 6 | 1 |
| State schema fields | 0 (file-based) | ~20 | ~10 |
| Script dependencies | 0 | 5+ bash scripts | CLI unified |

### Problems Identified

| Issue | Impact | Root Cause |
|-------|--------|------------|
| 12 init-* sub-commands | Confusing UX, hard to maintain | Over-engineering interview flow |
| CLI commands don't exist | Commands reference non-existent CLI | Incomplete implementation |
| `check-prerequisites.sh` everywhere | Workaround, not proper state | Missing `speckit context` command |
| Complex state schema | Hard to debug, corruption risk | Over-designed for current needs |
| 6 required memory docs | High barrier to entry | Copied from full enterprise pattern |
| State recovery logic | Fragile, hard to test | State is complex, recovery matches |

---

## Target Architecture

### Command Structure (v2.0)

```
speckit.start.md          # Smart entry - detects state, routes appropriately
speckit.init.md           # Unified interview (absorbs all init-* commands)
speckit.constitution.md   # Direct constitution editing
speckit.roadmap.md        # ROADMAP.md management
speckit.orchestrate.md    # Simplified workflow runner
speckit.specify.md        # Create specification
speckit.plan.md           # Create implementation plan
speckit.tasks.md          # Generate task list
speckit.implement.md      # Execute tasks (with optional --tdd flag)
speckit.verify.md         # Verify completion
speckit.memory.md         # Memory document management
speckit.analyze.md        # Cross-artifact analysis (optional, for debugging)
```

**Removed/Merged**:
- `speckit.init-*.md` (12 files) → merged into `speckit.init.md`
- `speckit.clarify.md` → merged into `speckit.specify.md` (inline clarification)
- `speckit.checklist.md` → merged into `speckit.verify.md`
- `speckit.taskstoissues.md` → standalone utility, not core workflow

### CLI Structure (v2.0)

```bash
speckit context              # NEW: Replace check-prerequisites.sh
speckit feature create       # NEW: Replace create-new-feature.sh
speckit state [get|set|init|reset|validate]
speckit roadmap [status|update|next|current|validate]
speckit tasks [status|mark|incomplete|list]
speckit checklist [status|list|incomplete]
speckit git [branch|commit|push|merge|sync]
speckit doctor [--fix]
```

---

## State Schema v2.0 (Web UI Ready)

### Design Principles for Web UI

1. **Unique Project ID** - Each project has UUID for multi-project dashboard
2. **WebSocket-friendly** - State changes emit events for real-time updates
3. **Action Queue** - Pending actions can be triggered from UI
4. **Health Metrics** - Quick status indicators for dashboard display
5. **Timestamps** - All changes tracked for activity timeline

### Schema

```json
{
  "schema_version": "2.0",
  "project": {
    "id": "uuid-v4",
    "name": "project-name",
    "path": "/absolute/path/to/project",
    "created_at": "ISO-8601",
    "updated_at": "ISO-8601"
  },
  "orchestration": {
    "phase": {
      "number": "001",
      "name": "project-setup",
      "branch": "001-project-setup",
      "status": "in_progress | completed | blocked | awaiting_user"
    },
    "step": {
      "current": "plan",
      "index": 2,
      "status": "in_progress | completed | blocked"
    },
    "progress": {
      "tasks_completed": 15,
      "tasks_total": 47,
      "percentage": 32
    }
  },
  "health": {
    "status": "healthy | warning | error",
    "last_check": "ISO-8601",
    "issues": []
  },
  "actions": {
    "available": ["continue", "skip", "heal", "abort"],
    "pending": [],
    "history": [
      {
        "action": "step_completed",
        "step": "specify",
        "timestamp": "ISO-8601"
      }
    ]
  },
  "ui": {
    "last_sync": "ISO-8601",
    "notifications": []
  }
}
```

### Key Changes from v1.x

| Field | v1.x | v2.0 | Why |
|-------|------|------|-----|
| `project.id` | None | UUID | Multi-project identification |
| `project.path` | None | Absolute path | UI needs to know where project lives |
| `health` | None | Object | Dashboard status indicators |
| `actions.available` | None | Array | UI can show available actions |
| `actions.history` | `history[]` | Structured | Timeline display |
| `ui.last_sync` | None | Timestamp | Real-time sync tracking |
| `config.*` | 5 path fields | Removed | Use conventions, not config |

### Real-Time Events (Future)

When state changes, emit events for WebSocket subscribers:

```typescript
interface StateEvent {
  type: 'step_started' | 'step_completed' | 'task_completed' |
        'error' | 'user_input_required' | 'phase_completed';
  project_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
```

---

## Refactoring Phases

### Phase 0: Preparation (1-2 hours)

- [ ] Create feature branch `refactor/v2-simplification`
- [ ] Document current command usage patterns
- [ ] Create test fixtures for state migration
- [ ] Backup current working implementation

### Phase 1: CLI Gaps (P0) (4-6 hours)

Fix commands that are called but don't exist:

- [x] Implement `speckit context` (replaces check-prerequisites.sh)
- [x] Implement `speckit feature create` (replaces create-new-feature.sh)
- [x] Complete `speckit roadmap update` implementation
- [x] Complete `speckit tasks mark` implementation
- [x] Complete `speckit checklist` subcommands
- [x] Fix REMAINING_ARGS issue across all scripts
- [ ] Add `--json` flag to all commands consistently
- [ ] Add tests for each new command

### Phase 2: Init Consolidation (P1) (3-4 hours)

Merge 12 init files into 2:

- [x] Create unified `speckit.init.md` with argument routing
- [x] Inline controls: status, pause, skip, revisit, validate, export, faster, deeper, focus, research, compare
- [x] Archive old `speckit.init-*.md` files (moved to commands/archive/)
- [x] Verify `speckit.start.md` uses consolidated init
- [ ] Migration: auto-detect v1 interview state, continue seamlessly

### Phase 3: State Simplification (P1) (2-3 hours)

Migrate to v2.0 schema:

- [ ] Create v2.0 schema with web UI fields
- [ ] Implement migration function in `speckit state migrate`
- [ ] Update `speckit state` commands for new schema
- [ ] File existence as truth:
  - `spec.md` exists → specify complete
  - `plan.md` exists → plan complete
  - `tasks.md` exists → tasks complete
  - All tasks `[X]` → implement complete
- [ ] Simplify `speckit doctor` recovery logic
- [ ] Add project UUID generation
- [ ] Add health status calculation

### Phase 4: Memory Simplification (P2) (1-2 hours)

Make memory documents optional:

- [ ] Update memory command to only require `constitution.md`
- [ ] Other docs become "recommended" not "required"
- [ ] Update templates to generate minimal constitution
- [ ] Update orchestrate to work without optional docs
- [ ] Add `speckit memory init` to generate optional docs on demand

### Phase 5: Command Cleanup (P2) (2-3 hours)

Remove/merge redundant commands:

- [ ] Merge `speckit.clarify.md` into `speckit.specify.md`
- [ ] Merge `speckit.checklist.md` into `speckit.verify.md`
- [ ] Move `speckit.taskstoissues.md` to utilities folder
- [ ] Simplify `speckit.orchestrate.md` (remove redundant sections)
- [ ] Add `--tdd` flag to `speckit.implement.md`
- [ ] Update all cross-references

### Phase 6: User Story Focus (P3) (2-3 hours)

Align with vanilla spec-kit's user story independence:

- [ ] Update `spec-template.md` to emphasize story independence
- [ ] Update `tasks-template.md` to organize by story, not phase
- [ ] Add "MVP checkpoint" after each story
- [ ] Update orchestrate to support story-based flow
- [ ] Add `speckit tasks next-story` command

### Phase 7: Documentation & Testing (P3) (2-3 hours)

- [ ] Update README.md for v2.0
- [ ] Update CLAUDE.md for v2.0
- [ ] Create migration guide for v1.x users
- [ ] Add integration tests for full workflow
- [ ] Update IMPROVEMENT-PLAN.md to reflect completed work

---

## Command Consolidation Map

### Before → After

```
speckit.init.md              → speckit.init.md (enhanced)
speckit.init-compare.md      → (merged into init)
speckit.init-deeper.md       → (merged into init)
speckit.init-export.md       → (merged into init)
speckit.init-faster.md       → (merged into init)
speckit.init-focus.md        → (merged into init)
speckit.init-pause.md        → (merged into init)
speckit.init-research.md     → (merged into init)
speckit.init-revisit.md      → (merged into init)
speckit.init-skip.md         → (merged into init)
speckit.init-status.md       → (merged into init)
speckit.init-validate.md     → (merged into init)

speckit.clarify.md           → speckit.specify.md (inline)
speckit.checklist.md         → speckit.verify.md (inline)
speckit.taskstoissues.md     → utilities/taskstoissues.md

speckit.start.md             → speckit.start.md (unchanged)
speckit.constitution.md      → speckit.constitution.md (unchanged)
speckit.roadmap.md           → speckit.roadmap.md (unchanged)
speckit.orchestrate.md       → speckit.orchestrate.md (simplified)
speckit.specify.md           → speckit.specify.md (+ clarify)
speckit.plan.md              → speckit.plan.md (unchanged)
speckit.tasks.md             → speckit.tasks.md (story-focused)
speckit.analyze.md           → speckit.analyze.md (optional)
speckit.implement.md         → speckit.implement.md (+ TDD flag)
speckit.verify.md            → speckit.verify.md (+ checklist)
speckit.memory.md            → speckit.memory.md (unchanged)
```

**Result**: 26 commands → 12 commands

---

## CLI Gaps to Fix

### Commands Called But Not Implemented

| Command | Called From | Priority |
|---------|-------------|----------|
| `speckit context --json` | specify, plan, implement, verify | P0 |
| `speckit feature create` | specify | P0 |
| `speckit roadmap update` | orchestrate, verify | P0 |
| `speckit roadmap validate` | orchestrate | P0 |
| `speckit tasks mark` | implement, orchestrate | P0 |
| `speckit tasks phase-status` | orchestrate | P1 |
| `speckit checklist status --json` | implement | P1 |
| `speckit claude-md update` | verify, roadmap | P1 |

### Scripts to Replace with CLI

| Script | Replacement | Priority |
|--------|-------------|----------|
| `check-prerequisites.sh` | `speckit context` | P0 |
| `create-new-feature.sh` | `speckit feature create` | P0 |
| `setup-plan.sh` | `speckit plan init` | P1 |
| `update-agent-context.sh` | `speckit agent update` | P2 |

---

## Web UI Considerations

### Dashboard Requirements (Future)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SpecKit Dashboard                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Projects                              Activity                  │
│  ┌────────────────────────────────┐   ┌────────────────────────┐│
│  │ ● my-saas-app         Phase 3 │   │ 2m ago: Task T015 done ││
│  │   ███████████░░░░  67% tasks  │   │ 5m ago: Plan complete  ││
│  │   🔄 implementing              │   │ 12m ago: Spec created  ││
│  ├────────────────────────────────┤   └────────────────────────┘│
│  │ ● api-service         Phase 1 │                              │
│  │   ██████░░░░░░░░░  40% tasks  │   Actions                    │
│  │   ⏸️ awaiting user             │   ┌────────────────────────┐│
│  ├────────────────────────────────┤   │ [Continue] [Skip] [Heal]│
│  │ ● mobile-app          Phase 5 │   │ [View Logs] [Abort]    ││
│  │   ████████████████  100%      │   └────────────────────────┘│
│  │   ✅ complete                  │                              │
│  └────────────────────────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Architecture (Future)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web UI        │     │   API Server    │     │   File Watcher  │
│   (React/Next)  │────▶│   (Node/Python) │◀────│   (chokidar)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │ WebSocket            │ REST                  │ fs.watch
         │                      ▼                       │
         │              ┌─────────────────┐             │
         └─────────────▶│ State Registry  │◀────────────┘
                        │ (SQLite/JSON)   │
                        └─────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Project State Files   │
                    │ .specify/orchestration│
                    │      -state.json      │
                    └───────────────────────┘
```

### State File Location Strategy

For web UI to discover projects:

**Option A: Central Registry** (Recommended)
```
~/.speckit/
├── registry.json           # List of known projects with paths
├── settings.json           # User preferences
└── cache/                  # State cache for offline UI
```

**Option B: File System Scan**
- UI scans common directories for `.specify/` folders
- Slower, but no central registry needed

**Recommendation**: Use Option A with auto-discovery. When `speckit init` runs, register project in `~/.speckit/registry.json`.

### State Sync Protocol

1. **File Watch**: `chokidar` watches all registered project state files
2. **Change Detection**: On change, parse state, emit WebSocket event
3. **UI Update**: React component receives event, updates display
4. **Action Dispatch**: UI sends action → API → runs `speckit` CLI → state updates → loop

### API Endpoints (Future)

```
GET  /api/projects                    # List all registered projects
GET  /api/projects/:id                # Get project details + state
GET  /api/projects/:id/state          # Get current state
POST /api/projects/:id/actions        # Execute action (continue, heal, etc.)
WS   /api/projects/:id/subscribe      # Real-time state updates
```

---

## Migration Guide

### v1.x → v2.0 State Migration

```bash
# Automatic migration
speckit state migrate

# What it does:
# 1. Reads v1.x state file
# 2. Generates project UUID
# 3. Restructures to v2.0 schema
# 4. Registers in ~/.speckit/registry.json
# 5. Backs up old state to .specify/archive/
```

### Interview State Migration

If user has incomplete v1.x interview:

1. Detect `.specify/discovery/state.md` from v1 init
2. Parse current phase and captured decisions
3. Create v2.0 interview state
4. Resume seamlessly

### Command Alias Support

For backwards compatibility:

```bash
# These still work (deprecated warnings)
/speckit.init-deeper  →  /speckit.init deeper
/speckit.init-pause   →  /speckit.init pause
/speckit.clarify      →  /speckit.specify --clarify
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Command count | 26 | 12 |
| Init files | 12 | 2 |
| Required memory docs | 6 | 1 |
| CLI commands working | ~60% | 100% |
| State schema fields | ~20 | ~10 |
| Lines in orchestrate.md | 1010 | 500 |

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 0: Preparation | 1-2h | None |
| Phase 1: CLI Gaps | 4-6h | Phase 0 |
| Phase 2: Init Consolidation | 3-4h | Phase 1 |
| Phase 3: State Simplification | 2-3h | Phase 1 |
| Phase 4: Memory Simplification | 1-2h | Phase 3 |
| Phase 5: Command Cleanup | 2-3h | Phase 2, 4 |
| Phase 6: User Story Focus | 2-3h | Phase 5 |
| Phase 7: Documentation | 2-3h | Phase 6 |

**Total**: ~18-26 hours of focused work

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Keep file-based state (not DB) | Simpler, git-friendly, CLI-first | 2026-01-10 |
| Add project UUID | Required for multi-project UI | 2026-01-10 |
| Central registry at ~/.speckit/ | UI discovery without scanning | 2026-01-10 |
| Constitution only required | Lower barrier, matches vanilla | 2026-01-10 |
| Merge clarify into specify | Reduces workflow steps | 2026-01-10 |

---

## Open Questions

1. **WebSocket vs Polling**: For UI updates, use WebSocket for real-time or polling for simplicity?
2. **Multi-machine Sync**: Should registry.json sync across machines (Git, cloud)?
3. **Remote Execution**: Can UI trigger commands on remote projects (SSH)?
4. **Authentication**: Does dashboard need auth for team use?

---

## References

- [GitHub Spec-Kit](https://github.com/github/spec-kit)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Spec-Driven Development - GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Agentic Coding Recommendations](https://lucumr.pocoo.org/2025/6/12/agentic-coding/)
