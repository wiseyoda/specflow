# Implementation Checklist: CLI TypeScript Migration

**Purpose**: Verify all implementation requirements are met before proceeding to verification
**Created**: 2025-01-18
**Feature**: [spec.md](../spec.md)

---

## Code Quality

- [ ] CHK001 All TypeScript files pass strict mode typecheck (`pnpm typecheck`)
- [ ] CHK002 No linting errors (`pnpm lint`)
- [ ] CHK003 Code follows Simplicity Over Cleverness per constitution
- [ ] CHK004 All public functions have JSDoc comments
- [ ] CHK005 Error handling uses typed error classes with context and next steps (NFR-006)
- [ ] CHK005a Human-readable output follows Three-Line Output Rule (NFR-005)
- [ ] CHK005b Edge cases EC-001 through EC-004 implemented per spec

## Commands Implementation

### status command (US1)

- [ ] CHK006 Returns phase info from state file
- [ ] CHK007 Computes progress from tasks.md (not stored in state)
- [ ] CHK008 Returns health status with issues array
- [ ] CHK009 Returns next_action suggestion
- [ ] CHK010 --json flag outputs valid JSON matching cli-design.md schema

### next command (US2)

- [ ] CHK011 Returns next unblocked task with dependencies
- [ ] CHK012 Includes file hints extracted from task description
- [ ] CHK013 Shows queue info (remaining tasks, next up)
- [ ] CHK014 --type verify returns checklist items
- [ ] CHK015 Returns action: "none" when all tasks complete

### mark command (US3)

- [ ] CHK016 Updates checkbox in tasks.md file
- [ ] CHK017 Supports multiple task IDs (T001 T002)
- [ ] CHK018 Supports range syntax (T001..T005)
- [ ] CHK019 Returns updated progress after marking
- [ ] CHK020 Returns next task suggestion

### check command (US4)

- [ ] CHK021 Validates all gates (design, implement, verify)
- [ ] CHK022 Returns issues with severity and fix suggestions
- [ ] CHK023 --fix auto-fixes applicable issues
- [ ] CHK024 --gate flag validates specific gate
- [ ] CHK025 Returns auto_fixable_count

### state command (US5)

- [x] CHK026 get returns value at dot-path
- [x] CHK027 set updates value with key=value syntax
- [x] CHK028 show displays human-readable summary
- [x] CHK029 init creates new state file with v2.0 schema

## Library Modules

- [ ] CHK030 tasks.ts parses all task formats including [P] and dependencies
- [ ] CHK031 roadmap.ts parses ROADMAP.md table format
- [ ] CHK032 checklist.ts parses checklist markdown with CHK IDs
- [ ] CHK033 context.ts resolves feature directory from phase
- [ ] CHK034 health.ts detects common issues (missing files, state drift)

## Integration

- [ ] CHK035 bin/specflow routes to TypeScript for new commands
- [ ] CHK036 bin/specflow falls back to bash for unmigrated commands
- [ ] CHK037 All commands work when invoked via bin/specflow
- [ ] CHK038 Slash commands work with new CLI syntax

## Tests

- [ ] CHK039 Unit tests exist for all lib modules
- [ ] CHK040 Integration tests exist for all commands
- [ ] CHK041 Parity tests verify TypeScript matches bash output
- [ ] CHK042 Test coverage exceeds 80%
- [ ] CHK043 All tests pass (`pnpm test`)

---

## Notes

- Check items off as completed: `[x]`
- Items marked [x] in US5 section were completed in prior work
- Gate: All CHK items must pass before proceeding to verification
