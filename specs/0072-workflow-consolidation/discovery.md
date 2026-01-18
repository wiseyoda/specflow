# Discovery: Phase 0072 - Workflow Consolidation

## Phase Context

**Goal**: Reduce 11 workflow commands to 6, with a single design command that creates all artifacts and inline clarification.

**Before (11 commands)**:
orchestrate, specify, clarify, plan, tasks, analyze, checklist, implement, verify, merge, backlog

**After (6 commands)**:
orchestrate, design, analyze, implement, verify, merge

## Current Workflow Structure (9 Steps)

```
discover → specify → clarify → plan → tasks → analyze → checklist → implement → verify
```

| Step | Command | Artifacts | User Interaction |
|------|---------|-----------|------------------|
| 1 | discover | discovery.md | Progressive questions (max 5 rounds) |
| 2 | specify | spec.md, requirements.md | Max 3 clarification questions |
| 3 | clarify | spec.md (updated) | Max 5 targeted questions |
| 4 | plan | plan.md, research.md, data-model.md, contracts/, quickstart.md | None |
| 5 | tasks | tasks.md | None |
| 6 | analyze | Analysis report (console) | Auto-fix loop |
| 7 | checklist | checklists/*.md | Scope questions |
| 8 | implement | Code files, marked tasks | Progress updates |
| 9 | verify | Verification report, ROADMAP update | None or USER GATE |

## Codebase Findings

### Current Command Files

| Command | Lines | File |
|---------|-------|------|
| orchestrate | 748 | commands/speckit.orchestrate.md |
| specify | 549 | commands/speckit.specify.md |
| clarify | 378 | commands/speckit.clarify.md |
| plan | 123 | commands/speckit.plan.md |
| tasks | 203 | commands/speckit.tasks.md |
| analyze | 216 | commands/speckit.analyze.md |
| checklist | 517 | commands/speckit.checklist.md |
| implement | 412 | commands/speckit.implement.md |
| verify | 517 | commands/speckit.verify.md |
| merge | 478 | commands/speckit.merge.md |
| backlog | 247 | commands/speckit.backlog.md |

### Deprecation Pattern (from Phase 0070)

Deprecated commands are converted to stubs (~30 lines each) that:
1. Show DEPRECATED header
2. Explain reason for deprecation
3. Provide migration table
4. Reference replacement command(s)

Examples: `speckit.start.md`, `speckit.constitution.md`, `speckit.phase.md`

### Key Integration Points

1. **Orchestrate** - Master controller, references all step commands
2. **State file** - `.specify/orchestration-state.json` tracks:
   - `orchestration.step.current` - Current step name
   - `orchestration.step.index` - Step number (0-8)
   - `orchestration.step.status` - in_progress/completed/failed
3. **CLI commands** - All state changes via `speckit state set`, `speckit tasks mark`

### Proposed Changes (Updated with Decisions)

1. **Create `/speckit.design`**:
   - Combines: discover → specify → clarify → plan → tasks → checklist
   - Produces all design artifacts in sequence
   - Codebase examination and clarifications asked inline
   - Generates BOTH implementation AND verification checklists (no questions)
   - Supports partial regeneration with cascade:
     - `--spec` regenerates spec + plan + tasks + checklist
     - `--plan` regenerates plan + tasks + checklist
     - `--tasks` regenerates tasks + checklist
     - `--checklist` regenerates checklist only

2. **Update `/speckit.orchestrate`**:
   - New 4-step workflow: design → analyze → implement → verify
   - Step indices: 0=design, 1=analyze, 2=implement, 3=verify
   - Inline clarify behavior (questions asked in context during design)

3. **Move `/speckit.backlog` to `/speckit.roadmap backlog`**:
   - Backlog is a roadmap operation
   - `speckit.roadmap.md` already has subcommand structure

4. **Deprecate 6 commands**:
   - specify → use `/speckit.design`
   - clarify → use `/speckit.design` (inline)
   - plan → use `/speckit.design --plan`
   - tasks → use `/speckit.design --tasks`
   - checklist → use `/speckit.design --checklist`
   - backlog → use `/speckit.roadmap backlog`

## Clarification Decisions (Resolved)

1. **Design command scope**: Include DISCOVER in design
   - Design becomes the first step and includes codebase examination
   - Fewer steps (4 total) with longer design command
   - Workflow: design → analyze → implement → verify

2. **Analyze step position**: After DESIGN, before IMPLEMENT
   - design → analyze → implement
   - Catches issues before implementation starts
   - Current position adapted to new workflow

3. **Incremental design flags**: Cascade downstream
   - `--plan` regenerates plan + tasks + checklist
   - Ensures consistency since downstream artifacts depend on upstream ones

4. **Checklist behavior**: Generate both without asking
   - Always generate implementation AND verification checklists
   - No scope questions - both are useful for agentic coding
   - Removes user interaction from this step

## Constitution Compliance Check

| Principle | Impact |
|-----------|--------|
| I. Developer Experience First | Fewer commands = simpler mental model |
| III. CLI Over Direct Edits | No change - still using CLI |
| IV. Simplicity Over Cleverness | Consolidation reduces complexity |
| V. Helpful Error Messages | Deprecation stubs guide users |
| VII. Three-Line Output Rule | Design command output must follow |

## Risks

1. **Breaking changes** - Existing workflows referencing old commands
2. **State migration** - Step indices change (9 → 5 steps)
3. **Testing coverage** - Need to verify all artifact generation still works
