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
| 1010 | Core UI Scaffold | ⬜ Not Started | **USER GATE**: Dashboard starts, shows projects, dark mode works |
| 1020 | Real-Time File Watching | ⬜ Not Started | **USER GATE**: CLI changes reflect in UI within 2s |
| 1030 | Project Detail Views | ⬜ Not Started | **USER GATE**: Kanban and Timeline views work |
| 1040 | CLI Actions from UI | ⬜ Not Started | **USER GATE**: Mark tasks, add backlog from UI |
| 1050 | Agent SDK Integration | ⬜ Not Started | **USER GATE**: Spawn agent, see logs, answer questions |
| 1060 | Operations Dashboard | ⬜ Not Started | **USER GATE**: Queue view, notifications, resource monitor |
| 1070 | Cost Analytics | ⬜ Not Started | **USER GATE**: Token costs per session and trends |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Milestone 0: Foundation & Polish

### 0010 - Roadmap Flexibility

**Goal**: Enable mid-roadmap changes without painful renumbering.

**Scope**:
- Implement ABBC numbering scheme (v2.1 schema)
- Add `speckit roadmap insert` command
- Add `speckit roadmap defer` command
- Add Backlog section support to ROADMAP.md
- Migration from v2.0 → v2.1 (convert 001 → 2010, etc.)
- Update roadmap template with sparse numbering

**User Stories**:
1. As a developer, I can insert a hotfix phase after user testing discovers issues
2. As a developer, I can defer low-priority phases to backlog
3. As a developer, I can migrate existing 2.0 roadmaps to 2.1 format

**Deliverables**:
- `scripts/bash/speckit-roadmap.sh` - Add insert/defer commands
- `scripts/bash/speckit-migrate.sh` - Add 2.0→2.1 roadmap migration
- `templates/roadmap-template.md` - Update with ABBC numbering
- Updated schema documentation

**Verification Gate**:
- `speckit roadmap insert --after 0020 "Urgent Fix"` creates phase 0021
- `speckit roadmap defer 0040` moves phase to Backlog
- Migration converts 001→0010, 002→0020 correctly

**Estimated Complexity**: Medium

---

### 0015 - Workflow Commands

**Goal**: Streamline end-of-phase and continuous backlog workflows.

**Scope**:
- `/speckit.merge` command: push, merge to main, cleanup branches, update state/roadmap, show backlog
- `/speckit.backlog` command: triage items into phases, analyze unassignable, create phases for remaining
- `speckit roadmap backlog add "<item>"` CLI to quickly add items
- End-of-phase backlog summary display

**User Stories**:
1. As a developer, I can complete a phase with one command that handles all git/state cleanup
2. As a developer, I can add ideas to backlog anytime and have them auto-triaged into phases
3. As a reviewer, I can see what's in the backlog after each phase completion

**Deliverables**:
- `commands/speckit.merge.md` - Slash command for phase completion
- `commands/speckit.backlog.md` - Slash command for backlog triage
- `scripts/bash/speckit-roadmap.sh` - Add `backlog add` subcommand

**Verification Gate**:
- `/speckit.merge` completes phase with single command
- `/speckit.backlog` assigns items to appropriate phases
- Backlog summary shown at end of phase

**Estimated Complexity**: Medium

---

### 0020 - Onboarding Polish

**Goal**: Make the first-run experience smooth and project-agnostic.

**Scope**:
- ~~Fix memory document templates (TypeScript-focused)~~ ✅ Done
- Multi-language templates: auto-detect project type (bash, node, python, rust, go) and customize
- Add `--safe` flag to scaffold for non-destructive mode
- ~~Improve slash command vs CLI confusion~~ ✅ Done
- Create onboarding guide in README
- Optimize CLI output for 3-line preview (user-critical info first, system details below)

