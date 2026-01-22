---
version: '1.0'
description: 'Verification checklist - Post-implementation quality verification'
---

# Verification Checklist: [FEATURE NAME]

**Purpose**: Verify implementation quality and completeness after coding is done
**Created**: [DATE]
**Feature**: [Link to spec.md]
**Phase**: [PHASE_NUMBER]

**Note**: This checklist is verified during `/flow.verify` before phase completion.

## Checklist ID Format

All items use `V-###` prefix (e.g., V-001, V-002).
Mark complete with: `specflow mark V-001`

---

## Acceptance Criteria Verification

Verify all acceptance criteria from spec.md are met:

- [ ] V-001 User Story 1 acceptance scenarios pass
- [ ] V-002 User Story 2 acceptance scenarios pass
- [ ] V-003 User Story 3 acceptance scenarios pass
- [ ] V-004 Edge cases handled as specified
- [ ] V-005 Error scenarios handled gracefully

## Success Criteria Verification

Verify measurable success criteria (SC-###) from spec.md:

- [ ] V-010 SC-001: [Specific metric] meets target
- [ ] V-011 SC-002: [Specific metric] meets target
- [ ] V-012 SC-003: [Specific metric] meets target

## Non-Functional Requirements

Verify NFR-### requirements from spec.md:

- [ ] V-020 Performance: Response times meet requirements
- [ ] V-021 Security: No new vulnerabilities introduced
- [ ] V-022 Accessibility: WCAG compliance verified (if UI)
- [ ] V-023 Error handling: Errors are logged appropriately
- [ ] V-024 Data validation: Inputs validated at boundaries

## Code Quality

Verify implementation meets coding standards:

- [ ] V-030 All tests pass (`pnpm test` or equivalent)
- [ ] V-031 No linting errors (`pnpm lint` or equivalent)
- [ ] V-032 Type checking passes (`pnpm typecheck` or equivalent)
- [ ] V-033 Code follows patterns in coding-standards.md
- [ ] V-034 No TODO/FIXME comments remain in new code

## Documentation

Verify documentation is complete:

- [ ] V-040 README updated (if applicable)
- [ ] V-041 API documentation updated (if new endpoints)
- [ ] V-042 Inline comments explain non-obvious logic
- [ ] V-043 CHANGELOG updated with user-facing changes

## Phase Goal Verification

Verify all phase goals from `.specify/phases/NNNN-*.md` are achieved:

- [ ] V-050 Goal 1: [Goal description] - verified
- [ ] V-051 Goal 2: [Goal description] - verified
- [ ] V-052 Goal 3: [Goal description] - verified

## Integration Verification

Verify integration with existing system:

- [ ] V-060 No regressions in existing functionality
- [ ] V-061 Integration tests pass
- [ ] V-062 Database migrations applied successfully (if applicable)
- [ ] V-063 Environment variables documented

---

## UI Design Verification _(if ui-design.md exists)_

- [ ] V-UI1 UI implementation matches ui-design.md mockups
- [ ] V-UI2 All components from Component Inventory are implemented
- [ ] V-UI3 All interactions from Interactions table work as specified
- [ ] V-UI4 Design constraints from ui-design.md are respected
- [ ] V-UI5 Accessibility considerations from ui-design.md are addressed

---

## Notes

- All V-### items must be checked before `/flow.merge`
- Items that fail should be fixed or deferred with `specflow phase defer "reason"`
- Use `specflow mark V-### --blocked "reason"` for items that cannot be verified
