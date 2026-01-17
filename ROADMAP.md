# SpecKit Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds through phases sequentially. Each phase produces a deployable increment.

**Project**: SpecKit - Spec-Driven Development Framework for Claude Code
**Created**: 2026-01-10
**Schema Version**: 2.1 (ABBC numbering)
**Status**: Active Development

---

## Phase Numbering (v2.1)

Phases use **ABBC** format:
- **A** = Milestone (0-9) - Major version or project stage
- **BB** = Phase (01-99) - Sequential work within milestone
- **C** = Hotfix (0-9) - Insert slot (0 = main phase, 1-9 = hotfixes/inserts)

**Examples**:
- `0010` = Milestone 0, Phase 01, no hotfix
- `0021` = Hotfix 1 inserted after Phase 02
- `1010` = Milestone 1, Phase 01, no hotfix

This allows inserting urgent work without renumbering existing phases.

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | Roadmap Flexibility | ✅ Complete | Insert/defer commands work |
| 0015 | Workflow Commands | ✅ Complete | Merge and backlog commands work |
| 0020 | Onboarding Polish | ✅ Complete | New user can set up without confusion |
| 0030 | Test Suite Completion | ✅ Complete | All tests pass on macOS and Linux |
| 0040 | Integration Options | ✅ Complete | Existing docs imported successfully |
| 0041 | Code Review Findings | ✅ Complete | All review findings addressed |
| 0042 | Code Review 2026-01-11 | ✅ Complete | 18 findings addressed |
| 0050 | UX Simplification | ✅ Complete | Single entry point, clean codebase, unified memory |
| 0060 | Constitution Compliance | ✅ Complete | 95%+ constitution compliance, three-line rule, critical bugs fixed |
| 1010 | Core UI Scaffold | 🔄 In Progress | **USER GATE**: Dashboard starts, shows projects, dark mode works |
| 1020 | Real-Time File Watching | ⬜ Not Started | **USER GATE**: CLI changes reflect in UI within 2s |
| 1030 | Project Detail Views | ⬜ Not Started | **USER GATE**: Kanban and Timeline views work |
| 1040 | CLI Actions from UI | ⬜ Not Started | **USER GATE**: Mark tasks, add backlog from UI |
| 1050 | Agent SDK Integration | ⬜ Not Started | **USER GATE**: Spawn agent, see logs, answer questions |
| 1060 | Operations Dashboard | ⬜ Not Started | **USER GATE**: Queue view, notifications, resource monitor |
| 1070 | Cost Analytics | ⬜ Not Started | **USER GATE**: Token costs per session and trends |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Phase Details

Phase details are stored in modular files:

| Location | Content |
|----------|---------|
| `.specify/phases/*.md` | Active/pending phase details |
| `.specify/history/HISTORY.md` | Archived completed phases |

To view a specific phase:
```bash
speckit phase show 0010
```

To list all phases:
```bash
speckit phase list
speckit phase list --active
speckit phase list --complete
```

---

## Verification Gates Summary


| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| **Gate 1** | 1010 | `speckit dashboard` starts, projects listed, dark mode, Cmd+K works |
| **Gate 2** | 1020 | CLI state changes appear in UI within 2 seconds |
| **Gate 3** | 1030 | Project detail with Kanban/Timeline views, view preference persists |
| **Gate 4** | 1040 | Mark task complete, add backlog item, keyboard shortcuts work |
| **Gate 5** | 1050 | Spawn agent, see real-time logs, answer questions, queue tasks, cancel |
| **Gate 6** | 1060 | Operations view, desktop notifications, resource usage visible |
| **Gate 7** | 1070 | Session costs, project totals, trend charts, CSV export |

---

## Phase Sizing Guidelines

Each phase is designed to be:
- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:
1. Cut scope to MVP for that phase
2. Document deferred items in `specs/[phase]/checklists/deferred.md`
3. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.specify "Phase NNNN - [Phase Name]"
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Archive phase: `speckit phase archive NNNN`
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases
Use SpecKit commands:
```bash
speckit roadmap insert --after 0020 "New Phase Name"
speckit phase create 0025 "new-phase"
```