**Issues Discovered (2026-01-10)**:
- ~~Constitution template assumes TypeScript projects~~ ✅ Fixed
- ~~Tech-stack template assumes Node.js/TypeScript~~ ✅ Fixed
- ~~`speckit analyze` tried as CLI command~~ ✅ Fixed
- Memory init is separate step (could be clearer in scaffold output)

**Deliverables**:
- `scripts/bash/speckit-scaffold.sh` - Add --safe mode and content detection
- `README.md` - Onboarding quickstart section
- Project type detection logic

**Verification Gate**:
- New user can run `speckit scaffold` without issues
- Templates match actual project technology
- No confusion between slash commands and CLI commands

**Estimated Complexity**: Low

---

### 0030 - Test Suite Completion

**Goal**: All CLI scripts have passing tests on macOS and Linux.

**Known Issues (from PROJECT-FINALIZATION.md)**:
- context.sh: Uses `declare -A` (bash 4.0+ only)
- feature.sh/tasks.sh: `get_repo_root` path resolution in test isolation
- claude-md.sh: macOS `head -n -1` syntax

**Scope**:
- Fix POSIX compatibility issues in scripts
- Fix test isolation issues
- Add missing test coverage
- Set up CI for cross-platform testing

**Deliverables**:
- All `tests/test-*.sh` files passing
- CI workflow in `.github/workflows/test.yml`
- POSIX-compliant scripts

**Verification Gate**:
- `./tests/test-runner.sh` passes all tests
- Tests pass on both macOS and Linux

**Estimated Complexity**: Medium

---

### 0040 - Integration Options

**Goal**: Support projects with existing documentation.

**Scope**:
- Import existing ADRs to `.specify/memory/adrs/`
- Reference existing architecture documents
- Link to existing API documentation
- Detect and offer integration for README, CONTRIBUTING, etc.

**Deliverables**:
- `speckit detect --docs` enhancement
- `speckit import adrs <path>` command
- Integration guide in docs

**Verification Gate**:
- Existing project docs are detected and integrated
- No loss of existing documentation

**Estimated Complexity**: Medium

---

### 0041 - Code Review Findings

**Goal**: Address code quality findings from systematic review (2026-01-11).

**Scope**:
- 36 approved findings across 7 categories
- Best Practices (6): Error handling, strict mode, code hygiene
- Refactoring (7): Extract large functions, reduce complexity
- Hardening (4): Input validation, cleanup traps, dependency checks
- Missing Features (3): Multi-runner gate support, backlog priorities
- Orphaned Code (4): Remove legacy scripts, fix stale references
- Over-Engineering (4): Simplify roadmap/state file complexity
- Outdated Docs (8): Fix placeholders, update references

**Review Document**: `.specify/reviews/review-20260111.md`

**User Stories**:
1. As a developer, I can trust the codebase follows best practices consistently
2. As a maintainer, I can navigate simplified, well-factored code
3. As a user, I find documentation that matches actual implementation

**Deliverables**:
- Fixed scripts in `scripts/bash/` (BP, RF, HD findings)
- Deleted legacy `check-prerequisites.sh`
- Updated documentation (README.md, CLAUDE.md, speckit.specify.md)
- Refactored `speckit-state.sh` and `speckit-roadmap.sh`
- Extended `speckit-gate.sh` with multi-runner support

**Verification Gate**:
- All 36 findings addressed or explicitly re-deferred with rationale
- No regressions in existing tests
- shellcheck passes on all modified scripts

**Estimated Complexity**: High (36 findings, multiple refactors)

---

### 0042 - Code Review 2026-01-11

**Goal**: Address code quality findings from systematic review.

**Scope**:
- 18 approved findings across 6 categories
- Best Practices (5): POSIX compliance, 4-digit phase consistency
- Refactoring (2): Doctor check abstraction, common.sh cleanup
- Hardening (3): Test runner error handling, temp file traps, ADR validation
- Missing Features (3): Gate/lessons dispatcher, memory doc context
- Orphaned Code (2): Remove no-op variable, clarify scripts structure
- Outdated Docs (3): README/CLAUDE.md updates

