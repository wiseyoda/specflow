# Feature Specification: UX Simplification

**Phase**: 0050
**Feature ID**: ux-simplification
**Version**: 1.0.0
**Created**: 2026-01-11
**Status**: Draft

---

## 1. Overview

### 1.1 Goal

Reduce cognitive load and streamline the SpecKit user experience by consolidating entry points, removing orphaned code, unifying similar commands, and adding UI/UX design artifact support for visual phases.

### 1.2 Problem Statement

SpecKit has accumulated complexity through organic growth:
- Users face confusion about which commands to use
- Orphaned/duplicate code exists in the repository
- Overlapping functionality between commands (e.g., `/speckit.memory` vs `/speckit.memory-init`)
- CLAUDE.md becomes bloated in target projects
- No design documentation process for UI-heavy phases

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Entry point usage | 90%+ sessions via `/speckit.start` | Documentation directs to it |
| Codebase cleanliness | 0 orphaned scripts | Audit of scripts/bash/ |
| Command clarity | Single `/speckit.memory` covers all needs | No memory command confusion |
| CLAUDE.md size | ≤15 lines for SpecKit section | Line count |
| UI phase coverage | 100% of UI phases have design.md | Verification gate check |

---

## 2. Scope

### 2.1 In Scope

**Code Cleanup**:
- Delete orphaned scripts from `.specify/scripts/bash/`
- Remove `/speckit.issue` slash command (CLI works directly)
- Consolidate `/speckit.memory` and `/speckit.memory-init`

**Documentation Overhaul**:
- Update README.md to recommend `/speckit.start`
- Split CLAUDE.md: minimal pointer (~10 lines) + detailed `.specify/USAGE.md`
- Update all docs/ files (8 files)
- Update slash command handoffs (10 commands) to point to `/speckit.start`
- Update `bin/speckit` help text

**UI/UX Design Artifacts**:
- Add UI detection to `/speckit.specify`
- Create `ui/design.md` for UI phases
- Add design verification to `/speckit.plan`
- Create `templates/ui-design-template.md`

**State Simplification**:
- Derive step completion from filesystem artifacts
- Update `speckit status --json` to report derived state

### 2.2 Out of Scope

- Adding new features (pure simplification)
- Performance optimization
- Web UI changes (Phase 1010)
- Major architectural rewrites
- PDR system removal (explicitly kept)

### 2.3 Constraints

- Must preserve all existing functionality
- Must maintain backward compatibility
- Must keep edge case handling already implemented
- Must NOT break existing state files

---

## 3. User Stories

### US-001: Single Entry Point
**As a** SpecKit user,
**I want to** always start with `/speckit.start` and have it route me correctly,
**So that** I don't need to remember which command to use for my current situation.

**Acceptance Criteria**:
- [ ] All documentation recommends `/speckit.start` as primary entry
- [ ] All slash command handoffs point to `/speckit.start`
- [ ] `bin/speckit` help text mentions `/speckit.start`

### US-002: Direct CLI for Simple Operations
**As a** developer working in my terminal,
**I want to** run `speckit issue create "bug description"` directly,
**So that** I don't need a slash command wrapper for straightforward CLI operations.

**Acceptance Criteria**:
- [ ] `/speckit.issue` slash command deleted
- [ ] CLI `speckit issue` remains fully functional
- [ ] Documentation shows direct CLI usage

### US-003: Unified Memory Management
**As a** user managing my project's memory documents,
**I want to** use one command (`/speckit.memory`) with clear subcommands,
**So that** I don't confuse `/speckit.memory` vs `/speckit.memory-init`.

**Acceptance Criteria**:
- [ ] `/speckit.memory generate` handles codebase analysis (was memory-init)
- [ ] `/speckit.memory-init` errors with message pointing to `/speckit.memory generate`
- [ ] Single `/speckit.memory --help` shows all subcommands

**Clarification**: Deprecated commands error with instructions (not warning+execute) to keep context clean.

### US-004: Clean Codebase
**As a** contributor or maintainer,
**I want to** see only active, used code in the repository,
**So that** I can understand the system without wading through orphaned scripts.

**Acceptance Criteria**:
- [ ] `.specify/scripts/bash/` directory deleted (orphaned scripts)
- [ ] No duplicate `common.sh` files exist
- [ ] All scripts in `scripts/bash/` are actively used

### US-005: Filesystem-Derived State
**As a** user resuming work after context loss,
**I want to** have SpecKit figure out where I am from my files,
**So that** state corruption doesn't block my progress.

**Acceptance Criteria**:
- [ ] `speckit status --json` derives step completion from artifacts
- [ ] State file tracks only: phase, blockers, user gates
- [ ] Recovery works even with outdated state file

### US-006: UI Design Documentation
**As a** developer working on a UI-heavy phase,
**I want** the system to auto-detect UI phases and create design documentation,
**So that** UI decisions are explicit and reviewable before implementation.

**Acceptance Criteria**:
- [ ] `/speckit.specify` detects UI keywords in phase scope
- [ ] `specs/XXXX/ui/design.md` created for UI phases
- [ ] `/speckit.plan` verifies design.md exists for UI phases
- [ ] `templates/ui-design-template.md` exists

### US-007: Minimal CLAUDE.md
**As a** project maintainer,
**I want** SpecKit to add minimal content (~10 lines) to my CLAUDE.md,
**So that** my project's instructions stay concise and focused.

**Acceptance Criteria**:
- [ ] SpecKit section in target CLAUDE.md ≤15 lines
- [ ] Detailed reference in `.specify/USAGE.md`
- [ ] `speckit claude-md merge` uses minimal approach

