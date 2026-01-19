# Phase 1051 - Tasks: Questions & Notifications

## Section A: Notification Infrastructure

- [x] T001: Create notifications.ts library with permission/show functions
- [x] T002: Add notification permission request to workflow start flow
- [x] T003: Trigger notification when workflow enters waiting_for_input state

## Section B: Question Badge Component

- [x] T004: Create QuestionBadge component with yellow "?" icon and count
- [x] T005: Add QuestionBadge to ProjectCard for waiting workflows
- [x] T006: Add QuestionBadge to ProjectDetailHeader

## Section C: Question Drawer Component

- [x] T007: Create QuestionDrawer shell with Sheet, header, and footer
- [x] T008: Implement single-select question rendering with RadioGroup
- [x] T009: Implement multi-select question rendering with Checkboxes
- [x] T010: Implement free-text question rendering with Textarea
- [x] T011: Implement answer validation (all questions answered)
- [x] T012: Create FollowUpInput component for optional text
- [x] T013: Wire up submit button with loading state and error handling

## Section D: Integration

- [x] T014: Integrate QuestionDrawer into StatusView component
- [x] T015: Wire QuestionBadge click to open drawer
- [x] T016: Auto-open drawer when questions arrive
- [x] T017: Close drawer and show success toast on answer submission
