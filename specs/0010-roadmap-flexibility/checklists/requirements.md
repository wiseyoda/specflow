# Requirements Checklist: Roadmap Flexibility

**Phase**: 0010-roadmap-flexibility
**Created**: 2026-01-10

## Functional Requirements

- [ ] **FR-001**: 4-digit ABBC phase numbering scheme supported
- [ ] **FR-002**: `speckit roadmap insert` command implemented
- [ ] **FR-003**: `speckit roadmap defer` command implemented
- [ ] **FR-004**: `speckit roadmap restore` command implemented
- [ ] **FR-005**: Backlog section in ROADMAP.md supported
- [ ] **FR-006**: `speckit migrate roadmap` command implemented
- [ ] **FR-007**: Internal reference updates on migration
- [ ] **FR-008**: Phase number format validation (4 digits, 0-padded)
- [ ] **FR-009**: In-progress phase protection with `--force` override
- [ ] **FR-010**: Atomic table and section updates

## User Stories

- [ ] **US-001**: Insert hotfix phase after existing phase
- [ ] **US-002**: Defer phase to backlog
- [ ] **US-003**: Migrate 2.0 to 2.1 numbering

## Success Criteria

- [ ] **SC-001**: Insert command completes in under 2 seconds
- [ ] **SC-002**: Defer preserves all phase content
- [ ] **SC-003**: Migration with zero data loss
- [ ] **SC-004**: Shellcheck validation passes
- [ ] **SC-005**: Cross-platform compatibility (macOS/Linux)

## Edge Cases

- [ ] Insert after last phase creates next decade
- [ ] Defer in-progress requires --force
- [ ] Mixed format ROADMAP detection
- [ ] Full decade (0020-0029 used) handling