**Review Document**: `.specify/reviews/review-20260111.md`

**User Stories**:
1. As a developer, I can use POSIX-compliant scripts across bash versions
2. As a user, I see consistent 4-digit phase numbers everywhere
3. As a contributor, I find documentation that matches implementation

**Deliverables**:
- POSIX compatibility fixes (remove `declare -a`, `declare -A`)
- 4-digit phase number consistency in feature.sh, bin/speckit
- Gate and lessons commands in dispatcher
- Updated README.md and CLAUDE.md
- Temp file trap handlers where missing

**Verification Gate**:
- All 18 findings addressed
- No regressions in existing tests
- shellcheck passes on modified scripts

**Estimated Complexity**: Medium (18 findings)

---

### 0050 - UX Simplification

**Goal**: Reduce cognitive load and streamline the SpecKit user experience by consolidating entry points, removing orphaned code, and unifying similar commands.

**Source PDRs**:
- `pdr-ux-simplification.md` - SpecKit UX Simplification
- `pdr-ui-design-artifacts.md` - UI/UX Design Documentation

**Scope**:
- Delete orphaned scripts from `.specify/scripts/bash/`
- Remove `/speckit.issue` slash command (CLI works directly)
- Update documentation to recommend `/speckit.start` as primary entry
- Consolidate `/speckit.memory` and `/speckit.memory-init` into unified command
- Simplify state tracking to derive step completion from filesystem artifacts
- Update all handoffs to point to `/speckit.start`
- Add UI/UX design artifact generation to `/speckit.specify` and `/speckit.plan`
- Split CLAUDE.md: minimal pointer in CLAUDE.md + detailed `.specify/USAGE.md`

**User Stories**:
1. Single Entry Point: Users always start with `/speckit.start` and get routed correctly
2. Direct CLI for Simple Operations: Run `speckit issue create` directly without slash wrapper
3. Unified Memory Management: One command (`/speckit.memory`) with clear subcommands
4. Clean Codebase: Only active, used code in the repository
5. Filesystem-Derived State: SpecKit figures out where you are from files
6. UI Design Documentation: Visual UI phases auto-generate design.md with before/after mockups
7. Minimal CLAUDE.md: SpecKit adds ~10 lines to CLAUDE.md with pointer to detailed `.specify/USAGE.md`

**Deliverables**:

*Code Cleanup*:
- Delete `.specify/scripts/bash/{setup-plan.sh, update-agent-context.sh, create-new-feature.sh, common.sh}`
- Delete `commands/speckit.issue.md`
- Update `commands/speckit.memory.md` to handle generate subcommand
- Deprecate `commands/speckit.memory-init.md` with pointer to `/speckit.memory generate`
- Update `scripts/bash/speckit-status.sh` to derive state from filesystem

*Documentation (comprehensive)*:
- Update `README.md` - Recommend `/speckit.start` as THE entry point
- Update `CLAUDE.md` - Minimal SpecKit section (~10 lines) with pointer to `.specify/USAGE.md`
- Create `.specify/USAGE.md` - Full CLI reference, syntax notes, common patterns
- Update `speckit claude-md merge` to use minimal approach
- Update `docs/` folder (8 files): cli-reference, slash-commands, integration-guide, project-structure, configuration, troubleshooting, templates, COMMAND-AUDIT
- Update `bin/speckit` help text to recommend `/speckit.start`
- Update slash command handoffs (10 commands) to point to `/speckit.start`

*UI/UX Design Artifacts*:
- Update `commands/speckit.specify.md` - Add UI detection and design.md generation
- Update `commands/speckit.plan.md` - Add UI design verification
- Create `templates/ui-design-template.md` - Template for design.md
- Create `specs/XXXX/ui/design.md` structure (auto-generated for UI phases)

