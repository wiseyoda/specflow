# Feature Specification: Comprehensive Dashboard UI Redesign

**Feature Branch**: `1054-project-details-redesign`
**Created**: 2026-01-19
**Status**: Draft
**Input**: Phase 1054 from ROADMAP + User clarification for comprehensive UI overhaul

---

## User Scenarios & Testing

### User Story 1 - Design System Foundation (Priority: P1)

As a developer maintaining the dashboard, I want a consistent design system with reusable primitives so that all UI components share the same visual language.

**Why this priority**: This is the foundation. All other work depends on having the design tokens and primitives established first.

**Independent Test**: Can be tested by viewing a Storybook-style demo page showing all primitives rendered correctly with consistent styling.

**Acceptance Scenarios**:

1. **Given** the Tailwind config is extended, **When** I use `bg-surface-50` or `text-accent`, **Then** the correct mockup colors are applied.
2. **Given** primitive components exist, **When** I render a StatusPill with status="running", **Then** it shows green glow with "Running" text.
3. **Given** animation keyframes are defined, **When** I apply `animate-glow-pulse`, **Then** the element pulses as in mockup.

---

### User Story 2 - Icon Sidebar Navigation (Priority: P1)

As a user viewing a project, I want an icon-only sidebar so I can quickly navigate between Dashboard, Session, Tasks, and History views with keyboard shortcuts.

**Why this priority**: Core navigation is essential for accessing all other features.

**Independent Test**: Can be tested by clicking icons and using ⌘1-4 shortcuts to switch views.

**Acceptance Scenarios**:

1. **Given** I'm on the project details page, **When** I click the Session icon, **Then** the Session view is displayed.
2. **Given** the sidebar is visible, **When** I hover over an icon, **Then** a tooltip shows the label and hotkey (e.g., "Session ⌘2").
3. **Given** a workflow is running, **When** I view the Session icon, **Then** a green pulsing dot appears.
4. **Given** a workflow is waiting for input, **When** I view the Session icon, **Then** an amber pulsing dot appears.
5. **Given** I'm anywhere in the app, **When** I press ⌘2, **Then** the Session view is activated.

---

### User Story 3 - Header with Status Pill (Priority: P1)

As a user, I want to see the current workflow status prominently centered in the header so I immediately know if something is running, waiting, or failed.

**Why this priority**: Status visibility is critical for workflow-driven UX.

**Independent Test**: Can be tested by triggering different workflow states and observing header changes.

**Acceptance Scenarios**:

1. **Given** no workflow is running, **When** viewing the header, **Then** the status pill shows "Ready" in gray.
2. **Given** a workflow is running, **When** viewing the header, **Then** the status pill shows "Running" in green with timer.
3. **Given** a workflow is waiting for input, **When** viewing the header, **Then** the status pill shows "Input Needed" in amber with timer.
4. **Given** a workflow has failed, **When** viewing the header, **Then** the status pill shows "Failed" in red.
5. **Given** any active state, **When** viewing the timer, **Then** it counts up in MM:SS format.

---

### User Story 4 - Dashboard Welcome View (Priority: P2)

As a user with no active workflow, I want a welcoming dashboard showing my current phase progress and quick action buttons so I can easily resume work or start new workflows.

**Why this priority**: Provides friendly entry point and quick access to common actions.

**Independent Test**: Can be tested by navigating to Dashboard view while idle and clicking action buttons.

**Acceptance Scenarios**:

1. **Given** I'm in idle state on Dashboard view, **When** viewing the page, **Then** I see "Ready to build?" greeting and phase progress.
2. **Given** the dashboard shows actions, **When** I click "Resume Implementation", **Then** the implement workflow starts.
3. **Given** the dashboard shows secondary actions, **When** I click "Orchestrate", **Then** the orchestrate workflow starts.
4. **Given** the dashboard shows stats, **When** viewing, **Then** I see Done/Pending/Progress percentages.

---

### User Story 5 - Session Console View (Priority: P2)

