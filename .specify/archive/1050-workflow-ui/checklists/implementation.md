# Implementation Checklist: Workflow UI Integration

**Purpose**: Verify implementation quality during development
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

---

## Requirements Quality

- [x] I-001 All 6 workflow skills defined with descriptions (FR-001, FR-002)
- [x] I-002 Skill picker shows descriptions on hover (FR-002)
- [x] I-003 Start Workflow in project card actions dropdown (FR-004)
- [x] I-004 Start Workflow button in project detail header (FR-005)
- [x] I-005 Confirmation dialog before starting workflow (FR-006, FR-007)

## Status Badge States

- [x] I-006 Running state: blue spinner icon (FR-009)
- [x] I-007 Waiting state: yellow "?" badge (FR-009)
- [x] I-008 Completed state: green checkmark (FR-009)
- [x] I-009 Failed state: red X icon (FR-009)
- [x] I-010 Completed badge fades after 30 seconds (FR-010)

## Status Card

- [x] I-011 Shows skill name (FR-011)
- [x] I-012 Shows current status (FR-011)
- [x] I-013 Shows elapsed time (FR-011)
- [x] I-014 Cancel button works (FR-015)

## Polling & Updates

- [x] I-015 Polls every 3 seconds when workflow active (FR-012)
- [x] I-016 Stops polling on terminal state (FR-013)
- [x] I-017 Status updates immediately in UI (FR-014)
- [x] I-018 Polling uses AbortController for cleanup

## Error Handling

- [x] I-019 Cannot start if workflow already running (FR-015)
- [x] I-020 Toast notifications for API errors (FR-016)
- [x] I-021 Loading states during API calls

## Component Quality

- [x] I-022 Components use shadcn/ui primitives
- [x] I-023 Tailwind CSS for styling (no inline styles)
- [x] I-024 TypeScript strict mode (no any types)
- [x] I-025 Proper cleanup on unmount (intervals, subscriptions)

## Integration

- [x] I-026 ActionsMenu integrates skill picker correctly
- [x] I-027 ProjectCard shows badge in correct position
- [x] I-028 ProjectDetailHeader shows start button
- [x] I-029 StatusView includes WorkflowStatusCard

---

## Notes

- Check items off after implementing each feature
- Run the dashboard and manually verify each item
- Address any unchecked items before marking tasks complete
