# PDR: Orchestration Engine

<!--
  IMPORTANT: This document captures PRODUCT requirements, not TECHNICAL requirements.
  Focus on WHAT the feature should do and WHY it matters.
  Do NOT include: architecture, code structure, implementation details, or technology choices.
-->

**PDR ID**: `pdr-orchestration-engine`
**Created**: 2026-01-17
**Author**: Agent (with user input)
**Status**: Approved
**Priority**: P2

---

## Problem Statement

**The Problem**: Currently, running SpecFlow workflows (like `/specflow.orchestrate`) requires using Claude Code CLI directly. The dashboard can only trigger simple CLI commands (`specflow doctor`, `specflow init`), not the AI-powered workflow commands that do the actual development work. Users must context-switch between the dashboard (for visibility) and Claude Code terminal (for execution).

**Who is affected**: Developers using SpecFlow who want a unified interface for both monitoring project status AND executing development workflows.

**Current workaround**: Users run `/specflow.orchestrate` manually in Claude Code, watch terminal output, and periodically refresh the dashboard to see state changes. For long-running workflows, this requires constant attention to answer clarifying questions.

**Why now**: The dashboard now has project visibility and simple action execution. The natural next step is enabling full workflow execution, making the dashboard the single interface for SpecFlow-powered development.

---

## Desired Outcome

**After this feature ships, users will be able to**:
- Start, monitor, and control SpecFlow workflows entirely from the dashboard
- Answer Claude's clarifying questions through the dashboard UI when they're ready
- Run workflows on multiple projects simultaneously
- See comprehensive progress, outputs, and status for each workflow step
- Resume or retry failed steps without losing context

**The experience should feel**: Controlled, transparent, asynchronous-friendly, and professional

---

## User Stories

### Story 1: Start Workflow from Dashboard
**As a** developer managing multiple SpecFlow projects,
**I want to** start an orchestration workflow from the dashboard,
**So that** I don't need to open a terminal and navigate to the project directory.

**Value**: Reduces friction for starting work, especially when managing multiple projects.

---

### Story 2: Answer Questions at My Pace
**As a** developer with competing priorities,
**I want to** see queued questions from Claude and answer them when I'm ready,
**So that** I can review decisions thoughtfully instead of being interrupted in real-time.

**Value**: Enables asynchronous workflow where AI works ahead and human reviews/approves in batches.

---

### Story 3: Monitor Parallel Workflows
**As a** developer working on multiple projects,
**I want to** run orchestration on several projects simultaneously,
**So that** I can maximize productivity while AI handles the development tasks.

**Value**: Multiplies developer effectiveness by parallelizing AI-assisted work across projects.

---

### Story 4: Recover from Failures
**As a** developer whose workflow step failed,
**I want to** see what went wrong and retry with additional context,
**So that** I don't lose all progress when something goes wrong.

**Value**: Reduces frustration and wasted work when errors occur mid-workflow.

---

### Story 5: Review What Happened
**As a** developer who stepped away during a workflow,
**I want to** see a summary of what Claude did, what changed, and what decisions were made,
**So that** I understand the work without reading full transcripts.

**Value**: Enables oversight and learning from AI-assisted development sessions.

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| Workflow completion via dashboard | Users can complete full orchestration workflow | End-to-end test of all steps |
| Question response time | Users answer at their convenience, not real-time | Questions queue properly, workflow waits |
| Multi-project execution | 2+ projects can run workflows simultaneously | Parallel workflow test |
| Failure recovery | Failed steps can be retried with context | Test failure -> retry -> success flow |
| Step-level progress visibility | Users see which step is active and progress within it | UI shows accurate step status |

---

## Constraints

- **Must**: Work with Claude Code CLI (not require API keys or separate agent deployment)
- **Must**: Maintain compatibility with existing CLI workflow (users can still run `/specflow.orchestrate` directly)
- **Must**: Keep each Claude session under 200k context to avoid compaction/quality loss
- **Should**: Show real-time progress during active steps
- **Should**: Persist state across page refreshes and reconnections
- **Must Not**: Require users to keep browser tab open for workflow to progress
- **Must**: Continue executing current step even if browser is closed; queue results for later viewing
- **Should**: Show toast notification when questions need answers (if dashboard is open)
- **Should**: Provide clear visual indicator on project cards when questions are pending

---