**Constraints** (from PDR):
- Must preserve all existing functionality
- Must maintain backward compatibility
- Must keep edge case handling already implemented
- Must NOT remove PDR system
- Must NOT break existing state files

**Non-Goals** (from PDR):
- Adding new features (pure simplification)
- Performance optimization
- Web UI changes
- Major architectural rewrites

**Verification Gate**:
- All orphaned scripts deleted (0 scripts in `.specify/scripts/bash/` that duplicate main scripts)
- `/speckit.issue` slash command removed, CLI documented
- `/speckit.memory generate` works (replaces memory-init)
- Documentation recommends `/speckit.start` as primary entry
- `speckit status --json` derives step completion from artifacts
- UI phases auto-generate `ui/design.md` with before/after/rationale sections
- CLAUDE.md SpecKit section ≤15 lines, `.specify/USAGE.md` exists with full reference

**Estimated Complexity**: Medium (7 stories, deletions + documentation + specify/plan updates)

---

### 0060 - Constitution Compliance

**Goal**: Remediate 92 compliance violations identified in comprehensive audit, achieving 95%+ constitution compliance.

**Source PDRs**:
- `pdr-compliance-remediation.md` - Constitution & Standards Compliance Remediation

**Scope** (from PDR audit):
- **Critical Fixes (P1)**: Fix LIB008 (phase command blocked), resolve TPL012 (duplicate templates)
- **Quick Wins (P2)**: Fix 6 hardcoded paths, 3 json.sh escaping issues, README errors, sed -i portability
- **Three-Line Rule**: Refactor 26 CLI functions to show status in first 3 lines
- **Command Alignment**: Add missing CLI commands, update slash commands to use correct CLIs
- **Template & Test Cleanup**: Sync templates to 4-digit ABBC, add missing test coverage

**User Stories** (from PDR):
1. CLI Output Clarity: See critical info in first 3 lines of every CLI output
2. Consistent Command Behavior: All state changes go through CLI commands
3. Working CLI Commands: Run `speckit phase` without errors
4. Single Template Source: One canonical location for templates

**Deliverables**:

*Critical Fixes*:
- Fix `bin/speckit:334` - remove 'phase' from slash-command warning
- Delete `.specify/templates/` (templates/ is canonical source)

*Hardcoded Paths*:
- Centralize SPECKIT_SYSTEM_DIR, SPECKIT_REGISTRY in common.sh
- Update speckit-doctor.sh, speckit-detect.sh, speckit-state.sh, speckit-templates.sh, speckit-scaffold.sh

*Three-Line Output Rule*:
- Create `print_summary()` helper enforcing status-first pattern
- Refactor 26 CLI functions (speckit-detect, gate, lessons, import, context, git, manifest, reconcile, templates, phase, roadmap, memory, migrate, pdr, scaffold, state)

*Command Alignment*:
- Remove deprecated script references from slash commands
- Update verify.md, backlog.md, phase.md, init.md to use CLI
- Add missing CLI commands if referenced

*POSIX Compliance*:
- Add platform detection for sed -i (macOS vs Linux)
- Add shopt -s extglob where needed

*Template Sync*:
- Update all templates to 4-digit ABBC phase format
- Remove duplicate templates

**Constraints** (from PDR):
- Must maintain backward compatibility
- All fixes must pass existing test suite
- Changes must follow constitution principles (meta-compliance)
- Must NOT break any existing CLI command behavior

**Non-Goals** (from PDR):
- Adding new features beyond fixing compliance
- Performance optimization
- Major refactoring beyond fixing violations
- Adding new test coverage beyond identified gaps

**Verification Gate**:
- `speckit phase` command works without errors (LIB008 fixed)
- All CLI commands show status in first 3 lines (three-line rule)
- Single template directory exists (templates/ only)
- All slash commands reference valid CLI commands
- Constitution compliance audit shows 95%+ overall score
- No hardcoded paths outside common.sh
- README.md documentation accurate

