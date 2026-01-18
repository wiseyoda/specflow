# Requirements Checklist: Core UI Scaffold

**Phase**: 1010
**Created**: 2026-01-17
**Source**: spec.md

---

## Functional Requirements

### Core Functionality
- [ ] FR-001: System starts Next.js web server via `specflow dashboard`
- [ ] FR-002: System reads project list from `~/.specflow/registry.json`
- [ ] FR-003: System validates registry data against Zod schema
- [ ] FR-004: System displays projects in list with name, path, status badge
- [ ] FR-005: System expands project details inline when clicked
- [ ] FR-006: System supports dark/light mode toggle with system preference
- [ ] FR-007: System persists theme preference in localStorage
- [ ] FR-008: System opens command palette on Cmd+K / Ctrl+K
- [ ] FR-009: System polls for file changes every 5 seconds
- [ ] FR-010: System uses production mode by default, --dev for development
- [ ] FR-011: System displays helpful error if pnpm or Node.js missing

### Monorepo Structure
- [ ] FR-020: Project uses pnpm workspaces with `packages/` directory
- [ ] FR-021: Dashboard app in `packages/dashboard/` with Next.js 14+ App Router
- [ ] FR-022: Shared schemas in `packages/shared/` with Zod definitions
- [ ] FR-023: All packages use TypeScript 5.x strict mode

---

## User Stories Completion

### US-1: View All Projects (P1)
- [ ] Projects from registry.json displayed in UI
- [ ] Empty state shown when no projects registered
- [ ] Project click expands inline details

### US-2: Toggle Dark Mode (P2)
- [ ] System preference detected on first load
- [ ] Theme toggle switches between dark/light
- [ ] Theme preference persists across reloads

### US-3: Open Command Palette (P3)
- [ ] Cmd+K opens command palette modal
- [ ] Escape closes command palette
- [ ] Click outside closes command palette

### US-4: Dashboard CLI Command (P1)
- [ ] `specflow dashboard` starts server on port 3000
- [ ] `specflow dashboard --dev` starts in development mode
- [ ] Helpful error when pnpm/Node.js missing

---

## Edge Cases

- [ ] Registry.json doesn't exist → Empty state message
- [ ] Registry.json malformed → Error state with doctor suggestion
- [ ] Project path doesn't exist → Mark project as "unavailable"
- [ ] Port 3000 in use → Try ports 3001-3010

---

## Success Criteria

- [ ] SC-001: Server starts within 5 seconds (production)
- [ ] SC-002: All registry projects appear with correct data
- [ ] SC-003: Theme toggle completes in under 100ms
- [ ] SC-004: Command palette opens in under 100ms
- [ ] SC-005: Dashboard auto-refreshes within 10 seconds of changes
