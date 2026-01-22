# Feature Specification: Smart Batching & Orchestration

**Feature Branch**: `1055-smart-batching-orchestration`
**Created**: 2026-01-21
**Status**: Final
**Input**: Phase 1055 from ROADMAP, PDR workflow-dashboard-orchestration.md

---

## User Scenarios & Testing

### User Story 1 - Complete Phase with One Click (Priority: P1)

A developer working on a SpecFlow project wants to complete an entire phase without manual intervention. They click "Complete Phase", configure their preferences once, and walk away while the system handles design, implement (in batches), and verify steps autonomously.

**Why this priority**: Core value proposition - autonomous phase completion is the northstar goal of this feature.

**Independent Test**: Start orchestration on a project with existing tasks.md, watch it progress through implement batches and complete without user interaction.

**Acceptance Scenarios**:

1. **Given** a project with phase 1055 open and tasks.md with 4 `##` sections, **When** user clicks "Complete Phase" and starts orchestration, **Then** system detects 4 batches and shows "Detected 4 batches from tasks.md"

2. **Given** orchestration is configured with skipDesign=false, **When** orchestration starts on a project without spec.md, **Then** system runs /flow.design first before implement

3. **Given** orchestration is running implement batch 2 of 4, **When** batch completes successfully, **Then** system automatically starts batch 3 without user intervention

4. **Given** all tasks are complete, **When** implement phase finishes, **Then** system automatically runs /flow.verify

---

### User Story 2 - Configuration Modal (Priority: P1)

A developer wants to customize orchestration behavior before starting. They see a configuration modal with core options (auto-merge, skip design, additional context) and advanced options (auto-heal settings, batch size fallback).

**Why this priority**: Essential for user control and trust - users must configure behavior before autonomous execution.

**Independent Test**: Open configuration modal, adjust settings, verify they persist into orchestration execution.

**Acceptance Scenarios**:

1. **Given** user clicks "Complete Phase" button, **When** modal opens, **Then** modal displays Core Options section with auto-merge toggle (default: off), skip design toggle (default: off), skip analyze toggle (default: off), and additional context textarea

2. **Given** user expands Advanced Options section, **When** viewing options, **Then** modal shows auto-heal toggle (default: on), max heal attempts (default: 1), batch size fallback (default: 15), pause between batches toggle (default: off)

3. **Given** user enters "Focus on performance" in additional context, **When** orchestration runs /flow.implement, **Then** that context appears in Claude's skill prompt

4. **Given** user sets skipDesign=true and project has no spec.md, **When** orchestration starts, **Then** system skips design and goes directly to analyze (or implement if skipAnalyze also set)

---

### User Story 3 - Auto-Healing on Failure (Priority: P2)

When a batch fails during implementation, the system should automatically attempt to fix the issue and continue, rather than requiring manual intervention.

**Why this priority**: Critical for autonomous operation - failures are common and should self-heal when possible.

**Independent Test**: Introduce a failure in a batch, observe healer Claude spawn and attempt recovery.

**Acceptance Scenarios**:

1. **Given** batch 2 fails with error "file not found", **When** auto-heal is enabled, **Then** system spawns healer Claude with error context and remaining task IDs

2. **Given** healer Claude fixes the issue and completes remaining tasks, **When** healing succeeds, **Then** system marks batch as "healed" and continues to batch 3

3. **Given** healer Claude fails to fix the issue, **When** healing fails, **Then** system stops orchestration, marks batch as "failed", and notifies user with full context

4. **Given** maxHealAttempts=1 and first heal attempt failed, **When** considering retry, **Then** system does NOT attempt second heal (prevents infinite loops)

---

### User Story 4 - Orchestration Progress Display (Priority: P2)

While orchestration runs, user wants clear visibility into current phase, batch progress, and overall status without needing to check CLI output.

**Why this priority**: Visibility builds trust - users need to know what's happening during autonomous execution.

**Independent Test**: Start orchestration, observe progress UI updating as batches complete.

**Acceptance Scenarios**:

1. **Given** orchestration is in implement phase, **When** viewing project detail, **Then** progress bar shows "Design --●-- Analyze --●-- Implement --○-- Verify --○-- Merge" with Implement highlighted

