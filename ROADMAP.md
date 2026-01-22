# SpecFlow Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds through phases sequentially. Each phase produces a deployable increment.

**Project**: SpecFlow - Spec-Driven Development Framework for Claude Code
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

| Phase | Name                              | Status         | Verification Gate                                                  |
| ----- | --------------------------------- | -------------- | ------------------------------------------------------------------ |
| 0010  | Roadmap Flexibility               | ✅ Complete    | Insert/defer commands work                                         |
| 0015  | Workflow Commands                 | ✅ Complete    | Merge and backlog commands work                                    |
| 0020  | Onboarding Polish                 | ✅ Complete    | New user can set up without confusion                              |
| 0030  | Test Suite Completion             | ✅ Complete    | All tests pass on macOS and Linux                                  |
| 0040  | Integration Options               | ✅ Complete    | Existing docs imported successfully                                |
| 0041  | Code Review Findings              | ✅ Complete    | All review findings addressed                                      |
| 0042  | Code Review 2026-01-11            | ✅ Complete    | 18 findings addressed                                              |
| 0050  | UX Simplification                 | ✅ Complete    | Single entry point, clean codebase, unified memory                 |
| 0060  | Constitution Compliance           | ✅ Complete    | 95%+ constitution compliance, three-line rule, critical bugs fixed |
| 0070  | Pre-Workflow Consolidation        | ✅ Complete    | 7 commands → 3, clear setup vs. utility separation                 |
| 0072  | Workflow Consolidation            | ✅ Complete    | 11 commands → 6, single design command, inline clarify             |
| 0076  | Command Rebrand                   | ✅ Complete    | Rename all `/specflow.*` → `/flow.*`, update all docs              |
| 0080  | CLI TypeScript Migration          | ✅ Complete    | 5 smart TypeScript commands, reduce CLI calls 80%                  |
| 0082 | Code Review 20260118 | ✅ Complete | RE: .specify/reviews/review-20260118-115354.md |
| 1010  | Core UI Scaffold                  | ✅ Complete    | **USER GATE**: Dashboard starts, shows projects, dark mode works   |
| 1020  | Real-Time File Watching           | ✅ Complete    | **USER GATE**: CLI changes reflect in UI within 2s                 |
| 1030  | Project Detail Views              | ✅ Complete    | **USER GATE**: Kanban and Timeline views work                      |
| 1040  | CLI Actions from UI               | ✅ Complete    | **USER GATE**: Mark tasks, add backlog from UI                     |
| 1045  | Project Actions & Health          | ✅ Complete    | **USER GATE**: Initialize, doctor, upgrade from UI                 |
| 1046 | Command JSON Output | ✅ Complete | All commands support --json flag |
| 1047 | Workflow Decomposition: Design | ✅ Complete | discover, design, check commands work |
| 1048 | Workflow Foundation | ✅ Complete | **USER GATE**: Start workflow for registered project via API |
| 1050 | Workflow UI | ✅ Complete | **USER GATE**: Start from card/detail, see status badges |
| 1051 | Questions & Notifications | ✅ Complete | **USER GATE**: Browser notification, question drawer |
| 1052 | Session Viewer | ✅ Complete | **USER GATE**: View session JSONL, real-time streaming |
| 1053 | Workflow-Session Unification | ✅ Complete | **USER GATE**: Session detected immediately on workflow start |
| 1054 | Project Details Redesign | ✅ Complete | **USER GATE**: New UI matches v3 mockup, all states work |
| 1055 | Smart Batching & Orchestration | 🔄 In Progress | **USER GATE**: Auto-batch tasks, state machine, auto-healing |
| 1056 | JSONL Watcher (Push Updates) | ⬜ Not Started | **USER GATE**: SSE-based instant updates, no polling delay |
| 1060  | Stats & Operations                | ⬜ Not Started | **USER GATE**: Costs on cards, operations page, basic chart        |
| 1070  | Cost Analytics                    | ⬜ Not Started | **USER GATE**: Advanced charts, projections, export                |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Phase Details

Phase details are stored in modular files:

| Location                      | Content                      |
| ----------------------------- | ---------------------------- |
| `.specify/phases/*.md`        | Active/pending phase details |
| `.specify/history/HISTORY.md` | Archived completed phases    |

To view a specific phase:

```bash
specflow phase show 0010
```

To list all phases:

```bash
specflow phase list
specflow phase list --active
specflow phase list --complete
```

---

## Verification Gates Summary

| Gate         | Phase | What User Verifies                                                    |
| ------------ | ----- | --------------------------------------------------------------------- |
| **Gate 1**   | 1010  | `specflow dashboard` starts, projects listed, dark mode, Cmd+K works  |
| **Gate 2**   | 1020  | CLI state changes appear in UI within 2 seconds                       |
| **Gate 3**   | 1030  | Project detail with Kanban/Timeline views, view preference persists   |
| **Gate 4**   | 1040  | Mark task complete, add backlog item, keyboard shortcuts work         |
| **Gate 4.5** | 1045  | Initialize project, run doctor, upgrade v1→v2 from dashboard          |
| **Gate 5**   | 1048  | Start workflow for registered project via API, cancel workflow        |
| **Gate 5.5** | 1050  | Start workflow from card/detail, skill picker, status badges update   |
| **Gate 6**   | 1051  | Browser notification appears, question drawer works, follow-up works  |
| **Gate 6.5** | 1052  | Session viewer shows JSONL messages, real-time streaming works        |
| **Gate 6.6** | 1053  | Session detected immediately when workflow starts, history viewable   |
| **Gate 6.7** | 1054  | New project details UI matches v3 mockup, all workflow states work    |
| **Gate 7**   | 1055  | Auto-batching works, state machine transitions, auto-healing attempts |
| **Gate 7.5** | 1056  | Session updates within 500ms, questions appear instantly, SSE works   |
| **Gate 8**   | 1060  | Costs on cards, session history, basic chart, operations page         |
| **Gate 9**   | 1070  | Advanced charts, projections, CSV/JSON export                         |

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
/specflow.orchestrate
```

Or manually:

```
/specflow.specify "Phase NNNN - [Phase Name]"
```

### After Completing a Phase

1. Update status in table above: ⬜ → ✅
2. Archive phase: `specflow phase archive NNNN`
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases

Use SpecFlow commands:

```bash
specflow roadmap insert --after 0020 "New Phase Name"
specflow phase create 0025 "new-phase"
```
