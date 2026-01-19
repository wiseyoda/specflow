# Verification Checklist: Workflow UI Integration

**Purpose**: Post-implementation verification before phase completion
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

---

## User Story 1 - Start from Card

- [x] V-001 Project card shows Actions dropdown
- [x] V-002 Actions dropdown contains "Start Workflow" with sub-menu
- [x] V-003 Sub-menu shows all 6 skills: design, analyze, implement, verify, orchestrate, merge
- [x] V-004 Skill descriptions visible on hover
- [x] V-005 Selecting skill opens confirmation dialog
- [x] V-006 Dialog shows skill name and project name
- [x] V-007 Cancel button closes dialog without action
- [x] V-008 Start button initiates workflow and closes dialog
- [x] V-009 Status badge appears on card after starting

## User Story 2 - Start from Detail

- [x] V-010 Project detail header shows Start Workflow button
- [x] V-011 Clicking button opens skill picker
- [x] V-012 Selecting skill opens confirmation dialog
- [x] V-013 Starting workflow updates header status badge

## User Story 3 - Monitor on Card

- [x] V-014 Running workflow shows blue spinner badge
- [x] V-015 Waiting workflow shows yellow "?" badge
- [x] V-016 Completed workflow shows green checkmark
- [x] V-017 Failed workflow shows red X badge
- [x] V-018 Completed badge fades after 30 seconds
- [x] V-019 Badge updates within 3 seconds of state change

## User Story 4 - Detail Status

- [x] V-020 Status card visible in project detail
- [x] V-021 Card shows skill name when workflow active
- [x] V-022 Card shows current status (Running, Waiting, etc.)
- [x] V-023 Card shows elapsed time
- [x] V-024 Cancel button visible and functional
- [x] V-025 Card shows "No active workflow" when none running
- [x] V-026 Start Workflow button visible when no workflow active

## Error Handling

- [x] V-027 Error toast shown when API fails
- [x] V-028 Error toast shown when workflow already running
- [x] V-029 Start button disabled during loading

## UI Design Verification

- [x] V-UI1 UI implementation matches ui-design.md mockups
- [x] V-UI2 All components from Component Inventory are implemented
- [x] V-UI3 All interactions from Interactions table work as specified
- [x] V-UI4 Design constraints from ui-design.md are respected
- [x] V-UI5 Accessibility: badges have aria-labels
- [x] V-UI6 Accessibility: dialog is keyboard navigable

## Integration Verification

- [x] V-030 Phase 1048 API routes respond correctly
- [x] V-031 WorkflowExecution type matches API response
- [x] V-032 Polling stops on page navigation
- [x] V-033 Status syncs correctly after page refresh

## USER GATE Verification

From phase file:
- [x] V-GATE1 Start workflow from project card actions menu
- [x] V-GATE2 Start workflow from project detail header
- [x] V-GATE3 See skill picker with all /flow.* options
- [x] V-GATE4 See status badge update as workflow progresses

---

## Notes

- All V-GATE items must pass for phase completion
- Run the dashboard with an actual project to verify
- Test with both running and completed workflows