As a user running a workflow, I want to see a live console with agent messages, tool calls, and reasoning so I can follow what Claude is doing.

**Why this priority**: Transparency into agent actions is core to the product.

**Independent Test**: Can be tested by starting a workflow and observing messages appear with correct formatting.

**Acceptance Scenarios**:

1. **Given** a workflow is running, **When** I view Session, **Then** I see timestamped messages with agent attribution (@Implementer, @Designer).
2. **Given** messages are displayed, **When** Claude shows reasoning, **Then** it has a "reasoning" badge in accent color.
3. **Given** messages are displayed, **When** Claude shows an action, **Then** it has an "action" badge in green.
4. **Given** a tool call occurs, **When** viewing Session, **Then** I see a code block with syntax highlighting.
5. **Given** no workflow is running, **When** viewing Session, **Then** I see empty state with "Start Workflow" CTA.

---

### User Story 6 - Omni-Box Input (Priority: P2)

As a user, I want a unified input box at the bottom of the session view that adapts to the current state so I can type responses, interventions, or new prompts.

**Why this priority**: Single point of input simplifies interaction model.

**Independent Test**: Can be tested by focusing input and typing in different workflow states.

**Acceptance Scenarios**:

1. **Given** the workflow is idle, **When** viewing omni-box, **Then** it shows "Ready" badge and "Ask SpecFlow to do something..." placeholder.
2. **Given** the workflow is running, **When** viewing omni-box, **Then** it shows "Live" badge and "Type to intervene or guide..." placeholder.
3. **Given** the workflow is waiting, **When** viewing omni-box, **Then** it shows "Waiting" badge and "Respond to the question..." placeholder.
4. **Given** the workflow is failed, **When** viewing omni-box, **Then** it shows "Failed" badge with red styling.
5. **Given** I focus the input, **When** typing, **Then** a gradient glow effect appears.
6. **Given** I'm anywhere on the page, **When** I press ⌘K, **Then** the omni-box is focused.
7. **Given** the workflow is running or idle, **When** I press Enter in omni-box with text, **Then** the message is sent to start or intervene in the workflow.

---

### User Story 7 - Decision Toast (Priority: P2)

As a user whose workflow needs input, I want a floating toast showing the question and options so I can quickly respond without disrupting my view.

**Why this priority**: Questions are the primary interaction during workflows; needs to be prominent yet non-intrusive.

**Independent Test**: Can be tested by triggering a workflow that asks a question and selecting an option.

**Acceptance Scenarios**:

1. **Given** workflow status is "waiting", **When** viewing the page, **Then** a decision toast appears at bottom-center.
2. **Given** the toast is visible, **When** viewing, **Then** I see question text, 2-column option buttons, and animated beam progress.
3. **Given** the toast is visible, **When** I click an option, **Then** the answer is submitted and toast dismisses.
4. **Given** the toast is visible, **When** I type in the omni-box, **Then** the toast can auto-resolve (my response becomes the answer).
5. **Given** the toast is visible, **When** I click "Provide custom instructions", **Then** I can type a custom response.

---

### User Story 8 - Failed Toast (Priority: P2)

As a user whose workflow has failed, I want to see a clear error notification with retry option so I can understand what went wrong and try again.

**Why this priority**: Error recovery is essential for good UX.

**Independent Test**: Can be tested by triggering a failed workflow and clicking retry.

**Acceptance Scenarios**:

1. **Given** workflow status is "failed", **When** viewing the page, **Then** a red-themed toast appears with error details.
2. **Given** the failed toast is visible, **When** I click "Retry", **Then** the workflow is restarted.
3. **Given** the failed toast is visible, **When** I click "Dismiss", **Then** the toast hides and status returns to idle.

---

### User Story 9 - Tasks Kanban View (Priority: P2)

As a user, I want to see my tasks in a 2-column Kanban (To Do / Done) so I can track implementation progress visually.

**Why this priority**: Task visibility supports workflow transparency.

**Independent Test**: Can be tested by navigating to Tasks view and observing correct task placement.

