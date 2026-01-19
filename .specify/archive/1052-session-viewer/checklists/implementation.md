# Implementation Checklist: Session Viewer

**Purpose**: Quality gates during implementation
**Created**: 2026-01-19
**Feature**: [spec.md](../spec.md)

## Code Quality

- [x] I-001 All TypeScript files use strict mode
- [x] I-002 No `any` types - use `unknown` or specific types
- [x] I-003 All external data validated with proper error handling
- [x] I-004 Component props have TypeScript interfaces

## Component Implementation

- [x] I-005 SessionViewerDrawer follows QuestionDrawer patterns
- [x] I-006 Sheet component used for slide-out panel
- [x] I-007 ScrollArea component used for message list
- [x] I-008 Auto-scroll logic implemented with scroll event detection

## API Implementation

- [x] I-009 API route follows existing /api/workflow/* patterns
- [x] I-010 Error responses include helpful messages
- [x] I-011 File paths validated before access
- [x] I-012 Tail mode limits messages to ~100

## Hook Implementation

- [x] I-013 Polling interval is 3 seconds
- [x] I-014 Polling stops when session reaches terminal state
- [x] I-015 Hook returns loading and error states
- [x] I-016 Hook cleans up intervals on unmount

## Integration

- [x] I-017 Session button in header follows existing button patterns
- [x] I-018 Drawer state managed in page component
- [x] I-019 Session ID passed from workflow execution state
- [x] I-020 Project path retrieved from project registry

## Styling

- [x] I-021 User messages have distinct background (blue tint)
- [x] I-022 Assistant messages have neutral background
- [x] I-023 Timestamps displayed in human-readable format
- [x] I-024 Empty state has icon and helpful message
- [x] I-025 Error state has icon and troubleshooting hint

## Notes

- Check items as you complete each implementation area
- Reference ui-design.md for visual specifications
- Follow existing patterns from QuestionDrawer and OutputDrawer
