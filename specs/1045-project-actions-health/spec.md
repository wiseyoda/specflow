# Specification: Phase 1045 - Project Actions & Health

> Version: 1.0.0
> Status: Draft
> Created: 2026-01-17

## Overview

Enable users to manage project lifecycle actions directly from the dashboard UI, including initialization, diagnostics, and version upgrades. Action buttons appear on both project cards (primary action) and detail page (full menu).

## Goals

1. Run `specflow init` on uninitialized projects from UI
2. Run `specflow doctor` to diagnose and fix issues
3. Run `specflow scaffold` to set up project structure
4. Handle v1 → v2 schema migration via `specflow state migrate`
5. Show command output in real-time (streaming)
6. Provide confirmation dialogs for destructive operations

## Non-Goals

- Full terminal emulator (just command output display)
- Arbitrary CLI command execution (only predefined safe actions)
- Background job queuing (actions run one at a time)

## User Stories

### US-1: Initialize Uninitialized Project
**As a** user with an uninitialized project
**I want to** click a button to initialize it
**So that** I can start using SpecFlow without leaving the dashboard

**Acceptance Criteria:**
- "Initialize" button appears on projects with status `not_initialized`
- Clicking button opens confirmation dialog
- Dialog shows what will be created (`.specify/` directory, state file)
- Runs `specflow init --non-interactive` (skips interview for auto-setup)
- Shows streaming output during execution
- Project card updates to show new status after completion

### US-2: Run Doctor on Error/Warning Projects
**As a** user with a project showing errors or warnings
**I want to** run diagnostics from the UI
**So that** I can identify and fix issues quickly

**Acceptance Criteria:**
- "Run Doctor" button appears on projects with status `error` or `warning`
- Button also available in dropdown menu on all projects
- Shows two options: "Diagnose" (`specflow doctor`) and "Auto-Fix" (`specflow doctor --fix`)
- Shows streaming output during execution
- Health status updates after completion

### US-3: Scaffold Project Structure
**As a** user with a project needing structure
**I want to** scaffold the project from the UI
**So that** required directories and files are created

**Acceptance Criteria:**
- "Scaffold" option in actions dropdown menu
- Shows what will be created before execution
- Runs `specflow scaffold`
- Shows streaming output
- Updates project status after completion

### US-4: Migrate v1 to v2 Schema
**As a** user with a v1 state file
**I want to** migrate to v2 schema from the UI
**So that** I can use new features

**Acceptance Criteria:**
- "Migrate to v2" button appears when schema_version is 1.x
- Confirmation dialog explains what migration does
- Runs `specflow state migrate`
- Shows streaming output
- State updates to v2 schema after completion

### US-5: View Command Output
**As a** user running any action
**I want to** see the command output in real-time
**So that** I know what's happening and can troubleshoot if needed

**Acceptance Criteria:**
- Modal displays command being run
- Output streams in real-time (not batched)
- stdout shown in default color, stderr in red/amber
- Success shows green checkmark, failure shows red X
- Modal stays open until user closes it (per user preference)
- Copy output button available
- Exit code shown on completion

## Functional Requirements

### FR-1: Action Button Component
- Context-aware: shows different actions based on project status
- Loading state while command executes
- Disabled state when command running

### FR-2: Actions Dropdown Menu
- Available on detail page header
- Contains all available actions for project
- Grouped logically (Setup, Maintenance, Advanced)

### FR-3: Confirmation Dialog
- Required for: init, scaffold, migrate, doctor --fix (state-modifying operations)
- Not required for: doctor (read-only diagnostics)
- Shows clear description of what will happen
- Cancel and Confirm buttons
- Escape key closes dialog

### FR-4: Command Output Modal
- Fixed height with scroll
- Monospace font for output
- Real-time streaming via SSE
- Shows command name and arguments at top
- Shows execution time
- Copy output to clipboard
- Close button (explicit close, no auto-close)

### FR-5: Security
- All commands validated against allowlist
- `init` must be added to allowed-commands.ts
- No arbitrary command execution
- Arguments sanitized (already handled by cli-executor)

## Technical Requirements