2. **Given** implement is running batch 2 of 4 (Core Components), **When** viewing progress, **Then** displays "Implementing batch 2 of 4: Core Components" and "Tasks: 12/35 complete"

3. **Given** auto-healing is in progress, **When** viewing status, **Then** shows healing indicator with message "Auto-healing batch 2..."

4. **Given** orchestration completes verify step, **When** auto-merge is disabled, **Then** status shows "Merge ready" and waits for user action

---

### User Story 5 - UI Entry Points (Priority: P2)

Developer can start orchestration from multiple locations: project detail page and project card menu.

**Why this priority**: Accessibility - users should find the primary action easily from wherever they are.

**Independent Test**: Start orchestration from project card, verify same modal and behavior as project detail.

**Acceptance Scenarios**:

1. **Given** viewing project detail page, **When** looking at workflow actions area, **Then** "Complete Phase" is the primary prominent button (larger, gradient/accent color, icon)

2. **Given** project card in project list, **When** opening actions menu, **Then** "Complete Phase" is first menu item (highlighted)

3. **Given** orchestration is already running for project, **When** clicking "Complete Phase" again, **Then** error message "Orchestration already in progress" with option to cancel existing

4. **Given** orchestration is active, **When** viewing project detail, **Then** action buttons are replaced with progress display and Cancel/Pause controls

---

### User Story 6 - State Persistence and Resume (Priority: P3)

If dashboard restarts while orchestration is running, the system should detect and resume the orchestration from where it left off.

**Why this priority**: Reliability - orchestrations can take hours and must survive dashboard restarts.

**Independent Test**: Start orchestration, restart dashboard, verify it resumes automatically.

**Acceptance Scenarios**:

1. **Given** orchestration is in implement batch 2, **When** dashboard process restarts, **Then** reconciler detects in-progress orchestration and resumes from batch 2

2. **Given** orchestration state saved to `{project}/.specflow/workflows/orchestration-{id}.json`, **When** dashboard starts, **Then** state is loaded and orchestration continues

3. **Given** orchestration process died unexpectedly, **When** reconciler checks health, **Then** marks orchestration as failed if process is dead

---

### Edge Cases

- What happens when tasks.md has no `##` sections? Falls back to fixed-size batches (default 15 tasks per batch)
- What happens when user cancels mid-batch? Batch is marked cancelled, no further batches run, state preserved for potential resume
- How does system handle API rate limits during batch execution? Claude CLI handles internally; dashboard monitors for stale status
- What happens when project has USER GATE? Orchestration pauses at verify, notifies user, waits for manual /flow.merge
- What happens when another orchestration is already running? Returns error "Orchestration already in progress" with cancel option

---

## Requirements

### Functional Requirements

**Configuration:**
- **FR-001**: System MUST display configuration modal when "Complete Phase" is clicked
- **FR-002**: Modal MUST include Core Options: auto-merge toggle, skip design toggle, skip analyze toggle, additional context textarea
- **FR-003**: Modal MUST include Advanced Options (collapsed): auto-heal toggle, max heal attempts, batch size fallback, pause between batches
- **FR-004**: Modal MUST show detected batch count before starting
- **FR-005**: Modal MUST show warning if no sections detected in tasks.md

**Batch Detection:**
- **FR-010**: System MUST parse tasks.md to detect batches from `##` section headers
- **FR-011**: Each `##` section with incomplete tasks becomes one batch
- **FR-012**: System MUST fall back to fixed-size batches (configurable, default 15) if no sections found
- **FR-013**: Batch detection MUST respect task completion status (skip completed tasks)

**State Machine:**
- **FR-020**: System MUST implement state machine with phases: design → analyze → implement → verify → merge
- **FR-021**: State machine MUST check `specflow status --json` between each step
- **FR-022**: System MUST wait for dual confirmation (state update AND process completion) before transitioning
- **FR-023**: System MUST persist state to `{project}/.specflow/workflows/orchestration-{id}.json`
- **FR-024**: System MUST support single orchestration per project (reject concurrent)

**Batch Execution:**
- **FR-030**: System MUST execute batches sequentially (one at a time)
- **FR-031**: Batch execution MUST use skill input injection to constrain tasks (no skill modification)
- **FR-032**: System MUST track per-batch: status, started/completed timestamps, task IDs, heal attempts
- **FR-033**: System MUST link batch to its workflow execution ID