## Non-Goals

- **Not solving**: Full Claude Code replacement (we're complementing it, not replacing it)
- **Not solving**: Custom agent creation (using standard Claude Code, not Agent SDK initially)
- **Out of scope**: Voice/audio interaction with Claude
- **Out of scope**: Collaborative multi-user workflow management

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| Claude Code CLI stream-json support | Blocking | Required for programmatic control | Known - Available |
| Refactored workflow commands | Blocking | Need smaller, composable commands | Known - Needs Work |
| Existing SSE infrastructure | Informational | Can reuse for streaming updates | Known - Available |

---

## Open Questions

- [x] How should we handle browser/tab closure during active step? → **Answer**: Continue running on server until step completes, queue results. User can close browser and check status when they return. Server process persists independently of browser connection.
- [x] Should implement sub-tasks show individual progress bars or just overall progress? → **Answer**: Overall progress only. Users care about total tasks completed, not internal step boundaries. Single progress indicator showing X/Y tasks complete.
- [x] What's the right UX for reviewing/approving queued questions? → **Answer**: Toast notification when dashboard is open + icon indicator on project list/detail views. Clicking icon opens dedicated drawer/panel for answering questions with context.
- [x] Should this use Agent SDK or CLI? → **Answer**: CLI with stream-json (local execution, no API key management)
- [x] How to split implement phase? → **Answer**: By logical task groups as defined in tasks.md phases

---

## Acceptance Criteria

1. [ ] User can start orchestration workflow for any project from dashboard
2. [ ] Dashboard shows current step and overall task progress (X/Y tasks complete)
3. [ ] When Claude asks a question, it appears in a queue; workflow pauses until answered
4. [ ] User can answer queued questions through a dedicated drawer/panel UI
5. [ ] Project cards show visual indicator when questions are pending
6. [ ] Toast notification appears when new questions arrive (if dashboard is open)
7. [ ] Workflow continues running if user closes browser; results queue for later viewing
8. [ ] User can run workflows on 2+ projects simultaneously
9. [ ] Failed steps show error context and can be retried
10. [ ] After workflow completes, user can see summary of changes, decisions, and outputs
11. [ ] Existing CLI workflow (`/specflow.orchestrate`) continues to work unchanged
12. [ ] Each workflow step stays under 200k context (no compaction)

---

## Related PDRs

- None currently (this is foundational dashboard capability)

## Implementation Phases

This PDR is implemented across 6 phases:

| Phase | Name | Focus |
|-------|------|-------|
| 1046 | Command JSON Output | Add --json flag to all CLI commands |
| 1047 | Workflow Decomposition: Design | discover, design, check commands |
| 1048 | Workflow Decomposition: Execution | implement --group, verify, merge |
| 1050 | Workflow Runner | Server-side process management |
| 1051 | Question UX | Toast, indicators, drawer panel |
| 1052 | Dashboard Orchestration | Full workflow UI integration |

---

## Notes

### Workflow Decomposition Model

Based on user input, the workflow should be decomposed into these logical units:

| Unit | Steps Included | Typical Context | Notes |
|------|----------------|-----------------|-------|
| Discover | discover | ~1 window | Explores codebase, asks questions |
| Design | specify, clarify, plan, tasks | ~1 window | Creates all design artifacts |
| Check | analyze, checklist | ~1 window | Validates artifacts |
| Implement | implement (N sub-groups) | Multiple windows | Split by task groups from tasks.md |
| Verify | verify | ~1 window | Confirms completion |
| Merge | merge | ~1 window | Git operations, cleanup |

### JSON Output Requirements

Commands should return comprehensive output including:
- `status`: success/failure/pending
- `changes_made`: files modified, lines changed
- `artifacts_created`: spec files, plans, task lists
- `questions`: any pending questions for user
- `next_step`: what should run next
- `errors`: if any, with context for retry
- `summary`: human-readable summary of what happened

### Multi-Project Considerations

- Each project workflow is independent
- Dashboard manages multiple concurrent Claude CLI processes
- State persisted per-project in orchestration-state.json
- UI shows unified view of all active workflows

### User Feedback Incorporated

- Blocking questions preferred over non-blocking (ensures human oversight)
- Summary-only transcripts (not full conversation history)
- Retry with context on failures (not skip or manual fix)
- Unified approach (same commands work CLI and dashboard)