### TR-1: API Endpoints
Uses existing command execution infrastructure:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/commands/execute` | POST | Execute action (init, doctor, scaffold, migrate) |
| `/api/commands/stream` | GET | Stream command output via SSE |

### TR-2: Command Execution
- Use existing `/api/commands/execute` and `/api/commands/stream` infrastructure
- Add `init` to allowed commands list
- Actions map to CLI commands:
  - `init` → `specflow init --non-interactive`
  - `doctor` → `specflow doctor`
  - `doctor-fix` → `specflow doctor --fix`
  - `scaffold` → `specflow scaffold`
  - `migrate` → `specflow state migrate`

### TR-3: State Updates
- After action completes, file watcher detects state changes
- SSE broadcasts update to all connected clients
- No manual refetch needed

### TR-4: UI Responsiveness
- Button shows loading spinner during execution
- Modal shows output immediately (no buffering)
- Project card/detail updates without page refresh

## UI/UX Design

### Project Card Actions
- Primary action button (right side before chevron)
- Status-dependent:
  - `not_initialized`: "Initialize" (primary button)
  - `error`: "Fix" (destructive button)
  - `warning`: "Doctor" (outline button)
  - `ready`: No primary button (actions in detail page)

### Detail Page Actions
- Dropdown menu in header (right side)
- Menu groups:
  - **Setup**: Initialize, Scaffold
  - **Maintenance**: Doctor, Doctor (Auto-Fix)
  - **Advanced**: Migrate Schema

### Command Output Modal
```
┌─────────────────────────────────────────────────────────┐
│ Running: specflow doctor                            [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ $ specflow doctor                                        │
│                                                         │
│ Checking project health...                              │
│ ✓ State file valid                                      │
│ ✓ ROADMAP.md found                                      │
│ ⚠ Missing constitution.md                               │
│                                                         │
│ Health: Warning (1 issue)                               │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ ✓ Completed in 1.2s                            [Copy]   │
└─────────────────────────────────────────────────────────┘
```

### Confirmation Dialog
```
┌─────────────────────────────────────────────────────────┐
│ Initialize Project                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ This will create:                                       │
│   • .specify/ directory                                 │
│   • orchestration-state.json                            │
│   • memory/ subdirectory                                │
│                                                         │
│ The project will be registered with SpecFlow.            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                           [Cancel]  [Initialize]        │
└─────────────────────────────────────────────────────────┘
```

## Edge Cases

### EC-1: Command Already Running
- Disable action buttons while a command is running for that project
- Show "Running..." indicator on button

### EC-2: Command Fails
- Show error state in modal (red indicator)
- Keep modal open with full output
- Allow user to copy output for troubleshooting
- Suggest running `doctor` if state may be corrupted

### EC-3: SSE Connection Lost
- Show reconnecting indicator
- Buffer any output during reconnection
- If reconnection fails, show error with "Retry" button

### EC-4: Project Path Unavailable
- Disable all actions if project path not accessible
- Show tooltip explaining project is unavailable

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/projects/action-button.tsx` | Context-aware action button |
| `src/components/projects/actions-menu.tsx` | Dropdown menu with all actions |
| `src/components/projects/command-output-modal.tsx` | Real-time output display |
| `src/components/ui/confirmation-dialog.tsx` | Generic confirmation component |
| `src/lib/action-definitions.ts` | Action metadata (name, command, confirmation text) |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/projects/project-card.tsx` | Add action button |
| `src/components/projects/project-detail-header.tsx` | Add actions menu |
| `src/lib/allowed-commands.ts` | Add `init` to allowlist |
| `packages/shared/src/schemas/commands.ts` | Add action types |

## Dependencies

- Existing SSE infrastructure (Phase 1020)
- Existing command execution (Phase 1020)
- CLI commands: `specflow init`, `specflow doctor`, `specflow scaffold`, `specflow state migrate`

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| I. Developer Experience First | Primary goal - easy project management from UI |
| III. CLI Over Direct Edits | Uses CLI commands, no direct file manipulation |
| V. Helpful Error Messages | Shows full command output for troubleshooting |
| VI. Graceful Degradation | Actions available based on project status |

## Success Metrics

- User can initialize a project without using terminal
- User can diagnose and fix issues from dashboard
- Command output is visible in real-time
- No page refresh needed after actions complete