**Acceptance Scenarios**:

1. **Given** I navigate to Tasks view, **When** viewing, **Then** I see 2 columns: "To Do" and "Done".
2. **Given** tasks exist, **When** viewing a task card, **Then** I see task ID, priority badge (if high), and description.
3. **Given** completed tasks exist, **When** viewing Done column, **Then** tasks show strikethrough text and check icon.
4. **Given** the header shows progress, **When** viewing, **Then** I see "X of Y complete" with progress bar.

---

### User Story 10 - History Timeline View (Priority: P3)

As a user, I want to see my phase history in a master-detail layout so I can review past work and access artifacts.

**Why this priority**: Historical context is valuable but not critical path.

**Independent Test**: Can be tested by navigating to History and clicking phase items.

**Acceptance Scenarios**:

1. **Given** I navigate to History view, **When** viewing, **Then** I see a timeline on the left and detail panel on the right.
2. **Given** phases exist, **When** I click a phase in timeline, **Then** the detail panel updates with that phase's info.
3. **Given** a phase is selected, **When** viewing details, **Then** I see summary, sessions list, and artifact links.

---

### User Story 11 - Context Drawer (Priority: P3)

As a user, I want a collapsible right-side drawer showing current task, touched files, and phase progress so I have context while working.

**Why this priority**: Provides helpful context but not essential for core functionality.

**Independent Test**: Can be tested by toggling drawer and observing content updates.

**Acceptance Scenarios**:

1. **Given** I click the Context toggle in header, **When** the drawer opens, **Then** I see Context and Activity tabs.
2. **Given** Context tab is active, **When** viewing, **Then** I see current task card, touched files list, and phase progress stepper.
3. **Given** Activity tab is active, **When** viewing, **Then** I see recent activity feed with colored dots.

---

### User Story 12 - Project List Redesign (Priority: P3)

As a user on the home page, I want to see my projects with the new design system styling so the visual experience is consistent across the app.

**Why this priority**: Consistency is important but project list works fine currently.

**Independent Test**: Can be tested by viewing home page and observing card styling matches design system.

**Acceptance Scenarios**:

1. **Given** I'm on the home page, **When** viewing project cards, **Then** they use new glass morphism styling.
2. **Given** a project has an active workflow, **When** viewing its card, **Then** status indicators match the new design.
3. **Given** the page loads, **When** viewing background, **Then** I see grid pattern and floating orbs.

---

### User Story 13 - Visual Polish (Priority: P3)

As a user, I want the app to have polished visual effects (glass morphism, grid background, floating orbs, smooth transitions) so it feels premium and modern.

**Why this priority**: Polish elevates experience but functionality comes first.

**Independent Test**: Can be tested visually by navigating through app and observing effects.

**Acceptance Scenarios**:

1. **Given** any page loads, **When** viewing background, **Then** I see a subtle grid pattern.
2. **Given** the background is visible, **When** looking carefully, **Then** I see floating orbs with slow animation.
3. **Given** I switch views, **When** the transition occurs, **Then** it animates smoothly (fade/slide).
4. **Given** glass components render, **When** viewing, **Then** they have backdrop-blur effect.

---

### Edge Cases

- What happens when workflow state changes mid-view-transition?
- How does the UI handle extremely long task descriptions in Kanban?
- What happens when many messages flood the Session console rapidly?
- How does the Decision toast behave with very long question text?
- What happens when there are 5+ pending questions?
- How does the History view handle 100+ phases?
- What if the Context drawer is open when screen is too narrow?

---

## Requirements

### Functional Requirements

**Design System**
- **FR-001**: System MUST provide Tailwind config extension with mockup color palette (surface, accent, success, warning, danger).
- **FR-002**: System MUST provide animation keyframes (glow-pulse, slide-up, beam, float).
- **FR-003**: System MUST provide reusable primitive components (StatusPill, GlassCard).

