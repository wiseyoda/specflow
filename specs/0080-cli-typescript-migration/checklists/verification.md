# Verification Checklist: CLI TypeScript Migration

**Purpose**: Verify feature meets acceptance criteria and is ready for merge
**Created**: 2025-01-18
**Feature**: [spec.md](../spec.md)

---

## Acceptance Criteria

### US1: Status Command

- [ ] V-001 `specflow status --json` returns complete state in single call
- [ ] V-002 Phase details match state file values
- [ ] V-003 Progress computed correctly from tasks.md
- [ ] V-004 Health issues detected when present (test with corrupted state)
- [ ] V-005 next_action values are actionable and correct

### US2: Next Command

- [ ] V-006 `specflow next --json` returns next unblocked task
- [ ] V-007 Dependencies correctly block tasks
- [ ] V-008 File hints extracted from task descriptions
- [ ] V-009 `--type verify` returns checklist items during verify step
- [ ] V-010 Returns "none" action when all tasks complete

### US3: Mark Command

- [ ] V-011 `specflow mark T001` toggles checkbox in tasks.md
- [ ] V-012 Multiple tasks marked correctly (T001 T002)
- [ ] V-013 Range syntax works (T001..T005)
- [ ] V-014 Returns updated progress immediately
- [ ] V-015 step_complete flag set when all tasks done

### US4: Check Command

- [ ] V-016 All gates validate correctly (design, implement, verify)
- [ ] V-017 State drift detected and flagged as auto-fixable
- [ ] V-018 `--fix` applies fixes and reports remaining issues
- [ ] V-019 Suggested actions are actionable commands
- [ ] V-020 Gate validation matches slash command expectations

### US5: State Command

- [x] V-021 `specflow state get orchestration.step` returns step object
- [x] V-022 `specflow state set key=value` updates state file
- [x] V-023 `specflow state show` displays human-readable summary
- [x] V-024 `specflow state init` creates valid v2.0 schema

---

## End-to-End Workflow

- [ ] V-025 Full workflow works: status → next → mark → check cycle
- [ ] V-026 Claude can orient with single `specflow status --json` call
- [ ] V-027 Task completion workflow requires max 2 CLI calls (mark + optional next)
- [ ] V-028 Gate validation catches real issues before step transitions

---

## Performance

- [ ] V-029 `specflow status` completes in <500ms
- [ ] V-030 `specflow next` completes in <500ms
- [ ] V-031 `specflow mark` completes in <500ms
- [ ] V-032 `specflow check` completes in <500ms
- [ ] V-033 Build time under 5 seconds

---

## Regression

- [ ] V-034 Existing bash commands still work via fallback
- [ ] V-035 State file readable by both TypeScript and bash
- [ ] V-036 Slash commands execute without errors
- [ ] V-037 Dashboard still reads state correctly

---

## Documentation

- [ ] V-038 CLAUDE.md updated with new CLI architecture
- [ ] V-039 cli-design.md output schemas match actual output
- [ ] V-040 No dead links in spec documentation

---

## Success Metrics

- [ ] V-041 CLI calls per phase reduced from 50-100 to 10-15 (measure with orchestrate)
- [ ] V-042 Test coverage exceeds 80%
- [ ] V-043 All 5 smart commands return JSON matching documented schemas

---

## Notes

- Check items off as verified: `[x]`
- Items marked [x] were verified in prior implementation
- Gate: All V-* items must pass before merge
- Run full verification in clean environment (fresh clone)
