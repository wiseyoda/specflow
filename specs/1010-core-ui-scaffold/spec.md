# Feature Specification: Core UI Scaffold

**Feature Branch**: `1010-core-ui-scaffold`
**Created**: 2026-01-17
**Status**: Draft
**Input**: Phase 1010 from ROADMAP.md - Establish dashboard foundation with routing, layout, and project list view.

---

## User Scenarios & Testing

### User Story 1 - View All Projects (Priority: P1)

As a developer, I run `speckit dashboard` and see all my SpecKit projects listed in a web interface with their current status.

**Why this priority**: Core value proposition - developers need to see their projects at a glance before any other dashboard feature matters.

**Independent Test**: Can be fully tested by running `speckit dashboard`, opening the browser, and verifying projects from `~/.speckit/registry.json` appear in the list.

**Acceptance Scenarios**:

1. **Given** I have 3 registered projects, **When** I run `speckit dashboard` and open localhost:3000, **Then** I see all 3 projects listed with their names and paths
2. **Given** I have no registered projects, **When** I open the dashboard, **Then** I see an empty state with instructions to register a project
3. **Given** I'm viewing the project list, **When** I click a project, **Then** it expands inline to show more details (phase status, task progress)

---

### User Story 2 - Toggle Dark Mode (Priority: P2)

As a developer, I can toggle between dark and light themes, with the dashboard respecting my system preference by default.

**Why this priority**: Visual comfort for developers who work at night. Expected feature in modern dev tools.

**Independent Test**: Can be tested by clicking the theme toggle and verifying colors change. Verify system preference detection by changing OS theme.

**Acceptance Scenarios**:

1. **Given** my system is set to dark mode, **When** I open the dashboard for the first time, **Then** it displays in dark theme
2. **Given** I'm in dark mode, **When** I click the theme toggle, **Then** the dashboard switches to light mode
3. **Given** I manually set a theme, **When** I reload the page, **Then** my preference persists

---

### User Story 3 - Open Command Palette (Priority: P3)

As a developer, I can press Cmd+K (or Ctrl+K on Linux/Windows) to open a command palette for quick navigation.

**Why this priority**: Foundation for keyboard-driven workflow. This phase only implements the shell (opens/closes), not full functionality.

**Independent Test**: Can be tested by pressing Cmd+K and verifying the palette opens with placeholder content.

**Acceptance Scenarios**:

1. **Given** I'm viewing the dashboard, **When** I press Cmd+K, **Then** a modal command palette opens
2. **Given** the command palette is open, **When** I press Escape, **Then** it closes
3. **Given** the command palette is open, **When** I click outside it, **Then** it closes

---

### User Story 4 - Dashboard CLI Command (Priority: P1)

As a developer, I run `speckit dashboard` to start the web server, with options for development or production mode.

**Why this priority**: Entry point for all dashboard functionality. Must work reliably before any UI features matter.

**Independent Test**: Can be tested by running `speckit dashboard` and verifying server starts on expected port.

**Acceptance Scenarios**:

1. **Given** Node.js and pnpm are installed, **When** I run `speckit dashboard`, **Then** the server starts on port 3000 (or next available)
2. **Given** the server is running, **When** I run `speckit dashboard --dev`, **Then** it starts in development mode with hot reload
3. **Given** pnpm is not installed, **When** I run `speckit dashboard`, **Then** I see a helpful error message explaining how to install it

---

### Edge Cases

- What happens when registry.json doesn't exist? → Show empty state with "No projects registered" message
- What happens when registry.json is malformed? → Show error state with "Unable to read projects" and suggest `speckit doctor`
- What happens when a registered project path no longer exists? → Mark project as "unavailable" in the list
- What happens when port 3000 is in use? → Try ports 3001-3010, display actual port in CLI output

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST start a Next.js web server when `speckit dashboard` is run
- **FR-002**: System MUST read project list from `~/.speckit/registry.json`
- **FR-003**: System MUST validate registry data against Zod schema
- **FR-004**: System MUST display projects in a list with name, path, and status badge
- **FR-005**: System MUST expand project details inline when clicked
- **FR-006**: System MUST support dark/light mode toggle with system preference detection
- **FR-007**: System MUST persist theme preference in localStorage
- **FR-008**: System MUST open command palette on Cmd+K (Ctrl+K on non-Mac)
- **FR-009**: System MUST poll for file changes every 5 seconds and refresh project data
- **FR-010**: System MUST follow production mode by default, with `--dev` flag for development
- **FR-011**: System MUST display helpful error if pnpm or Node.js is missing

### Monorepo Structure

- **FR-020**: Project MUST use pnpm workspaces with `packages/` directory
- **FR-021**: Dashboard app MUST be in `packages/dashboard/` using Next.js 14+ App Router
- **FR-022**: Shared schemas MUST be in `packages/shared/` with Zod definitions
- **FR-023**: All packages MUST use TypeScript 5.x in strict mode

### Key Entities

- **Project**: A registered SpecKit project with `id` (UUID), `name`, `path`, `registered_at`, `last_seen`
- **Registry**: The central collection of all projects stored in `~/.speckit/registry.json`
- **Theme**: User preference for dark/light mode, stored in localStorage

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `speckit dashboard` starts server within 5 seconds in production mode
- **SC-002**: All projects from registry.json appear in the UI with correct names and paths
- **SC-003**: Theme toggle completes in under 100ms with no flash
- **SC-004**: Command palette opens in under 100ms after keyboard shortcut
- **SC-005**: Dashboard auto-refreshes project data within 10 seconds of external changes

---

## Non-Goals (Out of Scope)

- Project detail pages with full ROADMAP/task views (future phase)
- SQLite database integration (future phase)
- Agent task execution from dashboard (future phase)
- Full command palette search functionality (future phase - this phase is shell only)
- Mobile responsive design (desktop-only as per tech-stack.md)
- WebSocket real-time updates (future phase - using polling for MVP)