**Navigation & Layout**
- **FR-004**: System MUST render icon-only sidebar with 4 navigation items (Dashboard, Session, Tasks, History).
- **FR-005**: Each sidebar icon MUST show tooltip on hover with label and keyboard shortcut.
- **FR-006**: Sidebar MUST show live indicator (pulsing dot) on Session icon when workflow is running.
- **FR-007**: Sidebar MUST show warning indicator on Session icon when workflow is waiting.
- **FR-008**: Header MUST show centered status pill with state-specific styling and timer.
- **FR-009**: Header MUST show Context drawer toggle button on the right.

**Dashboard View**
- **FR-010**: Dashboard view MUST show welcome greeting when idle with phase progress.
- **FR-011**: Dashboard MUST provide primary action card (Resume Implementation) with context.
- **FR-012**: Dashboard MUST provide secondary action buttons (Orchestrate, Design, Verify).
- **FR-013**: Dashboard MUST show stats row (Done/Pending/Progress).

**Session View**
- **FR-014**: Session view MUST render messages with timestamps, agent attribution, and badges.
- **FR-015**: Session view MUST display tool calls as syntax-highlighted code blocks.
- **FR-016**: Session view MUST show typing indicator when Claude is processing.
- **FR-017**: Session view MUST show empty state with CTA when idle.

**Input & Interaction**
- **FR-018**: Omni-box MUST show state badge (Ready/Live/Waiting/Failed).
- **FR-019**: Omni-box MUST show gradient glow on focus.
- **FR-020**: Omni-box placeholder MUST change based on workflow state.
- **FR-021**: ⌘K MUST focus the omni-box from anywhere.
- **FR-022**: ⌘1-4 MUST navigate to respective views.

**Notifications**
- **FR-023**: Decision toast MUST appear when workflow status is "waiting_for_input".
- **FR-024**: Decision toast MUST display question text and option buttons.
- **FR-025**: Decision toast MUST have animated beam progress indicator.
- **FR-026**: Failed toast MUST appear when workflow status is "failed".
- **FR-027**: Failed toast MUST show error message and Retry/Dismiss buttons.

**Tasks & History**
- **FR-028**: Tasks view MUST show 2-column Kanban (To Do, Done).
- **FR-029**: Task cards MUST show ID, priority badge (if applicable), and description.
- **FR-030**: History view MUST show master-detail layout with timeline and detail panel.
- **FR-031**: History timeline MUST allow clicking phases to select them.

**Context Drawer**
- **FR-032**: Context drawer MUST be collapsible via header toggle.
- **FR-033**: Context drawer MUST have two tabs: Context and Activity.
- **FR-034**: Context tab MUST show current task, touched files, and phase progress.

**Visual Polish**
- **FR-035**: App MUST render grid background pattern.
- **FR-036**: App MUST render floating orb animations.
- **FR-037**: Glass components MUST use backdrop-blur effect.
- **FR-038**: View transitions MUST be animated (opacity, transform).

**Project List**
- **FR-039**: Project cards MUST use new design system styling (glass, status pills).
- **FR-040**: Project list page MUST have consistent visual language with project details.

---

### Key Entities

- **NavigationItem**: {id, label, icon, hotkey} - Sidebar navigation items
- **WorkflowStatus**: idle | running | waiting | failed - Current workflow state
- **ViewType**: dashboard | session | tasks | history - Active view
- **SessionMessage**: {timestamp, agent, type, content} - Console message
- **Toast**: {type, title, content, actions} - Notification toast

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 4 views (Dashboard, Session, Tasks, History) are navigable via sidebar and keyboard shortcuts.
- **SC-002**: Status pill correctly reflects all 4 workflow states (idle, running, waiting, failed).
- **SC-003**: Decision toast appears within 500ms of workflow entering waiting state.
- **SC-004**: Omni-box responds to ⌘K focus from any view.
- **SC-005**: Session messages render with correct agent attribution and badges.
- **SC-006**: Visual polish elements (grid, orbs, glass effects) render without performance degradation.
- **SC-007**: Project list page uses same design system primitives as project details.
- **SC-008**: All existing workflow functionality (start, cancel, answer) continues to work.
