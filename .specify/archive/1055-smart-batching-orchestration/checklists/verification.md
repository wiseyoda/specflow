# Verification Checklist: Smart Batching & Orchestration

**Purpose**: Post-implementation verification before USER GATE
**Created**: 2026-01-21
**Feature**: [spec.md](../spec.md)

## USER GATE Items (from Phase File)

These items MUST be verified before phase can be considered complete:

- [ ] V-001 Project detail: "Complete Phase" button is prominent, styled differently
- [ ] V-002 Project detail: Secondary buttons (Orchestrate, Merge, Review, Memory) still work
- [ ] V-003 Project card: "Complete Phase" is first menu item (highlighted)
- [ ] V-004 Project card: "Run Workflow" flyout contains Orchestrate, Merge, Review, Memory
- [ ] V-005 Configuration modal appears when clicking "Complete Phase" (both locations)
- [ ] V-006 Modal shows detected batch count and current phase status
- [ ] V-007 Start orchestration, see batches auto-detected from tasks.md sections
- [ ] V-008 State machine transitions: design → analyze → implement → verify
- [ ] V-009 Batches execute sequentially without user input
- [ ] V-010 Skip options work (skipDesign, skipAnalyze)
- [ ] V-011 Introduce a failure, see auto-heal attempt (uses Claude Helper)
- [ ] V-012 If heal succeeds, execution continues
- [ ] V-013 Progress UI replaces action buttons during orchestration
- [ ] V-014 Auto-merge works when enabled
- [ ] V-015 Pauses at merge-ready when auto-merge disabled
- [ ] V-016 Additional context appears in Claude's output
- [ ] V-017 Budget limits respected (orchestration stops if exceeded)
- [ ] V-018 Decision log shows Claude Helper calls and reasoning

## UI Design Verification

- [ ] V-UI1 UI implementation matches ui-design.md mockups
- [ ] V-UI2 All components from Component Inventory are implemented
- [ ] V-UI3 All interactions from Interactions table work as specified
- [ ] V-UI4 Design constraints from ui-design.md are respected
- [ ] V-UI5 Accessibility considerations from ui-design.md are addressed

## Functional Verification

### Configuration Modal

- [ ] V-020 Core options have correct defaults (all off except auto-heal on)
- [ ] V-021 Advanced options expand/collapse with animation
- [ ] V-022 Budget limits accept valid numeric input only
- [ ] V-023 Start button disabled until valid configuration
- [ ] V-024 Warning shown if no sections detected in tasks.md

### Progress Display

- [ ] V-030 Phase progress bar shows correct phase as current
- [ ] V-031 Batch progress updates as tasks complete
- [ ] V-032 Decision log shows chronological entries
- [ ] V-033 Elapsed time updates in real-time
- [ ] V-034 Estimated remaining time calculated reasonably

### State Management

- [ ] V-040 Orchestration state persists across dashboard refresh
- [ ] V-041 Dashboard restart resumes in-progress orchestration
- [ ] V-042 Cancelled orchestration stops and preserves state
- [ ] V-043 Paused orchestration can be resumed
- [ ] V-044 Second orchestration attempt shows error message

### Error Handling

- [ ] V-050 Batch failure triggers auto-heal when enabled
- [ ] V-051 Heal failure stops orchestration with full context
- [ ] V-052 Budget exceeded stops gracefully with notification
- [ ] V-053 Stale process detected and marked appropriately
- [ ] V-054 Network/API errors show helpful messages

## Integration Verification

- [ ] V-060 Existing workflow buttons still work during non-orchestration
- [ ] V-061 Project card badges update correctly
- [ ] V-062 Orchestration works with projects that have USER GATE
- [ ] V-063 Orchestration works with projects without USER GATE
- [ ] V-064 Works with tasks.md having no ## sections (fallback batching)

## Success Criteria Verification

From spec.md:

- [ ] V-SC1 User can complete 50-task phase with one click and one config
- [ ] V-SC2 Batches execute sequentially with progress visible
- [ ] V-SC3 Auto-healing recovers from common batch failures
- [ ] V-SC4 Orchestration survives dashboard restart
- [ ] V-SC5 Decision log provides clear debugging information
- [ ] V-SC6 Budget limits prevent runaway costs

## Test Coverage Verification

- [ ] V-070 claude-helper.test.ts covers schema validation, errors
- [ ] V-071 orchestration-service.test.ts covers all state transitions
- [ ] V-072 batch-parser.test.ts covers various tasks.md formats
- [ ] V-073 All tests pass: `pnpm test`

## Notes

- Check items off as completed: `[x]`
- Document any findings or issues inline
- All USER GATE items (V-001 through V-018) require manual testing
- Coordinate with user for USER GATE verification
