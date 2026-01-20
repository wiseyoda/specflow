# Implementation Checklist: Comprehensive Dashboard UI Redesign

**Purpose**: Guide implementation quality and ensure requirements are correctly addressed
**Created**: 2026-01-19
**Feature**: [spec.md](../spec.md)

## Design System Foundation

- [ ] I-001 Tailwind color palette matches mockup exactly (surface-50 through surface-500, accent, success, warning, danger)
- [ ] I-002 All animation keyframes are defined (glow-pulse, slide-up, beam, float) with correct timing
- [ ] I-003 StatusPill component supports all 4 states with correct colors and glow effects
- [ ] I-004 GlassCard uses backdrop-filter with webkit prefix for Safari support
- [ ] I-005 GridBackground pattern matches mockup (32px grid, subtle indigo color)
- [ ] I-006 FloatingOrbs use absolute positioning with z-index 0 to stay behind content

## Layout Structure

- [ ] I-007 Icon sidebar is exactly 64px wide (w-16)
- [ ] I-008 Header is exactly 56px tall (h-14)
- [ ] I-009 Context drawer is 288px wide (w-72) when open
- [ ] I-010 Sidebar nav items have tooltip with label AND keyboard shortcut
- [ ] I-011 Active nav item shows left pip indicator (4px wide, accent color)
- [ ] I-012 Session nav item shows pulsing green dot when workflow running
- [ ] I-013 Session nav item shows pulsing amber dot when workflow waiting
- [ ] I-014 Header status pill is centered using absolute positioning
- [ ] I-015 Status pill timer counts up in MM:SS format

## Views Implementation

- [ ] I-016 Dashboard welcome view only shows when activeView='dashboard' AND status='idle'
- [ ] I-017 Primary action card shows current task from project context
- [ ] I-018 Secondary action buttons trigger correct workflow skills (implement, orchestrate, design, verify)
- [ ] I-019 Session console uses existing use-session-messages hook for data
- [ ] I-020 Session messages show timestamp in HH:MM:SS format
- [ ] I-021 Agent attribution uses @name format with accent color
- [ ] I-022 Reasoning badge is accent/indigo colored
- [ ] I-023 Action badge is green/success colored
- [ ] I-024 Tool call blocks have syntax highlighting (use existing code styling)
- [ ] I-025 Tasks kanban has exactly 2 columns (To Do, Done) - no In Progress
- [ ] I-026 Completed tasks show strikethrough text and check icon

## Input & Notifications

- [ ] I-027 OmniBox shows different placeholder for each state (idle=Ready, running=Live, waiting=Waiting, failed=Failed)
- [ ] I-028 OmniBox gradient glow appears on focus/hover
- [ ] I-029 OmniBox state badge matches current workflow status
- [ ] I-030 Decision toast positions at bottom-center (fixed positioning)
- [ ] I-031 Decision toast has animated beam progress indicator
- [ ] I-032 Decision toast option buttons are in 2-column grid
- [ ] I-033 Failed toast shows error message in code block styling
- [ ] I-034 Failed toast Retry button restarts workflow

## History & Context

- [ ] I-035 History timeline shows phases in chronological order (newest first)
- [ ] I-036 Selected phase updates detail panel on right
- [ ] I-037 Phase detail shows summary, sessions list, and artifact links
- [ ] I-038 Context drawer has 2 tabs: Context and Activity
- [ ] I-039 Context tab shows current task with progress bar
- [ ] I-040 Touched files show file path and +/- line counts
- [ ] I-041 Phase progress stepper has 4 steps: Discovery, Design, Implement, Verify

## Project List

- [ ] I-042 Project cards use GlassCard component
- [ ] I-043 Project cards show status pill matching project state
- [ ] I-044 Project list page uses same layout shell as project details
- [ ] I-045 Visual styling is consistent between list and details pages

## Keyboard Shortcuts

- [ ] I-046 ⌘K focuses omni-box from any view
- [ ] I-047 ⌘1 navigates to Dashboard view
- [ ] I-048 ⌘2 navigates to Session view
- [ ] I-049 ⌘3 navigates to Tasks view
- [ ] I-050 ⌘4 navigates to History view
- [ ] I-051 Keyboard shortcuts work with Ctrl as well as Cmd (Windows/Linux)

## Data Integration

- [ ] I-052 Workflow status comes from use-workflow-execution hook
- [ ] I-053 Session messages come from use-session-messages hook
- [ ] I-054 Tasks data comes from ConnectionContext (tasks Map)
- [ ] I-055 Project data comes from ConnectionContext (registry, states)
- [ ] I-056 Answer submission uses existing workflow answer API

## Notes

- Check items off as completed: `[x]`
- Reference mockup at `mockups/project-details-redesign/index-v3.html` for visual verification
- Use browser dev tools to verify exact measurements and colors
