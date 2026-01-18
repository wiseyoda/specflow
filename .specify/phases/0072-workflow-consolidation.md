---
phase: 0072
name: workflow-consolidation
status: not_started
created: 2026-01-17
pdr: pdr-workflow-consolidation.md
---

### 0072 - Workflow Commands Consolidation

**Goal**: Reduce 11 workflow commands to 6, with a single design command that creates all artifacts and inline clarification.

**Scope**:
- Create `/speckit.design` to produce spec.md, plan.md, tasks.md, and checklists in sequence
- Move clarify behavior inline into orchestrate (ask questions as needed)
- Move `/speckit.backlog` to `/speckit.roadmap backlog` subcommand
- Deprecate: specify, clarify, plan, tasks, checklist, backlog
- Audit and simplify command flags (remove unused flags)
- Keep: orchestrate, analyze, implement, verify, merge

**Commands Before → After**:

| Before | After |
|--------|-------|
| orchestrate, specify, clarify, plan, tasks, analyze, checklist, implement, verify, merge, backlog | orchestrate, design, analyze, implement, verify, merge |

**Workflow Phases**:
```
design → analyze (pre-implement) → implement → verify (post-implement) → merge
```

**User Stories**:
1. As a developer, I run `/speckit.design` and get all my planning artifacts at once
2. As a developer, Claude asks me clarifying questions inline as it works (no separate step)
3. As a developer, I use `/speckit.roadmap backlog` to manage deferred items
4. As an existing user, I see deprecation notices guiding me to new commands

**Deliverables**:
- [ ] `/speckit.design` created: produces spec → plan → tasks → checklists sequentially
- [ ] `/speckit.design` supports `--plan`, `--tasks`, etc. flags for partial regeneration
- [ ] `/speckit.orchestrate` updated: inline clarify behavior, 5-phase workflow
- [ ] `/speckit.roadmap` expanded: add `backlog` subcommand
- [ ] Deprecation stubs for: specify, clarify, plan, tasks, checklist, backlog
- [ ] Command flag audit: document all flags, remove unused ones
- [ ] Updated `docs/commands-analysis.md`
- [ ] Updated CLAUDE.md command documentation

**Verification Gate**: Technical
- `/speckit.design` produces all 4 artifact types in sequence
- Inline clarify works during orchestrate (questions asked in context)
- `/speckit.roadmap backlog` manages deferred items correctly
- Deprecated commands show helpful redirect messages
- Existing projects continue to work
- No functionality lost in consolidation

**Dependencies**:
- Phase 0070 (Pre-Workflow Consolidation) should complete first for clean namespace

**Estimated Complexity**: Medium-High
