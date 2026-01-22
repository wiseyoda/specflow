# Goal Coverage Template

This template defines the standardized format for tracking phase goals through the workflow.

## ID Format Reference

Consistent with spec-template.md, use these ID formats for traceability:

| ID Format | Type | Example | Used For |
|-----------|------|---------|----------|
| `FR-###` | Functional Requirement | FR-001 | Must-have functionality |
| `NFR-###` | Non-Functional Requirement | NFR-001 | Performance, security, etc. |
| `SC-###` | Success Criteria | SC-001 | Measurable outcomes |
| `US-###` | User Story | US-001 | User journeys |
| `T###` | Task | T001 | Implementation tasks |
| `V-###` | Verification Item | V-001 | Checklist verification |

**Traceability chain**: Phase Goal → FR-### / NFR-### → T### → V-###

## Phase Goals Matrix

Use this table to verify every phase goal has spec coverage and implementing tasks.

```markdown
## Phase Goals Coverage

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | [Goal from phase doc] | FR-001, FR-002 | T001-T005 | COVERED |
| 2 | [Goal from phase doc] | FR-003, NFR-001 | T010-T012 | COVERED |
| 3 | [Goal from phase doc] | NONE | NONE | MISSING |
| 4 | [Goal from phase doc] | FR-004 | Deferred | DEFERRED |
```

## Status Values

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `COVERED` | Goal has requirement(s) and task(s) | None - ready for implementation |
| `PARTIAL` | Goal has requirement but no tasks | Add tasks to tasks.md |
| `MISSING` | Goal has no requirement or tasks | CRITICAL - add to spec.md first |
| `DEFERRED` | Goal explicitly deferred to backlog | Document reason in plan.md |

## Storage Location

The goal coverage matrix MUST be persisted (not just output to console) so it survives context compaction:

**Primary location**: `{FEATURE_DIR}/tasks.md` - Add as a header section before the task list

```markdown
# Tasks: Phase NNNN - Feature Name

## Phase Goals Coverage

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Goal from phase doc | FR-001, FR-002 | T001-T005 | COVERED |
...

Coverage: N/N goals (100%)

---

## Progress Dashboard
...
```

**Why tasks.md**: The matrix links goals → requirements → tasks, so storing it with tasks keeps the traceability chain together. It also gets archived with the phase.

**Alternative**: If tasks.md is very large, store in `{FEATURE_DIR}/coverage.md` and reference it from tasks.md.

## When to Use

This matrix MUST be generated at these checkpoints:

1. **After DESIGN (flow.design.md)**: Verify spec.md covers all phase goals
2. **After TASKS generation (flow.design.md)**: Verify tasks.md implements all requirements
3. **During ANALYZE (flow.analyze.md)**: Pass A checks goal coverage
4. **During VERIFY (flow.verify.md)**: Confirm all goals were achieved

## Example: Complete Coverage

```markdown
## Phase Goals Coverage

Phase: 1055 - Smart Batching Orchestration
Source: `.specify/phases/1055-smart-batching.md`

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Batch parser for orchestrate commands | FR-001 Batch Command Parser | T001-T003 | COVERED |
| 2 | Smart sequencing with dependencies | FR-002 Dependency Resolution | T004-T008 | COVERED |
| 3 | Self-healing on failures | FR-003 Auto-Recovery | T009-T012 | COVERED |
| 4 | Progress persistence across sessions | NFR-001 State Persistence | T013-T015 | COVERED |
| 5 | Minimal user interaction | FR-004 Auto-Decision | T016-T018 | COVERED |

Coverage: 5/5 goals (100%)
```

## Example: With Gaps

```markdown
## Phase Goals Coverage

Phase: 0080 - CLI Migration
Source: `.specify/phases/0080-cli-migration.md`

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | Migrate status command to TypeScript | FR-001 Status Command | T001-T005 | COVERED |
| 2 | Add JSON output for all commands | FR-002 JSON Output | T006-T010 | COVERED |
| 3 | Maintain backward compatibility | NONE | NONE | MISSING |
| 4 | Performance parity with bash | NFR-001 (partial) | T011 | PARTIAL |

Coverage: 2/4 goals (50%)

### Gaps to Resolve

1. **Goal 3: Backward compatibility** - MISSING
   - Add requirement to spec.md: "FR-003: CLI commands accept same arguments as bash versions"
   - Add tasks for compatibility testing

2. **Goal 4: Performance parity** - PARTIAL
   - Requirement exists but only 1 task
   - Add tasks for benchmarking and optimization
```

## Retrieving Goals from State

If conversation context is lost, retrieve goals from state:

```bash
specflow state get orchestration.phase.goals
# Returns: ["Goal 1", "Goal 2", "Goal 3"]
```

## Integration Points

| Command | Usage |
|---------|-------|
| `/flow.design` | Generate matrix after spec.md, verify after tasks.md |
| `/flow.analyze` | Pass A validates goal coverage |
| `/flow.verify` | Step 4 verifies all goals were achieved |
| `/flow.orchestrate` | Tracks goal completion through workflow |
