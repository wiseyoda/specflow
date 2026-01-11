# Feature Specification: Roadmap Flexibility

**Feature Branch**: `0010-roadmap-flexibility`
**Created**: 2026-01-10
**Status**: Draft
**Input**: ROADMAP.md Phase 0010

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Insert Hotfix Phase (Priority: P1)

As a developer, I need to insert an urgent hotfix phase after user testing discovers issues, without having to renumber all subsequent phases.

**Why this priority**: Critical for real-world roadmap management. Without this, developers must manually renumber phases or use workarounds when priorities shift.

**Independent Test**: Can be fully tested by running `speckit roadmap insert --after 0020 "Urgent Fix"` and verifying a new phase 0021 is created with proper formatting.

**Acceptance Scenarios**:

1. **Given** a ROADMAP.md with phases 0010, 0020, 0030, **When** user runs `speckit roadmap insert --after 0020 "Hotfix Auth Bug"`, **Then** a new phase 0021 is created between 0020 and 0030 with proper table entry and section
2. **Given** a phase 0025 already exists, **When** user tries to insert after 0020, **Then** phase 0026 is created (auto-increment within decade)
3. **Given** phases 0020-0029 are all used, **When** user tries to insert after 0020, **Then** user receives an error suggesting to defer or reorganize phases

---

### User Story 2 - Defer Phase to Backlog (Priority: P2)

As a developer, I need to defer low-priority phases to a backlog section so they don't clutter the active roadmap.

**Why this priority**: Important for roadmap clarity but not blocking. Developers can manually move phases, but automation reduces errors.

**Independent Test**: Can be fully tested by running `speckit roadmap defer 0040` and verifying the phase moves to a Backlog section with its details preserved.

**Acceptance Scenarios**:

1. **Given** a ROADMAP.md with active phase 0040, **When** user runs `speckit roadmap defer 0040`, **Then** phase 0040 is removed from the Phase Overview table and added to a Backlog section
2. **Given** no Backlog section exists, **When** user defers a phase, **Then** a Backlog section is created before the phase is added
3. **Given** a deferred phase in Backlog, **When** user runs `speckit roadmap restore 0040 --after 0030`, **Then** the phase is restored to the active roadmap (renumbered as needed)

---

### User Story 3 - Migrate 2.0 to 2.1 Numbering (Priority: P3)

As a developer, I need to migrate existing 2.0 roadmaps (3-digit numbering) to 2.1 format (4-digit ABBC numbering) for compatibility with insert/defer features.

**Why this priority**: One-time migration for existing projects. New projects will use 2.1 format from the start.

**Independent Test**: Can be fully tested by running `speckit migrate roadmap` on a 2.0 format ROADMAP.md and verifying 001→0010, 002→0020 conversion.

**Acceptance Scenarios**:

1. **Given** a ROADMAP.md with phases 001, 002, 003, **When** user runs `speckit migrate roadmap`, **Then** phases become 0010, 0020, 0030 and all internal references are updated
2. **Given** a ROADMAP.md already in 2.1 format, **When** user runs `speckit migrate roadmap`, **Then** no changes are made and user is informed the roadmap is current
3. **Given** a mixed format ROADMAP.md, **When** user runs `speckit migrate roadmap`, **Then** an error is shown listing the inconsistencies

---

### Edge Cases

- What happens when inserting after the last phase? → Creates phase in next decade (e.g., after 0090, creates 0100)
- What happens when deferring a phase that's currently in progress? → Warn user and require `--force` flag
- What happens when phase numbers exceed 4 digits? → Error with guidance on restructuring
- What happens when restoring would create a conflict? → Offer to renumber or insert at different position
- How does migration handle phase references in state files? → Update `.specify/orchestration-state.json` phase numbers

## Clarifications

### C1: Insert Content Generation (Resolved)

**Decision**: Interactive prompt at insert time.

When inserting a new phase, the CLI will prompt the user for:
1. Phase Goal (required, single line)
2. Scope items (optional, multi-line until blank)
3. Verification gate (required, single line)

The phase section will be created with this content immediately, avoiding incomplete placeholders.

### C2: Restore Behavior (Resolved)

**Decision**: Smart restore with fallback.

The restore command will:
1. First attempt to restore using the original phase number from backlog
2. If original number is taken, find next available number in the same decade
3. If the decade is full, prompt user to choose a different target with `--after`

This preserves historical context when possible while handling conflicts gracefully.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST support 4-digit ABBC phase numbering scheme (Milestone:Phase format, e.g., 0010, 0021)
- **FR-002**: System MUST provide `speckit roadmap insert --after <phase> "<name>"` command to create new phases
- **FR-003**: System MUST provide `speckit roadmap defer <phase>` command to move phases to Backlog
- **FR-004**: System MUST provide `speckit roadmap restore <phase> --after <phase>` command to restore from Backlog
- **FR-005**: System MUST maintain a Backlog section in ROADMAP.md for deferred phases
- **FR-006**: System MUST provide `speckit migrate roadmap` command to convert 2.0 → 2.1 format
- **FR-007**: System MUST update all internal references when migrating (state files, branch names in docs)
- **FR-008**: System MUST validate phase number format (4 digits, 0-padded)
- **FR-009**: System MUST prevent operations on in-progress phases without `--force` flag
- **FR-010**: System MUST update the Phase Overview table and phase sections atomically

### Key Entities

- **Phase**: A numbered roadmap entry with number (4-digit), name, status, verification gate
- **Phase Overview Table**: Markdown table in ROADMAP.md listing all active phases
- **Backlog Section**: Markdown section in ROADMAP.md for deferred phases
- **Phase Section**: Detailed markdown section (### NNNN - Name) with Goal, Scope, Deliverables

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `speckit roadmap insert --after 0020 "Urgent Fix"` creates phase 0021 in under 2 seconds
- **SC-002**: `speckit roadmap defer 0040` moves phase to Backlog preserving all content
- **SC-003**: `speckit migrate roadmap` converts all 3-digit phases to 4-digit format with zero data loss
- **SC-004**: All roadmap commands pass shellcheck validation
- **SC-005**: Commands work correctly on both macOS and Linux