**Auto-Healing:**
- **FR-040**: On batch failure, system MUST spawn healer Claude if auto-heal enabled
- **FR-041**: Healer prompt MUST include: error details, batch section, attempted tasks, completed tasks, failed tasks
- **FR-042**: Healer MUST only attempt remaining tasks in current batch
- **FR-043**: System MUST limit heal attempts per batch (configurable, default 1)
- **FR-044**: If healer fails, system MUST stop and notify user with full context

**Claude Helper Utility:**
- **FR-050**: System MUST provide typed claudeHelper() function for decisions and healing
- **FR-051**: Claude Helper MUST support: sessionId resume, schema validation (Zod), tool restrictions
- **FR-052**: Claude Helper MUST support model selection (sonnet, haiku, opus) with fallback
- **FR-053**: Claude Helper MUST enforce budget limits (per call, total)
- **FR-054**: Decision calls MUST restrict tools to read-only (Read, Grep, Glob)

**Progress Display:**
- **FR-060**: System MUST show phase progress bar (Design → Analyze → Implement → Verify → Merge)
- **FR-061**: System MUST show batch progress during implement (batch N of M, task counts)
- **FR-062**: System MUST show status indicators: Running, Paused, Healing, Waiting, Complete, Merge Ready
- **FR-063**: System MUST show timing information (elapsed, estimated remaining)
- **FR-064**: System MUST maintain decision log for debugging

**UI Integration:**
- **FR-070**: "Complete Phase" MUST be primary action (prominent styling, icon)
- **FR-071**: Secondary buttons (Orchestrate, Merge, Review, Memory) MUST remain available
- **FR-072**: Progress UI MUST replace action buttons during active orchestration
- **FR-073**: Project card menu MUST include "Complete Phase" as first highlighted item

**API Routes:**
- **FR-080**: POST `/api/workflow/orchestrate` - Start orchestration with config
- **FR-081**: GET `/api/workflow/orchestrate/status` - Get orchestration status
- **FR-082**: GET `/api/workflow/orchestrate/list` - List orchestrations for project
- **FR-083**: POST `/api/workflow/orchestrate/cancel` - Cancel orchestration
- **FR-084**: POST `/api/workflow/orchestrate/resume` - Resume paused orchestration
- **FR-085**: POST `/api/workflow/orchestrate/merge` - Trigger merge when paused

### Key Entities

- **OrchestrationExecution**: Tracks overall orchestration state including config, current phase, batches, linked executions, decision log
- **OrchestrationConfig**: User configuration from modal (auto-merge, skip flags, heal settings, budgets)
- **BatchItem**: Individual batch tracking (section name, task IDs, status, timing, heal attempts)
- **ClaudeHelperOptions**: Configuration for Claude Helper calls (schema, tools, budget, model)
- **ClaudeHelperResult**: Response from Claude Helper (parsed result, session ID, cost, timing)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: User can complete a 50-task phase by clicking one button and configuring preferences once
- **SC-002**: Batches execute sequentially with progress visible at each step
- **SC-003**: Auto-healing successfully recovers from batch failures caused by: missing files, syntax errors, test failures, and dependency issues (at least 70% success rate for these failure types)
- **SC-004**: Orchestration survives dashboard restart and resumes from correct position
- **SC-005**: Decision log provides clear debugging information for all state transitions
- **SC-006**: Budget limits prevent runaway costs (default $5/batch, $50/total, $2/heal)

---

## Non-Goals

- **NG-001**: Branch strategy selection in modal (future consideration)
- **NG-002**: Test/dry-run mode for orchestration (future consideration)
- **NG-003**: Notification level customization (future consideration)
- **NG-004**: Time-based constraints (stop after N hours) (future consideration)
- **NG-005**: Modifying existing /flow.* skills (dashboard orchestrates, skills unchanged)
- **NG-006**: SSE/WebSocket for real-time updates (polling is sufficient)
- **NG-007**: UI for selecting individual tasks (programmatic batching only)
- **NG-008**: Concurrent orchestrations on same project

---

## Visual Design Reference

See [ui-design.md](ui-design.md) for:
- Configuration modal layout
- Progress display components
- Button hierarchy and styling
- Project card menu changes
