# Project Backlog

> Items deferred from phases without a specific target phase assignment.
> Review periodically to schedule into upcoming phases.

**Created**: 2026-01-18
**Last Updated**: 2026-01-22

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
| [RES001] Research BMAD-METHOD for best practices | Manual | Research | Review https://github.com/bmad-code-org/BMAD-METHOD - scale-adaptive planning (5 levels), 21+ specialized agents, 34 structured workflows. Consider: complexity-based phase sizing, agent specialization patterns, execution track concepts (quick/standard/enterprise). |
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
| V-003 `pnpm lint` | Phase 0082 | ESLint not installed in environment | - |
| V-004 `pnpm typecheck` | Phase 0082 | Pre-existing type issues in close.ts, detect.ts, migrate.ts | - |
| V-030 health.ts collectIssues() still 227 lines | Phase 0082 | split deferred | - |
| V-064 flow.orchestrate.md exit codes | Phase 0082 | implicit (0=success) | - |
| V-081 No new linting errors | Phase 0082 | lint unavailable | - |
| V-083 Commit history | Phase 0082 | changes uncommitted | - |
| I-004: Orchestration event types (orchestration:decision, orchestration:batch) - not critical for core polling elimination goals | Phase 1056 | Deferred | - |

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