**Estimated Complexity**: High (92 issues across 93 files, 5 remediation categories)

---

## Milestone 1: Web Dashboard

> **Vision**: Visual dashboard for multi-project monitoring and agentic task execution.
> Local-first, CLI-integrated, with Claude Agent SDK for headless automation.

**Non-Goals** (explicit exclusions):
- No code editing (not an IDE)
- No team features (single-user only)
- No cloud sync (all data stays local)

**Technology Stack**:
- Next.js 14+ with App Router and API Routes
- Tailwind + shadcn/ui components
- SQLite for persistence (analytics, history, queue)
- Claude Agent SDK for agentic workflows
- pnpm monorepo structure

**Design Reference**: Linear (clean, fast, keyboard-driven)

---

### 1010 - Core UI Scaffold

**Goal**: Establish the dashboard foundation with routing, layout, and project list view.

**Scope**:
- Next.js project setup with TypeScript, Tailwind, shadcn/ui
- Monorepo structure: `packages/dashboard/`, `packages/shared/`
- `speckit dashboard` CLI command to start server
- Basic layout: sidebar navigation, header, main content area
- Project list view reading from `~/.speckit/registry.json`
- Dark mode with system-aware theme switching
- Keyboard shortcut foundation (command palette shell)

**User Stories**:
1. As a developer, I run `speckit dashboard` and see my projects listed
2. As a developer, I can toggle dark/light mode
3. As a developer, I can open command palette with Cmd+K

**Deliverables**:
- `packages/dashboard/` - Next.js app with basic routing
- `packages/shared/` - Shared TypeScript types
- `scripts/bash/speckit-dashboard.sh` - CLI launcher
- `bin/speckit` dispatcher integration

**Verification Gate**: **USER VERIFICATION REQUIRED**
- `speckit dashboard` starts server on localhost
- Project list shows all registered projects
- Dark mode toggle works
- Command palette opens with Cmd+K

**Estimated Complexity**: Medium (new codebase, foundational)

---

### 1020 - Real-Time File Watching

**Goal**: Live updates when SpecKit state files change on disk.

**Scope**:
- File watcher using chokidar (native fs events with polling fallback)
- WebSocket server for pushing updates to UI
- Watch `~/.speckit/registry.json` for project changes
- Watch `<project>/.specify/orchestration-state.json` for state changes
- Debounced updates to prevent flicker
- Connection status indicator in UI

**User Stories**:
1. As a developer, when I run `speckit state set` in terminal, the dashboard updates immediately
2. As a developer, I see connection status (connected/reconnecting)
3. As a developer, new projects appear automatically when registered

**Deliverables**:
- `packages/dashboard/src/lib/watcher.ts` - File watcher service
- WebSocket endpoint in API routes
- React hooks for real-time subscriptions
- Connection status component

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Run `speckit state set orchestration.phase.status=complete` and see UI update within 2 seconds
- Disconnect/reconnect shows status indicator
- No duplicate updates or flickering

**Estimated Complexity**: Medium

---

### 1030 - Project Detail Views

**Goal**: Rich project views with multiple visualization modes.

**Scope**:
- Project detail page with tabbed navigation
- **Status Card View**: Current phase, health score, quick actions
- **Kanban Board View**: Tasks as cards in columns (todo/in-progress/done)
- **Timeline View**: Phases on timeline with progress indicators
- View mode switcher (persisted in localStorage)
- Drill-down from project list to detail

**User Stories**:
1. As a developer, I click a project and see its current status at a glance
2. As a developer, I can switch between Kanban and Timeline views
3. As a developer, I see tasks organized by status in Kanban view

**Deliverables**:
- `/app/projects/[id]/page.tsx` - Project detail route
- Status card component with health indicators
- Kanban board component with drag-drop (optional)
- Timeline/Gantt component for phases
- View mode toggle with persistence

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Project detail shows current phase and task summary
- Kanban view displays tasks in correct columns
- Timeline view shows phase progression
- View preference persists across sessions

