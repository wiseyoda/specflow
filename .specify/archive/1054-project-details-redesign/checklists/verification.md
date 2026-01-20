# Verification Checklist: Comprehensive Dashboard UI Redesign

**Purpose**: Post-implementation verification and user acceptance testing
**Created**: 2026-01-19
**Feature**: [spec.md](../spec.md)

## User Story Verification

### US1 - Design System Foundation

- [ ] V-001 Tailwind colors render correctly (test by inspecting computed styles)
- [ ] V-002 Animations run smoothly at 60fps (no jank or stuttering)
- [ ] V-003 StatusPill component displays all 4 states correctly

### US2 - Icon Sidebar Navigation

- [ ] V-004 All 4 navigation icons (Dashboard, Session, Tasks, History) are visible
- [ ] V-005 Clicking each icon switches to the corresponding view
- [ ] V-006 Tooltips appear on hover showing label and keyboard shortcut
- [ ] V-007 Active icon has white text, background, and left pip indicator
- [ ] V-008 Inactive icons are zinc/gray colored
- [ ] V-009 Live indicator (green dot) appears on Session icon when workflow running
- [ ] V-010 Warning indicator (amber dot) appears on Session icon when workflow waiting

### US3 - Header with Status Pill

- [ ] V-011 Status pill is centered in header
- [ ] V-012 "Ready" state shows gray styling, no timer
- [ ] V-013 "Running" state shows green glow, pulsing dot, and timer counting up
- [ ] V-014 "Input Needed" state shows amber glow, pulsing dot, and timer
- [ ] V-015 "Failed" state shows red glow, static dot, no timer

### US4 - Dashboard Welcome View

- [ ] V-016 Dashboard view shows when idle (no active workflow)
- [ ] V-017 "Ready to build?" greeting is displayed
- [ ] V-018 Current phase number and completion percentage shown
- [ ] V-019 Primary action card (Resume Implementation) is clickable
- [ ] V-020 Secondary action buttons (Orchestrate, Design, Verify) are clickable
- [ ] V-021 Stats row shows correct Done/Pending/Progress numbers

### US5 - Session Console View

- [ ] V-022 Session view displays when Session icon clicked
- [ ] V-023 Messages show timestamps, agent names, and badges
- [ ] V-024 Reasoning messages have indigo "reasoning" badge
- [ ] V-025 Action messages have green "action" badge
- [ ] V-026 Tool calls display as syntax-highlighted code blocks
- [ ] V-027 Typing indicator shows when workflow is processing
- [ ] V-028 Empty state shows when no workflow running with "Start Workflow" CTA

### US6 - Omni-Box Input

- [ ] V-029 Omni-box is visible at bottom of Session view
- [ ] V-030 State badge matches current workflow status
- [ ] V-031 Placeholder text changes based on state
- [ ] V-032 Gradient glow appears when input is focused
- [ ] V-033 Pressing Enter sends message to workflow
- [ ] V-034 ⌘K focuses the omni-box from anywhere

### US7 - Decision Toast

- [ ] V-035 Toast appears when workflow enters "waiting_for_input" state
- [ ] V-036 Toast is positioned at bottom-center of screen
- [ ] V-037 Animated beam progress indicator is visible
- [ ] V-038 Question text is displayed
- [ ] V-039 Option buttons are arranged in 2 columns
- [ ] V-040 Clicking an option submits answer and dismisses toast
- [ ] V-041 "Provide custom instructions" expands for text input

### US8 - Failed Toast

- [ ] V-042 Toast appears when workflow status is "failed"
- [ ] V-043 Toast has red theme with error icon
- [ ] V-044 Error message is displayed in code block
- [ ] V-045 Dismiss button hides toast and sets status to idle
- [ ] V-046 Retry button restarts the workflow

### US9 - Tasks Kanban View

- [ ] V-047 Tasks view shows 2 columns: "To Do" and "Done"
- [ ] V-048 Progress bar shows in header (X of Y complete)
- [ ] V-049 Task cards show ID, priority badge (if applicable), description
- [ ] V-050 Completed tasks show strikethrough text and check icon
- [ ] V-051 Column counts are correct

### US10 - History Timeline View

- [ ] V-052 History view shows timeline on left, detail panel on right
- [ ] V-053 Phases are listed in timeline with number and name
- [ ] V-054 Clicking a phase selects it and updates detail panel
- [ ] V-055 Detail panel shows summary text
- [ ] V-056 Detail panel shows sessions list with date, skill, cost
- [ ] V-057 Detail panel shows artifact links (spec.md, plan.md, etc.)

### US11 - Context Drawer

- [ ] V-058 Context button in header toggles drawer open/closed
- [ ] V-059 Drawer has two tabs: Context and Activity
- [ ] V-060 Context tab shows current task card with progress
- [ ] V-061 Context tab shows touched files with +/- line counts
- [ ] V-062 Context tab shows phase progress stepper (4 steps)
- [ ] V-063 Activity tab shows recent activity with colored dots

### US12 - Project List Redesign

- [ ] V-064 Project list page uses icon sidebar
- [ ] V-065 Project cards use glass morphism styling
- [ ] V-066 Status indicators on cards match new design
- [ ] V-067 Visual consistency with project details page

### US13 - Visual Polish

- [ ] V-068 Grid background pattern is visible on all pages
- [ ] V-069 Floating orbs are visible and animating slowly
- [ ] V-070 View transitions are animated (fade/slide)
- [ ] V-071 Glass effects (backdrop-blur) work correctly
- [ ] V-072 Custom scrollbars are styled

## UI Design Verification

- [ ] V-UI1 UI implementation matches ui-design.md mockups
- [ ] V-UI2 All components from Component Inventory are implemented
- [ ] V-UI3 All interactions from Interactions table work as specified
- [ ] V-UI4 Design constraints from ui-design.md are respected
- [ ] V-UI5 Color palette matches mockup exactly

## Keyboard Shortcuts

- [ ] V-073 ⌘K focuses omni-box from any view
- [ ] V-074 ⌘1 navigates to Dashboard
- [ ] V-075 ⌘2 navigates to Session
- [ ] V-076 ⌘3 navigates to Tasks
- [ ] V-077 ⌘4 navigates to History
- [ ] V-078 Shortcuts work in Safari, Chrome, and Firefox

## Regression Testing

- [ ] V-079 Starting a workflow still works (via Dashboard or existing mechanisms)
- [ ] V-080 Cancelling a workflow still works
- [ ] V-081 Answering questions via toast or omni-box works
- [ ] V-082 Real-time message updates in Session view work
- [ ] V-083 Task completion updates in Tasks view work
- [ ] V-084 No console errors during normal operation
- [ ] V-085 Page loads without hydration errors

## Performance

- [ ] V-086 Initial page load is under 3 seconds
- [ ] V-087 View transitions feel instant (<300ms)
- [ ] V-088 Animations run at 60fps (no dropped frames)
- [ ] V-089 No memory leaks during extended use

## Notes

- Check items off as completed: `[x]`
- Test in both Chrome and Safari
- Use mockup as reference: `mockups/project-details-redesign/index-v3.html`
- Report any discrepancies with expected behavior
