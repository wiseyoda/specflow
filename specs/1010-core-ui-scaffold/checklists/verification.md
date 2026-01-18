# Verification Checklist: Core UI Scaffold

**Phase**: 1010
**Created**: 2026-01-17
**Purpose**: Post-implementation verification for `/specflow.verify`

---

## User Story Verification

### US1: View All Projects (P1)

- [ ] `specflow dashboard` starts and opens in browser
- [ ] Projects from `~/.specflow/registry.json` appear in list
- [ ] Each project shows name and path
- [ ] Clicking a project expands it inline
- [ ] Empty state appears when no projects registered
- [ ] Projects update within 10 seconds of registry changes (polling)

### US2: Toggle Dark Mode (P2)

- [ ] Dashboard detects system theme on first load
- [ ] Theme toggle button visible in header
- [ ] Clicking toggle switches between dark/light
- [ ] Theme preference persists after page reload
- [ ] No flash of wrong theme on page load

### US3: Command Palette (P3)

- [ ] Pressing Cmd+K (Mac) opens command palette
- [ ] Pressing Ctrl+K (Windows/Linux) opens command palette
- [ ] Pressing Escape closes the palette
- [ ] Clicking outside the palette closes it
- [ ] Keyboard hint visible in header (⌘K)

### US4: CLI Command (P1)

- [ ] `specflow dashboard --help` shows usage
- [ ] `specflow dashboard` starts production server
- [ ] `specflow dashboard --dev` starts development server with hot reload
- [ ] Missing Node.js shows helpful error message
- [ ] Missing pnpm shows helpful error message

---

## Functional Requirements Verification

### Core Functionality

- [ ] FR-001: Next.js server starts via `specflow dashboard`
- [ ] FR-002: Registry file is read correctly
- [ ] FR-003: Invalid registry shows error (not crash)
- [ ] FR-004: Project list displays all projects
- [ ] FR-005: Project cards expand inline on click
- [ ] FR-006: Dark/light mode toggle works
- [ ] FR-007: Theme persists in localStorage
- [ ] FR-008: Cmd+K opens command palette
- [ ] FR-009: Polling refreshes data every 5 seconds
- [ ] FR-010: Production mode by default
- [ ] FR-011: Clear error if dependencies missing

### Monorepo Structure

- [ ] FR-020: `pnpm-workspace.yaml` exists at root
- [ ] FR-021: `packages/dashboard/` contains Next.js app
- [ ] FR-022: `packages/shared/` contains Zod schemas
- [ ] FR-023: TypeScript strict mode enabled (no `any`)

---

## Edge Case Verification

- [ ] Registry doesn't exist → Empty state shown
- [ ] Registry malformed → Error state with doctor suggestion
- [ ] Project path doesn't exist → "Unavailable" badge shown
- [ ] Port 3000 in use → Tries alternate port

---

## Success Criteria Verification

- [ ] SC-001: Server starts within 5 seconds (production)
- [ ] SC-002: All registry projects visible with correct data
- [ ] SC-003: Theme toggle completes in <100ms (no visible delay)
- [ ] SC-004: Command palette opens in <100ms
- [ ] SC-005: Data refreshes within 10 seconds of external change

---

## Build Verification

- [ ] `pnpm install` succeeds in root
- [ ] `pnpm build` succeeds without TypeScript errors
- [ ] `pnpm lint` passes (if configured)
- [ ] No console errors in browser

---

## Constitution Compliance

- [ ] CLI output follows Three-Line Rule (user-critical info first)
- [ ] Error messages are helpful with next steps
- [ ] No direct file edits to state (dashboard is read-only)

---

## Final Checklist

- [ ] All 43 tasks marked complete in tasks.md
- [ ] README updated with dashboard documentation
- [ ] No TODO comments left in code
- [ ] Git branch has all changes committed
