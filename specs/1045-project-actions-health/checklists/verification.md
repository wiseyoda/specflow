# Verification Checklist: Phase 1045 - Project Actions & Health

> Purpose: Post-completion verification for /speckit.verify
> Created: 2026-01-17

## Pre-Verification Checks

- [ ] All tasks marked complete in tasks.md
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Dashboard builds successfully (`pnpm build`)

## US-1: Initialize Uninitialized Project

### UI Verification
- [ ] "Initialize" button visible on projects with status `not_initialized`
- [ ] Button NOT visible on projects with other statuses
- [ ] Button styled as primary variant
- [ ] Button disabled when project path unavailable

### Confirmation Dialog
- [ ] Dialog opens when "Initialize" clicked
- [ ] Dialog shows title: "Initialize Project"
- [ ] Dialog lists what will be created (`.specify/`, state file, etc.)
- [ ] Cancel button closes dialog without action
- [ ] Escape key closes dialog
- [ ] Confirm button triggers command execution

### Command Execution
- [ ] `speckit init --non-interactive` runs in correct project directory
- [ ] Output streams in real-time (not batched)
- [ ] Modal shows running status during execution
- [ ] Exit code displayed on completion

### Post-Execution
- [ ] Project card updates to show new status
- [ ] No page refresh required
- [ ] Status changes from `not_initialized` to `ready` or `needs_setup`

## US-2: Run Doctor on Error/Warning Projects

### UI Verification
- [ ] "Doctor" button visible on projects with status `error`
- [ ] "Doctor" button visible on projects with status `warning`
- [ ] Button styled appropriately (outline for warning, destructive for error)

### Doctor (Diagnose)
- [ ] No confirmation required for basic doctor
- [ ] Runs `speckit doctor` command
- [ ] Output streams correctly
- [ ] Health issues displayed in output

### Doctor (Auto-Fix)
- [ ] Confirmation required before running
- [ ] Runs `speckit doctor --fix` command
- [ ] Output shows what was fixed
- [ ] Health status updates after completion

## US-3: Scaffold Project Structure

### UI Verification
- [ ] "Scaffold" option available in actions menu (detail page)
- [ ] NOT shown as primary button on card

### Execution
- [ ] Confirmation dialog shows what will be created
- [ ] Runs `speckit scaffold` command
- [ ] Output streams correctly
- [ ] Project status updates after completion

## US-4: Migrate v1 to v2 Schema

### UI Verification
- [ ] "Migrate to v2" option visible only when schema_version is 1.x
- [ ] NOT visible for v2 projects

### Execution
- [ ] Confirmation dialog explains migration
- [ ] Runs `speckit state migrate` command
- [ ] Output streams correctly
- [ ] State updates to v2 schema after completion

## US-5: View Command Output

### Modal Display
- [ ] Modal displays command being run at top
- [ ] Monospace font used for output
- [ ] Fixed height with scrolling for long output
- [ ] Auto-scrolls to bottom as new output arrives

### Color Coding
- [ ] stdout displayed in default text color
- [ ] stderr displayed in red/amber color
- [ ] Clear visual distinction between output types

### Completion Indicators
- [ ] Green checkmark shown on success (exit code 0)
- [ ] Red X shown on failure (non-zero exit code)
- [ ] Execution time displayed

### Copy Functionality
- [ ] Copy button visible
- [ ] Clicking copies all output to clipboard
- [ ] Toast/feedback shown after copy

### Modal Behavior
- [ ] Modal stays open until explicitly closed
- [ ] Close button (X) works
- [ ] Clicking outside modal does NOT close it during execution

## Detail Page Integration

### Actions Menu
- [ ] Dropdown menu visible in project detail header
- [ ] Menu groups: Setup, Maintenance, Advanced
- [ ] All actions listed in appropriate groups
- [ ] Disabled actions show as disabled (e.g., init on ready project)

## Edge Cases

### EC-1: Command Already Running
- [ ] Action buttons disabled while command running
- [ ] Visual indicator showing command is in progress
- [ ] Cannot start second command on same project

### EC-2: Command Fails
- [ ] Error state shown in modal (red indicator)
- [ ] Modal stays open with full output
- [ ] Copy button still works for error output

### EC-3: SSE Connection Lost
- [ ] Reconnecting indicator shown
- [ ] Graceful handling if reconnection fails

### EC-4: Project Path Unavailable
- [ ] All actions disabled for unavailable project
- [ ] Tooltip explains why actions are disabled

## Security

- [ ] `init` command added to allowed-commands.ts
- [ ] All commands go through CLI executor
- [ ] No arbitrary command execution possible
- [ ] Arguments properly sanitized

## Performance

- [ ] Output modal responsive during streaming
- [ ] No UI freezing during long-running commands
- [ ] Reasonable memory usage for large output

## Accessibility

- [ ] Buttons keyboard accessible (Tab navigation)
- [ ] Confirmation dialog can be canceled with Escape
- [ ] Modal focus trapped correctly
- [ ] Screen reader announces modal opening/closing