---

## 4. Deliverables

### 4.1 Code Cleanup

| Deliverable | Action | Target |
|-------------|--------|--------|
| `.specify/scripts/bash/` | DELETE directory | Delete orphaned scripts (setup-plan.sh, update-agent-context.sh, create-new-feature.sh, common.sh) |
| `commands/speckit.issue.md` | DELETE | Remove slash command wrapper |
| `commands/speckit.memory.md` | UPDATE | Add `generate` subcommand handling |
| `commands/speckit.memory-init.md` | DEPRECATE | Add pointer to `/speckit.memory generate` |
| `scripts/bash/speckit-status.sh` | UPDATE | Derive state from filesystem |

### 4.2 Documentation Updates

| Deliverable | Action | Notes |
|-------------|--------|-------|
| `README.md` | UPDATE | Recommend `/speckit.start` as primary entry |
| `CLAUDE.md` | UPDATE | Minimal SpecKit section (~10 lines) |
| `.specify/USAGE.md` | CREATE | Full CLI reference, syntax notes |
| `speckit claude-md merge` | UPDATE | Use minimal approach |
| `bin/speckit` | UPDATE | Help text recommends `/speckit.start` |

**docs/ folder (8 files)**:
| File | Action | Notes |
|------|--------|-------|
| `docs/cli-reference.md` | UPDATE | Current commands |
| `docs/slash-commands.md` | UPDATE | Recommend /speckit.start |
| `docs/integration-guide.md` | UPDATE | Workflow examples |
| `docs/project-structure.md` | VERIFY | Accuracy check |
| `docs/configuration.md` | VERIFY | Accuracy check |
| `docs/troubleshooting.md` | UPDATE | Current diagnostics |
| `docs/templates.md` | VERIFY | Accuracy check |
| `docs/COMMAND-AUDIT.md` | UPDATE/ARCHIVE | If stale |

**Slash Command Handoffs (10 commands)**:
| Command | Action |
|---------|--------|
| `commands/speckit.init.md` | Add handoff to /speckit.start |
| `commands/speckit.orchestrate.md` | Update handoffs |
| `commands/speckit.verify.md` | Update handoffs |
| `commands/speckit.merge.md` | Update handoffs |
| `commands/speckit.backlog.md` | Update handoffs |
| `commands/speckit.review.md` | Update handoffs |
| `commands/speckit.roadmap.md` | Update handoffs |
| `commands/speckit.constitution.md` | Update handoffs |
| `commands/speckit.phase.md` | Update handoffs |
| `commands/speckit.specify.md` | Update handoffs + UI detection |

### 4.3 UI/UX Design Artifacts

| Deliverable | Action | Notes |
|-------------|--------|-------|
| `commands/speckit.specify.md` | UPDATE | Add UI detection, design.md generation |
| `commands/speckit.plan.md` | UPDATE | Add UI design verification |
| `templates/ui-design-template.md` | CREATE | Template for design.md |

---

## 5. Technical Requirements

### 5.1 UI Detection Keywords

The following keywords in phase scope/goal trigger UI design documentation:
- dashboard, form, button, screen, page, view, component
- interface, modal, dialog, panel, widget, layout
- navigation, menu, sidebar, header, footer

### 5.2 design.md Structure

```markdown
# UI/UX Design: [Phase Name]

## Current State (Before)
[Description or "New feature - no existing UI"]

## Proposed Design (After)
[Description of proposed UI]

### Visual Mockup
[ASCII mockup or Mermaid diagram]

## Rationale
[Why these design decisions]

## Component Inventory
| Component | Type | Notes |
|-----------|------|-------|
```

### 5.3 CLAUDE.md Minimal Section

```markdown
## SpecKit

This project uses SpecKit for spec-driven development.

**Quick Start**: Run `/speckit.start` - it routes you to the right command.

**CLI**: `speckit --help` for all commands
**Full Reference**: See `.specify/USAGE.md`
```

### 5.4 State Derivation Logic

`speckit status --json` derives step completion:
- specify: `spec.md` exists and non-empty
- clarify: `spec.md` has no `[NEEDS CLARIFICATION]` markers
- plan: `plan.md` exists
- tasks: `tasks.md` exists
- analyze: analyze markers removed from artifacts
- checklist: `checklists/verification.md` exists
- implement: all task checkboxes marked
- verify: ROADMAP shows phase complete

---

## 6. Verification Gate

Phase 0050 is complete when:
- [ ] All orphaned scripts deleted (0 scripts in `.specify/scripts/bash/`)
- [ ] `/speckit.issue` slash command removed, CLI documented
- [ ] `/speckit.memory generate` works (replaces memory-init)
- [ ] Documentation recommends `/speckit.start` as primary entry
- [ ] `speckit status --json` derives step completion from artifacts
- [ ] UI phases auto-generate `ui/design.md`
- [ ] CLAUDE.md SpecKit section ≤15 lines
- [ ] `.specify/USAGE.md` exists with full reference

---

## 7. Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Phase 0042 complete | Blocking | Complete |
| Existing CLI commands | Required | Available |
| Existing slash commands | Required | Available |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing workflows | Low | High | Backward compatibility preserved |
| Memory command confusion during transition | Medium | Low | Clear deprecation message |
| Missing UI keyword in detection | Low | Low | Expandable keyword list |

---

## 9. Source PDRs

- `pdr-ux-simplification.md` - Core simplification requirements
- `pdr-ui-design-artifacts.md` - UI/UX design documentation requirements