**Estimated Complexity**: Medium-High

---

### 1040 - CLI Actions from UI

**Goal**: Trigger SpecKit CLI commands from the dashboard.

**Scope**:
- API routes that shell out to `speckit` CLI commands
- Mark task complete/incomplete
- Update phase status
- Add backlog items
- Run `speckit` commands with output streaming
- Error handling and user feedback
- Keyboard shortcuts for common actions

**User Stories**:
1. As a developer, I can mark a task complete from the dashboard
2. As a developer, I can add an item to backlog without switching to terminal
3. As a developer, I see command output in a modal/drawer
4. As a developer, I can use keyboard shortcuts (e.g., `t` to toggle task)

**Deliverables**:
- API routes for task/phase/backlog operations
- Action buttons in project detail views
- Command output modal with streaming
- Keyboard shortcut bindings
- Toast notifications for action results

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Click task checkbox, task status updates in UI and on disk
- Add backlog item, appears in ROADMAP.md
- Keyboard shortcut `t` toggles selected task
- Errors show helpful messages

**Estimated Complexity**: Medium

---

### 1050 - Agent SDK Integration

**Goal**: Spawn Claude Agent SDK sessions from the dashboard for headless task execution.

**Scope**:
- Claude Agent SDK integration for agentic workflows
- Hybrid control: user chooses supervision level per task
  - **Supervised**: Agent proposes, user approves
  - **Autonomous**: Agent executes, user monitors
- Agent spawn with task context injection
- Real-time log streaming via WebSocket
- Agent queue with unlimited concurrent sessions (queue-based)
- Interactive mode: agent can ask questions, user responds via dashboard
- Session management: cancel, pause, resume (if supported)

**User Stories**:
1. As a developer, I click "Implement" on a task and choose supervision level
2. As a developer, I see agent progress in real-time (tool calls, outputs)
3. As a developer, I can answer agent questions from the dashboard
4. As a developer, I can queue multiple tasks for sequential execution
5. As a developer, I can cancel a running agent session

**Deliverables**:
- Agent SDK wrapper service in `packages/dashboard/src/lib/agent.ts`
- Agent spawn API route with context injection
- Real-time log streaming component
- Agent queue manager with SQLite persistence
- Interactive prompt/response UI
- Session controls (cancel, view history)

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Click "Implement" on task, agent starts working
- See real-time tool calls in log viewer
- Answer agent question via dashboard, agent continues
- Queue 3 tasks, they execute in order
- Cancel button stops running agent

**Estimated Complexity**: High

---

### 1060 - Operations Dashboard

**Goal**: Full visibility into agent queue, resource usage, and system health.

**Scope**:
- **Queue View**: All pending/running/completed agent sessions
- **Activity Feed**: Real-time stream of agent actions across all sessions
- **Resource Monitor**: CPU/memory for running agents, API rate limits
- Desktop notifications for agent completion/errors
- Filter and search across agent history

**User Stories**:
1. As a developer, I see all queued and running agent sessions at a glance
2. As a developer, I get notified when an agent completes or errors
3. As a developer, I can filter activity feed by project or status
4. As a developer, I see resource usage for running agents

**Deliverables**:
- Operations page `/app/operations/page.tsx`
- Agent queue list component
- Activity feed with real-time updates
- Resource usage indicators
- Desktop notification integration (Notification API)
- Filter/search controls

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Operations view shows all agent sessions with status
- Desktop notification appears when agent completes
- Activity feed updates in real-time
- Resource indicators show CPU/memory usage

**Estimated Complexity**: Medium

---

### 1070 - Cost Analytics

**Goal**: Track and visualize Claude API costs across sessions and projects.

**Scope**:
- Token usage tracking per agent session
- Cost calculation based on model pricing
- **Per-session costs**: Input/output tokens, total cost
- **Project totals**: Aggregate costs over time
- **Trends/projections**: Cost charts, burn rate
- SQLite storage for historical data
- Export functionality (CSV/JSON)

