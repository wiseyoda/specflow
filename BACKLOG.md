# Project Backlog

> Items deferred from phases without a specific target phase assignment.
> Review periodically to schedule into upcoming phases.

**Created**: 2026-01-18
**Last Updated**: 2026-01-18

---

## Priority Legend

| Priority | Meaning | Criteria |
|----------|---------|----------|
| **P1** | High | Core functionality, significant user value |
| **P2** | Medium | Nice-to-have, quality of life improvements |
| **P3** | Low | Future considerations, can wait indefinitely |

---

## Backlog Items

### P1 - High Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|

### P2 - Medium Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|
| [OE001] Over-Engineering: 5 error classes for enum-like behavior (errors.ts) | Phase 1049 | Deferred | - |
| [OE002] Over-Engineering: Global state for output options (output.ts) | Phase 1049 | Deferred | - |
| [OE003] Over-Engineering: Optional projectPath parameter unused (paths.ts) | Phase 1049 | Deferred | - |
| [OE004] Over-Engineering: Duplicate state initialization patterns (state.ts, phase/*.ts) | Phase 1049 | Deferred | - |
| [OE005] Over-Engineering: Task range parsing over-complex (mark.ts) | Phase 1049 | Deferred | - |
| [OE006] Over-Engineering: Over-complex feature context resolution (context.ts) | Phase 1049 | Deferred | - |
| [OE008] Over-Engineering: determineNextAction has 7 parameters (status.ts) | Phase 1049 | Deferred | - |
| [OE009] Over-Engineering: Checklist type detection over-abstracted (checklist.ts) | Phase 1049 | Deferred | - |
| [OE010] Over-Engineering: Custom semver comparison - consider library (health.ts) | Phase 1049 | Deferred | - |
| [OE011] Over-Engineering: Over-parameterized backlog functions (backlog.ts) | Phase 1049 | Deferred | - |
| [OE012] Over-Engineering: formatHumanReadable single call site (status.ts) | Phase 1049 | Deferred | - |
| [OE013] Over-Engineering: Unused registry feature infrastructure (registry.ts) | Phase 1049 | Deferred | - |
| [OE014] Over-Engineering: Over-engineered history archiving (history.ts) | Phase 1049 | Deferred | - |
| [0042-T041] Document `.specify/scripts/` vs `scripts/bash/` purpose | Phase 0042 | Archive scan | Clarify script directory structure |
| [1010-T034] Create useKeyboard hook for global shortcuts | Phase 1010 | Archive scan | Dashboard keyboard navigation |

### P3 - Low Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|
| [0042-T029] Search scripts for `mktemp` usage without EXIT trap | Phase 0042 | Archive scan (P3) | Temp file cleanup |
| [0042-T030] Add cleanup traps where missing | Phase 0042 | Archive scan (P3) | Temp file cleanup |
| [0042-T031] Verify no temp file leakage | Phase 0042 | Archive scan (P3) | Temp file cleanup |

---

## Scheduling Guidelines

When planning a new phase, review this backlog:

1. **Check P1 items** - Should any be scheduled for the next phase?
2. **Look for synergies** - Do any backlog items align with planned work?
3. **Update target phases** - Move items from Backlog to specific phases as appropriate
4. **Clean up** - Remove completed items, update priorities as project evolves
