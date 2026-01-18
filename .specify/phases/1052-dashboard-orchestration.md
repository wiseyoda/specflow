---
phase: 1052
name: dashboard-orchestration
status: not_started
created: 2026-01-17
pdr: pdr-orchestration-engine.md
---

### 1052 - Dashboard Orchestration

**Goal**: Complete dashboard UI for starting, monitoring, and managing SpecFlow workflows.

**Scope**:
- "Start Workflow" action on project cards and detail page
- Workflow progress display (current step, X/Y tasks complete)
- Step history showing completed steps
- Real-time streaming output during active steps
- Post-workflow summary view
- Error display with retry option
- Workflow controls (pause concept via questions, cancel)

**User Stories**:
1. As a user, I click "Start Workflow" on a project to begin orchestration
2. As a user, I see which step is active and overall progress
3. As a user, I see real-time output as Claude works
4. As a user, I see a summary after workflow completes
5. As a user, I can retry a failed step with error context

**Deliverables**:
- "Start Workflow" button in Actions menu
- Workflow confirmation dialog (shows what will run)
- Workflow progress component:
  - Current step indicator (Discover → Design → Check → Implement → Verify → Merge)
  - Overall progress bar (X/Y tasks)
  - Step history with status
- Real-time output panel (reuse CommandOutputModal concepts)
- Post-workflow summary view:
  - Files changed
  - Artifacts created
  - Decisions made (from questions)
  - Time elapsed
- Error state with retry action
- Integration tests for full workflow via dashboard

**Verification Gate**: **USER VERIFICATION REQUIRED**
- Click Start Workflow, workflow begins
- See step progress and task completion
- See streaming output during active step
- After completion, see summary of changes
- On failure, see error and retry option

**Estimated Complexity**: High
