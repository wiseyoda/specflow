# Verification Checklist: Project Detail Views

> Post-completion verification for Phase 1030

**Phase**: 1030
**Created**: 2026-01-17

---

## Navigation (R1)

- [ ] **VC-01**: Clicking a project card navigates to `/projects/[id]`
- [ ] **VC-02**: Project UUID appears in URL
- [ ] **VC-03**: Invalid project ID shows error/404 state
- [ ] **VC-04**: Back button/breadcrumb returns to project list

## Status View (R2, US1)

- [ ] **VC-05**: Status view is the default tab
- [ ] **VC-06**: Current phase name and number displayed
- [ ] **VC-07**: Phase status indicator shows correctly (in_progress, complete)
- [ ] **VC-08**: Health status displayed (healthy, warning, error)
- [ ] **VC-09**: Task progress shows (completed/total with percentage)
- [ ] **VC-10**: Current orchestration step displayed
- [ ] **VC-11**: Project metadata visible (path, registered date)
- [ ] **VC-12**: Status updates in real-time when state changes

## Kanban View (R3, US2, US3)

- [ ] **VC-13**: Tab switches to Kanban view
- [ ] **VC-14**: Three columns displayed: Todo, In Progress, Done
- [ ] **VC-15**: Tasks show in correct columns based on checkbox state
- [ ] **VC-16**: Task cards display ID and description
- [ ] **VC-17**: Tasks update in real-time when tasks.md changes
- [ ] **VC-18**: Projects without tasks.md show helpful message

## Timeline View (R4, US2, US4)

- [ ] **VC-19**: Tab switches to Timeline view
- [ ] **VC-20**: Completed phases displayed chronologically
- [ ] **VC-21**: Current active phase highlighted
- [ ] **VC-22**: Phase dates/timestamps visible

## View Management (R5, US2)

- [ ] **VC-23**: Tabs switch between all three views
- [ ] **VC-24**: Selected view persists after page refresh
- [ ] **VC-25**: View preference is per-project (not global)
- [ ] **VC-26**: Smooth transitions between views (no flash)

## Edge Cases (E1-E4)

- [ ] **VC-27**: Project without orchestration state shows message
- [ ] **VC-28**: Empty task list shows empty state message
- [ ] **VC-29**: SSE disconnection shows status indicator
- [ ] **VC-30**: Loading states display skeleton/spinner

---

## Verification Instructions

### Test Navigation
1. Start dashboard: `cd packages/dashboard && pnpm dev`
2. Click any project card
3. Verify URL is `/projects/{uuid}`
4. Click back button or breadcrumb

### Test Status View
1. On project detail page, verify default is Status tab
2. Run `specflow state set "health.status=warning"` in project terminal
3. Verify health indicator updates in dashboard

### Test Kanban View
1. Click Kanban tab
2. Verify task columns display correctly
3. In project terminal, mark a task: `specflow tasks mark T001`
4. Verify task moves to Done column

### Test Timeline View
1. Click Timeline tab
2. Verify completed phases shown
3. Verify current phase highlighted

### Test Persistence
1. Select Kanban view
2. Refresh page
3. Verify still on Kanban view
4. Navigate to different project
5. Return to original project
6. Verify Kanban view still selected

---

## Pass Criteria

- **Minimum**: VC-01 through VC-12 (Navigation + Status View) = 12 checks
- **Target**: All VC-01 through VC-30 = 30 checks
- **Phase Gate**: USER VERIFICATION REQUIRED per ROADMAP