**User Stories**:
1. As a developer, I see how much each agent session cost
2. As a developer, I see total spending per project this month
3. As a developer, I see cost trends over time
4. As a developer, I can export cost data for expense reports

**Deliverables**:
- Analytics page `/app/analytics/page.tsx`
- Token tracking in agent service
- Cost calculation utilities
- Chart components (line, bar, pie)
- SQLite schema for cost history
- Export API routes

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Session details show token counts and cost
- Project page shows total costs
- Analytics page shows cost trends over time
- Export produces valid CSV/JSON

**Estimated Complexity**: Medium

---

## Backlog

> All deferred scope and new ideas live here. Reviewed at end of each phase.
> Run `/speckit.backlog` to triage items into future phases.

| Item | Description | Priority | Notes |
|------|-------------|----------|-------|
| Story-Based Orchestration | Execute user stories independently with MVP checkpoints | Medium | Deferred from Phase 0050 - current workflow works well |
| Parallel phase execution | Run independent phases concurrently | Low | Requires dependency graph |
| Team collaboration | Multi-user roadmap editing, conflict resolution | Low | Future vision |
| [RF001] Refactor speckit-roadmap.sh | Large file (1425 lines) - extract subcommands | Low | Deferred from review 2026-01-11 |
| [RF002] Extract scaffold templates | Move inline templates to separate files | Low | Deferred from review 2026-01-11 |
| [OE001] Scaffold type templates | Simplify project-type-specific templates | Low | Deferred from review 2026-01-11 |
| [OE002] Manifest versioning | Consider simplifying manifest complexity | Low | Deferred from review 2026-01-11 |

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
2. Document deferred items in Backlog section above
3. Create a hotfix phase (e.g., 2021) for critical items
4. Prioritize verification gate requirements

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

### Inserting Urgent Work
```bash
speckit roadmap insert --after 0020 "Urgent Bug Fixes"
# Creates phase 0021
```

### Deferring Work
```bash
speckit roadmap defer 0040 --reason "Deprioritized after user testing"
# Moves to Backlog section
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Note completion date
3. If USER GATE: get explicit user verification before proceeding

---

## Migration Notes

### v2.0 → v2.1 Migration
Existing roadmaps with 001/002/003 numbering should be migrated:
```bash
speckit migrate roadmap
```

Conversion: `0AB` → `00A0` (milestone 0 by default)
- 001 → 0010
- 002 → 0020
- 003 → 0030

Branch names remain unchanged (branches use short names, not phase numbers).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-10 | Initial roadmap (v2.0, 001-005 numbering) |
| 2026-01-10 | Migrated to v2.1 ABBC numbering, added Phase 0010 (Roadmap Flexibility) |
| 2026-01-10 | Backlog triage: created 0015 (Workflow Commands), promoted items to 0020 |
| 2026-01-11 | Added Phase 0041 (Code Review Findings) - 36 findings from /speckit.review |
| 2026-01-11 | Added Phase 0042 (Code Review 2026-01-11) - 18 findings from /speckit.review |
| 2026-01-11 | Added modular ROADMAP: speckit phase, speckit issue, speckit roadmap renumber, /speckit.merge auto-archive |
| 2026-01-11 | Added Phase 0050 (UX Simplification) from pdr-ux-simplification.md |
| 2026-01-11 | Added UI Design Artifacts to Phase 0050 from pdr-ui-design-artifacts.md |
| 2026-01-11 | Phase 0050 completed - UX Simplification merged |
| 2026-01-11 | Added Phase 0060 (Constitution Compliance) from pdr-compliance-remediation.md |
| 2026-01-12 | Expanded Milestone 1 via interview: 1010-1070 (Core UI → Cost Analytics), Agent SDK integration, Linear aesthetic |
