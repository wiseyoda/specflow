# Requirements Checklist: Phase 1045 - Project Actions & Health

## User Stories

- [ ] **US-1**: Initialize Uninitialized Project
  - [ ] "Initialize" button on `not_initialized` projects
  - [ ] Confirmation dialog before execution
  - [ ] Runs `specflow init --non-interactive`
  - [ ] Streaming output display
  - [ ] Status updates after completion

- [ ] **US-2**: Run Doctor on Error/Warning Projects
  - [ ] "Run Doctor" button on error/warning projects
  - [ ] Available in dropdown for all projects
  - [ ] Diagnose and Auto-Fix options
  - [ ] Streaming output display
  - [ ] Health updates after completion

- [ ] **US-3**: Scaffold Project Structure
  - [ ] "Scaffold" in actions dropdown
  - [ ] Shows what will be created
  - [ ] Runs `specflow scaffold`
  - [ ] Streaming output display

- [ ] **US-4**: Migrate v1 to v2 Schema
  - [ ] "Migrate to v2" on v1 projects
  - [ ] Confirmation dialog
  - [ ] Runs `specflow state migrate`
  - [ ] State updates to v2 after completion

- [ ] **US-5**: View Command Output
  - [ ] Modal displays command
  - [ ] Real-time streaming
  - [ ] Color-coded output (stdout/stderr)
  - [ ] Success/failure indicators
  - [ ] Modal stays open until closed
  - [ ] Copy output button
  - [ ] Exit code shown

## Functional Requirements

- [ ] **FR-1**: Action Button Component
  - [ ] Context-aware based on status
  - [ ] Loading state
  - [ ] Disabled when running

- [ ] **FR-2**: Actions Dropdown Menu
  - [ ] Available on detail page
  - [ ] All actions listed
  - [ ] Grouped logically

- [ ] **FR-3**: Confirmation Dialog
  - [ ] Required for init, scaffold, migrate, doctor --fix
  - [ ] Clear descriptions
  - [ ] Cancel/Confirm buttons
  - [ ] Escape key closes

- [ ] **FR-4**: Command Output Modal
  - [ ] Fixed height with scroll
  - [ ] Monospace font
  - [ ] Real-time streaming
  - [ ] Command name shown
  - [ ] Execution time
  - [ ] Copy to clipboard
  - [ ] Explicit close

- [ ] **FR-5**: Security
  - [ ] Commands validated
  - [ ] `init` added to allowlist
  - [ ] No arbitrary execution
  - [ ] Arguments sanitized

## Technical Requirements

- [ ] **TR-1**: API Endpoints
  - [ ] Action execution via existing endpoints
  - [ ] Optional health endpoint

- [ ] **TR-2**: Command Execution
  - [ ] Uses existing infrastructure
  - [ ] `init` in allowed commands
  - [ ] Actions map to CLI commands

- [ ] **TR-3**: State Updates
  - [ ] File watcher detects changes
  - [ ] SSE broadcasts updates
  - [ ] No manual refetch

- [ ] **TR-4**: UI Responsiveness
  - [ ] Loading spinner on buttons
  - [ ] Immediate output display
  - [ ] Updates without refresh

## Edge Cases

- [ ] **EC-1**: Disable buttons while command running
- [ ] **EC-2**: Error state handling in modal
- [ ] **EC-3**: SSE reconnection handling
- [ ] **EC-4**: Unavailable project path handling
