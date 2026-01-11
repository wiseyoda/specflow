# Requirements Checklist: Roadmap Flexibility

**Phase**: 0010-roadmap-flexibility
**Created**: 2026-01-10

## Functional Requirements

- [x] **FR-001**: 4-digit ABBC phase numbering scheme supported
- [x] **FR-002**: `speckit roadmap insert` command implemented
- [x] **FR-003**: `speckit roadmap defer` command implemented
- [x] **FR-004**: `speckit roadmap restore` command implemented
- [x] **FR-005**: Backlog section in ROADMAP.md supported
- [x] **FR-006**: `speckit migrate roadmap` command implemented
- [x] **FR-007**: Internal reference updates on migration
- [x] **FR-008**: Phase number format validation (4 digits, 0-padded)
- [x] **FR-009**: In-progress phase protection with `--force` override
- [x] **FR-010**: Atomic table and section updates

## User Stories

- [x] **US-001**: Insert hotfix phase after existing phase
- [x] **US-002**: Defer phase to backlog
- [x] **US-003**: Migrate 2.0 to 2.1 numbering

## Success Criteria

- [x] **SC-001**: Insert command completes in under 2 seconds
- [x] **SC-002**: Defer preserves all phase content
- [x] **SC-003**: Migration with zero data loss
- [x] **SC-004**: Shellcheck validation passes
- [x] **SC-005**: Cross-platform compatibility (macOS/Linux)

## Edge Cases

- [x] Insert after last phase creates next decade
- [x] Defer in-progress requires --force
- [x] Mixed format ROADMAP detection
- [x] Full decade (0020-0029 used) handling
