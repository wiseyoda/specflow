# Completed Phases

> Archive of completed development phases. Newest first.

---

## 1053 - Workflow-Session Unification

**Completed**: 2026-01-20

> **Architecture Context**: See [PDR: Workflow Dashboard Orchestration](../../memory/pdrs/workflow-dashboard-orchestration.md) for holistic architecture, design decisions, and how this phase fits into the larger vision.

### 1053 - Workflow-Session Unification

**Goal**: Unify workflows and Claude sessions as the same concept, fixing session detection on workflow start.

**Context**: Phase 1052 implemented the Session Viewer UI, but session detection has race conditions. The core issue is that workflows and sessions are treated as separate concepts when they're fundamentally the same thing - a Claude conversation. This phase unifies them architecturally.

**Problem Statement:**
1. Workflows stored in `~/.specflow/workflows/{execution_id}.json` (global)
2. Sessions stored in `~/.claude/projects/{hash}/{session_id}.jsonl` (Claude's storage)
3. Session ID only available AFTER first Claude turn completes with current implementation
4. Polling `sessions-index.json` has race conditions with multiple sessions

**Scope:**

1. **Architectural Unification**
   - Workflow = Session = Claude conversation (same concept)
   - Single source of truth for workflow/session state
   - Store workflow metadata in project: `.specflow/workflows/{session_id}/`
   - Link directly to Claude's JSONL files

2. **Immediate Session Detection**
   - Capture session ID when Claude CLI starts (not after first turn)
   - Options to explore:
     a. Parse `sessions-index.json` immediately (Claude updates on CLI start)
     b. Use `claude --context --output-format json` to query active session
     c. Match workflow start time to session `created` timestamp precisely
     d. Use `firstPrompt` field in index to match our skill prompt signature or use execution_id as first thing we say to claude as it shows in the index.
   - Eliminate race conditions with multiple sessions

3. **Workflow/Session History**
   - List all workflow/sessions for a project (new tab in details)
   - View any past session's messages
   - Resume capability for all sessions (inclusive of waiting for input), user may want to follow up with any session to keep the conversation going.
   - Storage: `.specflow/workflows/{session_id}/metadata.json` -> should link claude session id and path to JSONL when discovered

4. **Session Viewer Integration**
   - Update Session Viewer to use unified model
   - Show session detail table -> session in drawer
   - Quick switch between sessions
   - Clear indication of which session is "active"

**Technical Investigation Required:**

```bash
# Test: Does sessions-index.json update immediately on CLI start?
# Watch file while starting a new session
fswatch ~/.claude/projects/-Users-*/sessions-index.json &
claude -p "test" --output-format json

# Test: Can we match by firstPrompt?
cat ~/.claude/projects/-Users-*/sessions-index.json | jq '.entries[] | {sessionId, firstPrompt}'

# Test: Does --context show active session?
claude --context --output-format json
```

**Proposed Data Model:**

```
.specflow/workflows/
├── {session_id_1}/
│   ├── metadata.json      # Workflow state, skill, status, answers
│   └── → symlink or reference to ~/.claude/projects/{hash}/{session_id}.jsonl
├── {session_id_2}/
│   └── metadata.json
└── index.json             # Quick lookup: [{sessionId, skill, status, startedAt}]
```

**API Changes:**
- GET `/api/workflow/list?projectId=<id>` - Include sessionId in response
- GET `/api/session/history?projectPath=<path>` - List all sessions for project
- POST `/api/workflow/start` - Return sessionId immediately (within 2s of start)

**UI Components:**
- Update `SessionViewerDrawer.tsx` to correctly link to the clicked on session
- Update `useWorkflowExecution.ts` - Include sessionId immediately
- New `SessionHistoryList.tsx` - List of past sessions

**What This Phase Does NOT Include:**
- Full session replay/playback
- Session comparison
- Export/archive sessions
- Session search

**Dependencies:**
- Phase 1052 (Session Viewer UI - provides the viewing infrastructure)

**Verification Gate: USER**
- [ ] Start workflow → Session ID available within 2 seconds
- [ ] Session Viewer shows correct session immediately
- [ ] Can view history of past workflow sessions
- [ ] No race conditions when starting multiple workflows sequentially

**Estimated Complexity**: Medium-High (architectural change)

**Known Risks:**
- Claude's `sessions-index.json` format may change
- Need to handle edge cases (CLI crashes, network issues)
- Migration of existing workflow data

---

## 1052 - Session Viewer

**Completed**: 2026-01-19

> **Architecture Context**: See [PDR: Workflow Dashboard Orchestration](../../memory/pdrs/workflow-dashboard-orchestration.md) for holistic architecture, design decisions, and how this phase fits into the larger vision.

### 1052 - Session Viewer

**Goal**: View agent progress in real-time via session JSONL parsing.

**Context**: Users want to see what Claude is doing during workflows. This phase adds a session viewer that parses Claude's JSONL transcripts.

**Scope:**

1. **Parse Claude Session JSONL Files**
   - Location: `~/.claude/projects/{hash}/{session}.jsonl`
   - Extract: messages, tool calls, results
   - Handle large files with streaming/pagination
   - Real-time tailing for active sessions

2. **Session Viewer Slide-out Panel**
   - Opens from project detail (per user preference)
   - Shows current/recent session
   - Formatted message display:
     - User messages
     - Assistant messages (summarized for readability)
     - Tool calls (name only, details collapsed)
   - Auto-scroll with "pause on scroll up" behavior

3. **Active Session Detection**
   - Link workflow sessionId to JSONL file
   - Hash calculation matches Claude Code's method
   - Highlight currently executing session in list

4. **Basic Progress Indicators**
   - Files modified count (from tool calls)
   - Tasks completed (if visible in output)
   - Time elapsed since session start

**Technical Notes:**
- Hash for project path: Same algorithm as Claude Code uses
- JSONL parsing: Stream line-by-line for large files
- Consider using `tail -f` equivalent for real-time updates
- Message formatting: Show key info, collapse verbose tool params

**UI Components:**
- `packages/dashboard/src/lib/session-parser.ts` - JSONL parser
- `SessionViewerPanel.tsx` - Slide-out panel container
- `SessionMessage.tsx` - Individual message formatter
- `SessionProgress.tsx` - Progress indicators

**API Routes:**
- GET `/api/session/content?path=<path>&tail=<lines>` - Stream session content
- GET `/api/session/list?projectPath=<path>` - List sessions for project

**What Was Removed (from original 1052):**
- Step-by-step progress visualization - Too complex for MVP
- Post-workflow summary view - Can add later
- Full retry/error display - Covered in 1055

**Dependencies:**
- Phase 1051 (question context for follow-up)

**Verification Gate: USER**
- [x] Open session viewer from project detail
- [x] See formatted messages from active session
- [x] Content streams in real-time during workflow
- [x] See files modified and time elapsed

**Estimated Complexity**: Medium

---

## Completion Notes (2026-01-19)

**What Was Implemented:**
- Session Viewer slide-out panel with Sheet component
- JSONL parser extracting user/assistant messages (filtering tool calls)
- Auto-scroll with pause-on-scroll-up behavior
- Progress indicators (elapsed time, files modified)
- Session button in project header
- API routes: `/api/session/content`, `/api/session/active`
- Hash calculation matching Claude Code's method (path with slashes → dashes)

**Known Limitation - Deferred to Phase 1053:**
- Session detection has race conditions when workflow starts
- Session ID only reliably available after first Claude turn completes
- Polling `sessions-index.json` can pick up wrong session in edge cases
- Phase 1053 will unify workflow/session architecture to fix this properly

**Files Created:**
- `packages/dashboard/src/lib/project-hash.ts`
- `packages/dashboard/src/lib/session-parser.ts`
- `packages/dashboard/src/app/api/session/content/route.ts`
- `packages/dashboard/src/app/api/session/active/route.ts`
- `packages/dashboard/src/hooks/use-session-messages.ts`
- `packages/dashboard/src/components/projects/session-viewer-drawer.tsx`
- `packages/dashboard/src/components/projects/session-message.tsx`
- `packages/dashboard/src/components/ui/scroll-area.tsx`

---

## 1051 - Questions & Notifications

**Completed**: 2026-01-19

> **Architecture Context**: See [PDR: Workflow Dashboard Orchestration](../../memory/pdrs/workflow-dashboard-orchestration.md) for holistic architecture, design decisions, and how this phase fits into the larger vision.

### 1051 - Questions & Notifications

**Goal**: Excellent question answering UX with browser notifications.

**Context**: When workflows need user input, users should be notified immediately and have a smooth experience answering questions.

**Scope:**

1. **Browser Notification API Integration**
   - Request permission on first workflow start
   - Show notification when questions pending
   - Notification content: "Project X needs your input"
   - Click notification focuses dashboard tab
   - Respect browser notification settings

2. **Question Badge on Project Cards**
   - Yellow dot with question count
   - Visible on project list view
   - Clickable to open project detail

3. **Question Badge in Project Detail Header**
   - Badge next to project name
   - Click opens question drawer

4. **Question Drawer Panel (Slide from Right)**
   - Reuse UI patterns from POC debug page
   - Support all question types:
     - Single-select (radio buttons)
     - Multi-select (checkboxes)
     - Free-form text input
   - Submit button with loading state
   - Clear visual hierarchy

5. **Free-form Follow-up Input**
   - Text area at bottom of drawer
   - "Send message" button
   - Continues session with custom text (not structured answer)
   - Useful for clarifications or additional context

**UI Components:**
- `packages/dashboard/src/lib/notifications.ts` - Browser API wrapper
- `QuestionDrawer.tsx` - Slide-out panel
- `QuestionBadge.tsx` - Badge component
- `QuestionList.tsx` - Question rendering (reuse POC patterns)
- `FollowUpInput.tsx` - Free-form text input

**Dependencies:**
- Phase 1050 (workflow status UI)

**Verification Gate: USER**
- [ ] Browser asks for notification permission
- [ ] Desktop notification appears when questions pending
- [ ] Question badge visible on project card
- [ ] Click badge opens drawer, answer question, workflow continues
- [ ] Send free-form follow-up text, session continues

**Estimated Complexity**: Medium

---

## 1050 - Workflow UI

**Completed**: 2026-01-19

> **Architecture Context**: See [PDR: Workflow Dashboard Orchestration](../../memory/pdrs/workflow-dashboard-orchestration.md) for holistic architecture, design decisions, and how this phase fits into the larger vision.

### 1050 - Workflow UI Integration

**Goal**: Surface workflow execution in the main dashboard UI.

**Context**: With the foundation in place (1048), this phase adds UI components to start and monitor workflows from the dashboard.

**Scope:**

1. **Start Workflow Entry Points**
   - "Start Workflow" in project card actions dropdown
   - "Start Workflow" button in project detail header
   - Both locations (per user preference)

2. **Skill Picker**
   - Dropdown component with available skills:
     - /flow.design
     - /flow.analyze
     - /flow.implement
     - /flow.verify
     - /flow.orchestrate
     - /flow.merge
   - Optional: skill description on hover

3. **Status Indicators on Project Cards**
   - Running: spinner icon
   - Waiting for input: yellow badge with "?"
   - Completed: green check (fades after 30s)
   - Failed: red x icon

4. **Project Detail Sidebar**
   - Current workflow status
   - Skill being executed
   - Time elapsed
   - Quick link to answer questions (if waiting)

**UI Components:**
- `WorkflowSkillPicker.tsx` - Dropdown to select skill
- `StartWorkflowDialog.tsx` - Confirmation dialog before starting
- `WorkflowStatusBadge.tsx` - Status indicator for cards
- Integration with existing ProjectCard actions
- Integration with ProjectDetail header

**What Was Removed (from original 1050):**
- Stream-json mode - Polling works fine
- SSE streaming - Can add later if needed
- SQLite storage - Files work fine
- Complex multi-project queue management - Simplified

**Dependencies:**
- Phase 1048 (API routes)

**Verification Gate: USER**
- [ ] Start workflow from project card actions menu
- [ ] Start workflow from project detail header
- [ ] See skill picker with all /flow.* options
- [ ] See status badge update as workflow progresses

**Estimated Complexity**: Medium

---

## 1048 - Workflow Foundation

**Completed**: 2026-01-19

> **Architecture Context**: See [PDR: Workflow Dashboard Orchestration](../../memory/pdrs/workflow-dashboard-orchestration.md) for holistic architecture, design decisions, and how this phase fits into the larger vision.

### 1048 - Workflow Foundation

**Goal**: Productionize the POC executor and integrate with the project system.

**Context**: The POC at `/debug/workflow` (commit 5dc79dd) proves the core approach works. This phase refactors it into production-grade code.

**Scope:**

1. **Refactor Executor to Service**
   - Move `/lib/workflow-executor.ts` to `/lib/services/workflow-service.ts`
   - Add proper TypeScript types and error handling
   - Keep file-based persistence (proven in POC)
   - Keep polling approach (proven reliable)

2. **Project Integration**
   - Add `projectId` to `WorkflowExecution` interface
   - Link executions to registered dashboard projects
   - Store state in `~/.specflow/workflows/` (not workflow-debug)

3. **Production API Routes**
   - POST `/api/workflow/start` - Start workflow (projectId, skill)
   - GET `/api/workflow/status?id=<id>` - Get execution status
   - GET `/api/workflow/list?projectId=<id>` - List executions for project
   - POST `/api/workflow/answer` - Submit answers and resume
   - POST `/api/workflow/cancel?id=<id>` - Cancel running workflow

4. **Error Handling**
   - Timeout handling (configurable, default 10 minutes)
   - Process cleanup on failure
   - Structured error responses

**Technical Details:**
- Keep exact CLI invocation pattern from POC:
  ```
  claude -p --output-format json \
    --dangerously-skip-permissions \
    --disallowedTools "AskUserQuestion" \
    --json-schema "<schema>" \
    < prompt.txt > output.json
  ```
- Resume pattern: `claude -p --resume "<session_id>" ...`
- State file format: JSON with WorkflowExecution interface

**Deliverables:**
- `packages/dashboard/src/lib/services/workflow-service.ts`
- `packages/dashboard/src/app/api/workflow/start/route.ts`
- `packages/dashboard/src/app/api/workflow/status/route.ts`
- `packages/dashboard/src/app/api/workflow/list/route.ts`
- `packages/dashboard/src/app/api/workflow/answer/route.ts`
- `packages/dashboard/src/app/api/workflow/cancel/route.ts`
- Tests for workflow service

**What Was Removed (from original 1048):**
- CLI commands (`specflow workflow implement --group`) - Dashboard handles this
- Task group format changes to tasks.md - Use existing ## headers
- JSON streaming events - Polling sufficient

**Verification Gate: USER**
- [ ] Start workflow for a registered project via API
- [ ] See execution linked to correct project
- [ ] Cancel running workflow
- [ ] List all executions for a project

**Estimated Complexity**: Medium

---

## 1047 - Workflow Decomposition: Design

**Completed**: 2026-01-19

### 1047 - Workflow Decomposition: Design Phase

**Goal**: Create CLI commands that wrap Claude Code skill execution for dashboard automation of the design workflow.

**Current State (3.0)**:
- `/flow.design` skill exists with phases: DISCOVER → SPECIFY → UI DESIGN → PLAN → TASKS → CHECKLISTS
- `specflow check --gate design` validates design artifacts
- `specflow status --json` provides project context
- Skills are designed for interactive Claude Code sessions, not programmatic invocation

**Scope**:
- Create `specflow workflow design` CLI command that:
  - Spawns Claude Code with `/flow.design` skill
  - Streams progress events via JSON
  - Queues questions for async answering
  - Returns structured completion status
- Create `specflow workflow discover` for just the DISCOVER phase (optional entry point)
- Add `--phase` flag to run specific design phases: `--phase specify`, `--phase plan`, etc.
- Ensure each phase stays under 200k context window

**User Stories**:
1. As a dashboard, I run `specflow workflow design --json` and receive streaming progress
2. As a dashboard, I see questions queued in JSON output and can respond via `specflow workflow answer`
3. As a dashboard, I can run just `specflow workflow design --phase plan` to regenerate the plan
4. As a developer, the CLI works the same as running `/flow.design` directly

**Deliverables**:
- `specflow workflow design` command with:
  - `--json` streaming output (events: started, phase_complete, question, error, complete)
  - `--phase <name>` to run specific phase only
  - Returns: artifacts_created, questions_pending, errors
- `specflow workflow answer <question-id> <answer>` for async question handling
- `specflow workflow status` to check running workflows
- Documentation for dashboard integration

**Dependencies**:
- Claude Code CLI `--stream-json` or equivalent for programmatic control
- Process management for background execution (see phase 1050)

**Verification Gate**: Technical
- `specflow workflow design` produces same artifacts as `/flow.design`
- JSON output includes all progress events
- Questions can be answered asynchronously
- Context stays under 200k per phase

**Estimated Complexity**: High

---

## 1046 - Command JSON Output

**Completed**: 2026-01-18

### 1046 - Command JSON Output

**Goal**: Standardize JSON output across all SpecFlow CLI commands to enable programmatic control from the dashboard.

**Scope**:
- Define comprehensive JSON output schema for command results
- Add `--json` flag to all existing CLI commands
- Standardize output structure: status, changes, artifacts, errors, next_step
- Ensure backward compatibility (text output remains default)
- Document JSON schema in memory docs

**User Stories**:
1. As a dashboard, I call `specflow doctor --json` and parse structured results
2. As a dashboard, I get consistent error format across all commands
3. As a developer, I can pipe command output to jq for scripting
4. As a dashboard, I know what files changed and what to do next

**Deliverables**:
- JSON output schema definition in `.specify/memory/`
- `--json` flag added to: doctor, init, scaffold, state, phase, roadmap, tasks
- Consistent output structure:
  ```json
  {
    "status": "success|error|warning",
    "command": "doctor",
    "changes_made": [...],
    "artifacts_created": [...],
    "errors": [...],
    "warnings": [...],
    "next_step": "suggested next command",
    "summary": "human-readable summary"
  }
  ```
- Tests for JSON output parsing

**Verification Gate**: Technical
- All commands support `--json` flag
- JSON output is valid and parseable
- Schema is documented
- Existing text output unchanged

**Estimated Complexity**: Medium

---

## 0082 - Code Review 20260118

**Completed**: 2026-01-18

# Phase 0082: Code Review 20260118

**Created**: 2026-01-18
**Status**: In Progress
**Source**: `.specify/reviews/review-20260118-115354.md`

## Goal

Implement 59 approved findings from the full codebase review to improve code quality, security, and maintainability.

## Scope

| Category | Count | Focus |
|----------|-------|-------|
| Best Practices (BP) | 8 | Error handling, type safety |
| Refactoring (RF) | 11 | Code organization, DRY |
| Hardening (HD) | 14 | Security, validation, race conditions |
| Missing Features (MF) | 7 | Complete incomplete implementations |
| Orphaned Code (OC) | 9 | Remove dead code |
| Outdated Docs (OD) | 10 | Update documentation |

**Total Effort Points**: 107
**High Severity Items**: RF003 (health.ts 213 lines), OC007 (18k deprecated bash)

## Deliverables

- [ ] All BP findings implemented (error handling improvements)
- [ ] All RF findings implemented (code refactoring)
- [ ] All HD findings implemented (security hardening)
- [ ] All MF findings implemented (complete features)
- [ ] All OC findings implemented (dead code removed)
- [ ] All OD findings implemented (docs updated)

## Verification Gate

- All 59 approved findings from review are addressed
- Tests pass after refactoring
- No new linting errors introduced
- Documentation reflects current CLI behavior

---

## Notes

- 13 Over-Engineering (OE) findings deferred to BACKLOG.md for user validation
- Review identified ~25,000 lines analyzed across 50+ files
- Priority: High severity items RF003 and OC007 first


---

## 1045 - Project Actions & Health

**Completed**: 2026-01-18

Phase completed without detailed phase file.

---


## 0080 - cli-typescript-migration

**Completed**: 2026-01-18

### 0080 - CLI TypeScript Migration

**Goal**: Migrate 24 bash scripts (~18k lines) to 5 smart TypeScript commands, reducing CLI calls from 50-100 per phase to 10-15.

**Scope**:
- Create 5 smart TypeScript CLI commands: status, next, mark, check, state
- Build parsing libraries for tasks.md, ROADMAP.md, checklists
- Implement hybrid dispatcher for TypeScript + bash fallback
- Return rich, contextual JSON data per call
- Maintain backward compatibility during migration

**User Stories**:
1. As Claude, I get complete project status in a single `specflow status --json` call
2. As Claude, I get next actionable item with full context via `specflow next --json`
3. As Claude, I mark items complete and get updated state via `specflow mark T001`
4. As Claude, I run deep validation with auto-fix via `specflow check --fix`
5. As Claude, I access low-level state via `specflow state get/set` (escape hatch)

**Deliverables**:
- TypeScript CLI in packages/cli with Commander.js
- Parsing libraries: tasks.ts, roadmap.ts, checklist.ts, context.ts, health.ts
- 5 commands: status, next, mark, check, state (state complete)
- Hybrid bin/specflow dispatcher
- >80% test coverage

**Verification Gate**: Technical
- `specflow status --json` returns phase, step, progress, health, next_action
- `specflow next --json` returns next unblocked task with dependencies
- `specflow mark T001` modifies tasks.md and returns updated progress
- `specflow check --json` validates project with actionable output
- Hybrid dispatcher routes correctly to TypeScript or bash

**Estimated Complexity**: High

---


## 0076 - Command Rebrand

**Completed**: 2026-01-17 - Rebrand to SpecFlow

**Goal**: Complete rebrand from SpecFlow to **SpecFlow** (Agentic Orchestration based on SpecFlow). Rename CLI, commands, repository, and all documentation. Clean break with no deprecation stubs.

**Scope**:
- Rename GitHub repository to `specflow`
- Rename CLI binary from `specflow` to `specflow`
- Rename all command files from `specflow.*.md` to `flow.*.md`
- Update all command content to reference `/flow.*`
- Update all bash scripts (`bin/specflow` → `bin/specflow`)
- Update CLAUDE.md with new branding and command names
- Update all documentation (README, commands-analysis, memory docs)
- Update dashboard/website references
- Update install.sh for new binary name
- Clean break: delete all old files, no deprecation stubs

**Commands After Rebrand**:

| New Name | Role |
|----------|------|
| `/flow.init` | Complete project setup |
| `/flow.memory` | Memory health: verify, reconcile, promote |
| `/flow.roadmap` | Roadmap ops: update, add-pdr, backlog |
| `/flow.orchestrate` | Master workflow controller |
| `/flow.design` | Create all design artifacts |
| `/flow.analyze` | Pre-implement alignment check |
| `/flow.implement` | Execute tasks |
| `/flow.verify` | Post-implement completion check |
| `/flow.merge` | Git operations |
| `/flow.review` | Code review |

**Total: 10 commands** (down from original 20)

**User Stories**:
1. As a new user, I run `specflow` CLI and see `/flow.*` commands - immediately clear it's workflow-driven
2. As a documentation reader, I see consistent SpecFlow branding everywhere
3. As a developer, I type `specflow` instead of `specflow` - shorter mental model

**Deliverables**:
- [ ] Rename GitHub repository to `specflow`
- [ ] Rename `bin/specflow` → `bin/specflow`
- [ ] Update all bash scripts to reference `specflow` binary
- [ ] Rename all `commands/specflow.*.md` → `commands/flow.*.md`
- [ ] Update all command file content to reference `/flow.*`
- [ ] Update CLAUDE.md: branding, commands, binary name
- [ ] Update `docs/commands-analysis.md`
- [ ] Update README.md with SpecFlow branding
- [ ] Update install.sh for new binary name
- [ ] Update any memory documents with command/binary references
- [ ] Update dashboard/website references
- [ ] Delete all old `specflow.*` files (clean break)
- [ ] Verify: `grep -r "specflow" .` returns 0 results in active code

**Verification Gate**: Technical
- `specflow help` works
- All commands accessible via `/flow.*` prefix
- No `specflow` references in active code/documentation
- Dashboard/website shows SpecFlow branding

**Dependencies**:
- Phase 0070 (Pre-Workflow Consolidation) - must complete first
- Phase 0072 (Workflow Consolidation) - must complete first

**Estimated Complexity**: Medium (lots of files, but straightforward renames)

---


## 0072 - Workflow Consolidation

**Completed**: 2026-01-17 - Workflow Commands Consolidation

**Goal**: Reduce 11 workflow commands to 6, with a single design command that creates all artifacts and inline clarification.

**Scope**:
- Create `/speckit.design` to produce spec.md, plan.md, tasks.md, and checklists in sequence
- Move clarify behavior inline into orchestrate (ask questions as needed)
- Move `/speckit.backlog` to `/speckit.roadmap backlog` subcommand
- Deprecate: specify, clarify, plan, tasks, checklist, backlog
- Audit and simplify command flags (remove unused flags)
- Keep: orchestrate, analyze, implement, verify, merge

**Commands Before → After**:

| Before | After |
|--------|-------|
| orchestrate, specify, clarify, plan, tasks, analyze, checklist, implement, verify, merge, backlog | orchestrate, design, analyze, implement, verify, merge |

**Workflow Phases**:
```
design → analyze (pre-implement) → implement → verify (post-implement) → merge
```

**User Stories**:
1. As a developer, I run `/speckit.design` and get all my planning artifacts at once
2. As a developer, Claude asks me clarifying questions inline as it works (no separate step)
3. As a developer, I use `/speckit.roadmap backlog` to manage deferred items
4. As an existing user, I see deprecation notices guiding me to new commands

**Deliverables**:
- [ ] `/speckit.design` created: produces spec → plan → tasks → checklists sequentially
- [ ] `/speckit.design` supports `--plan`, `--tasks`, etc. flags for partial regeneration
- [ ] `/speckit.orchestrate` updated: inline clarify behavior, 5-phase workflow
- [ ] `/speckit.roadmap` expanded: add `backlog` subcommand
- [ ] Deprecation stubs for: specify, clarify, plan, tasks, checklist, backlog
- [ ] Command flag audit: document all flags, remove unused ones
- [ ] Updated `docs/commands-analysis.md`
- [ ] Updated CLAUDE.md command documentation

**Verification Gate**: Technical
- `/speckit.design` produces all 4 artifact types in sequence
- Inline clarify works during orchestrate (questions asked in context)
- `/speckit.roadmap backlog` manages deferred items correctly
- Deprecated commands show helpful redirect messages
- Existing projects continue to work
- No functionality lost in consolidation

**Dependencies**:
- Phase 0070 (Pre-Workflow Consolidation) should complete first for clean namespace

**Estimated Complexity**: Medium-High

---


## 0070 - Pre-Workflow Consolidation

**Completed**: 2026-01-17 - Pre-Workflow Commands Consolidation

**Goal**: Reduce 7 pre-workflow commands to 3, with clear separation between one-time setup and ongoing utilities.

**Scope**:
- Consolidate `/speckit.init` to handle complete project setup flow
- Reduce `/speckit.memory` to verify/reconcile/promote (remove generate)
- Add `add-pdr` subcommand to `/speckit.roadmap` (absorb phase functionality)
- Deprecate: start, constitution, memory-init, phase
- Update all documentation

**Commands Before → After**:

| Before | After |
|--------|-------|
| start, init, constitution, memory, memory-init, roadmap, phase | init, memory, roadmap |

**User Stories**:
1. As a new user, I run `/speckit.init` and my project is fully set up for development
2. As a maintainer, I run `/speckit.memory verify` to check document health
3. As a developer with PDRs, I run `/speckit.roadmap add-pdr` to add phases
4. As an existing user, I see deprecation notices guiding me to new commands

**Deliverables**:
- [ ] `/speckit.init` expanded: interview → constitution → memory → roadmap
- [ ] `/speckit.memory` reduced: remove `generate`, keep verify/reconcile/promote
- [ ] `/speckit.roadmap` expanded: add `add-pdr` subcommand
- [ ] Deprecation stubs for: start, constitution, phase
- [ ] Delete `/speckit.memory-init` (already deprecated)
- [ ] Updated `docs/commands-analysis.md`
- [ ] Updated CLAUDE.md command documentation

**Verification Gate**: Technical
- New project setup works with single `/speckit.init` command
- Deprecated commands show helpful redirect messages
- Existing projects continue to work
- No functionality lost in consolidation

**Estimated Complexity**: Medium

---

# Phase 1045: Project Actions & Health

> **Status**: Not Started
> **Branch**: `1045-project-actions-health`
> **Depends On**: Phase 1040 (CLI Actions from UI)

## Summary

Enable users to manage project lifecycle actions directly from the dashboard UI, including initialization, diagnostics, and version upgrades.

## Context

The dashboard now displays 4 project states:
1. **Not Initialized** - No `.specify/` directory or orchestration state
2. **Needs Setup** - Has state but no phases (needs discovery/roadmap)
3. **Ready** - Fully configured and working
4. **Error** - Health check failures or configuration issues

This phase adds actionable buttons to address each state.

## Goals

- Run `speckit init` on uninitialized projects from UI
- Run `speckit doctor` to diagnose and fix issues
- Run `speckit scaffold` to set up project structure
- Handle v1 → v2 schema migration via `speckit state migrate`
- Show command output in real-time (streaming)
- Provide confirmation dialogs for destructive operations

## Non-Goals

- Full terminal emulator (just command output display)
- Arbitrary CLI command execution (only predefined safe actions)
- Background job queuing (actions run one at a time)

## Technical Approach

## UI Components

1. **Action Buttons** - Context-aware buttons based on project status
   - Not Initialized: "Initialize Project" button
   - Needs Setup: "Run Discovery" / "Create Roadmap" buttons
   - Error: "Run Doctor" / "Fix Issues" buttons
   - Ready: "Doctor" in overflow menu

2. **Command Output Modal** - Shows real-time command output
   - Streaming output via SSE or WebSocket
   - Success/failure indication
   - Copy output button
   - Auto-close on success (with delay)

3. **Confirmation Dialog** - For operations that modify state
   - Clear description of what will happen
   - Cancel/Confirm actions

## API Endpoints

```typescript
// POST /api/projects/[id]/actions
// Body: { action: "init" | "doctor" | "scaffold" | "migrate" }
// Returns: SSE stream of command output

// GET /api/projects/[id]/health
// Returns: Detailed health check results
```

## Backend Implementation

1. **Command Executor** - Safe wrapper for CLI commands
   - Whitelist of allowed commands
   - Working directory validation
   - Timeout handling
   - Output streaming

2. **Health Check** - Deeper analysis than current state
   - Schema version check
   - Required files check
   - ROADMAP.md validation
   - Memory documents check

## Verification Checklist

- [ ] "Initialize Project" works on uninitialized project
- [ ] "Run Doctor" shows issues and offers fixes
- [ ] v1 → v2 migration works from UI
- [ ] Command output streams in real-time
- [ ] Confirmation dialog appears before destructive actions
- [ ] Error states update after successful fix
- [ ] Keyboard accessible (Enter to confirm, Escape to cancel)

## Files to Create/Modify

## New Files
- `src/app/api/projects/[id]/actions/route.ts` - Action execution endpoint
- `src/app/api/projects/[id]/health/route.ts` - Health check endpoint
- `src/components/projects/action-button.tsx` - Contextual action button
- `src/components/projects/command-output-modal.tsx` - Output display
- `src/components/ui/confirmation-dialog.tsx` - Confirmation UI
- `src/lib/command-executor.ts` - Safe command execution

## Modified Files
- `src/components/projects/project-card.tsx` - Add action buttons
- `src/components/projects/project-detail-header.tsx` - Add actions menu
- `packages/shared/src/schemas/` - Add action/health types

## Dependencies

- Existing SSE infrastructure from Phase 1020
- CLI commands: `speckit init`, `speckit doctor`, `speckit scaffold`, `speckit state migrate`

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Command hangs | Implement timeout (60s default) |
| Partial state after error | Run doctor after failed operations |
| User confusion about actions | Clear descriptions and confirmations |

## Sizing Estimate

Medium complexity - primarily UI work with some backend command execution. Should fit in a single session.

---


## 1040 - CLI Actions from UI

**Completed**: 2026-01-17 - CLI Actions from UI

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


## 1030 - Project Detail Views

**Completed**: 2026-01-17 - Project Detail Views

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


## 1020 - Real-Time File Watching

**Completed**: 2026-01-17 - Real-Time File Watching

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


## 1010 - Core UI Scaffold

**Completed**: 2026-01-17 - Core UI Scaffold

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


## 0010 - Roadmap Flexibility

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

## 0015 - Workflow Commands

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

## 0020 - Onboarding Polish

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

## 0030 - Test Suite Completion

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

## 0040 - Integration Options

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

## 0041 - Code Review Findings

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

## 0042 - Code Review 2026-01-11

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

## 0050 - UX Simplification

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

## 0060 - Constitution Compliance

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
