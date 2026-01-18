# Implementation Plan: Workflow Consolidation

**Branch**: `0072-workflow-consolidation` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)

## Summary

Consolidate 11 workflow commands to 6 by creating a new `/speckit.design` command that produces all design artifacts in sequence, updating `/speckit.orchestrate` to use a 4-step workflow, moving backlog to a roadmap subcommand, and deprecating 6 commands.

## Technical Context

**Language/Version**: Bash 3.2+ (POSIX-compliant)
**Primary Dependencies**: jq 1.6+, git 2.x
**Storage**: File-based (Markdown, JSON)
**Testing**: bash test-runner.sh, shellcheck
**Target Platform**: macOS, Linux
**Project Type**: CLI tool (single project)
**Constraints**: POSIX-compliant bash, shellcheck validation
**Scale/Scope**: 18 command files, ~5000 lines affected

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | PASS | Fewer commands = simpler mental model |
| II. POSIX-Compliant Bash | PASS | No bash scripts affected |
| III. CLI Over Direct Edits | PASS | Command files are Claude prompts |
| IV. Simplicity Over Cleverness | PASS | Consolidation reduces complexity |
| V. Helpful Error Messages | PASS | Deprecation stubs guide users |
| VII. Three-Line Output Rule | REQUIRED | New design command must follow |

## Project Structure

### Documentation (this feature)

```text
specs/0072-workflow-consolidation/
├── discovery.md         # Codebase findings and decisions
├── spec.md              # Feature specification
├── requirements.md      # Requirements checklist
├── plan.md              # This file
├── tasks.md             # Task list (next step)
└── checklists/          # Verification checklists
    ├── implementation.md
    └── verification.md
```

### Source Code (affected files)

```text
commands/
├── speckit.design.md       # NEW: Combined design command
├── speckit.orchestrate.md  # MODIFY: 4-step workflow
├── speckit.roadmap.md      # MODIFY: Add backlog subcommand
├── speckit.specify.md      # DEPRECATE: → design
├── speckit.clarify.md      # DEPRECATE: → design
├── speckit.plan.md         # DEPRECATE: → design --plan
├── speckit.tasks.md        # DEPRECATE: → design --tasks
├── speckit.checklist.md    # DEPRECATE: → design --checklist
└── speckit.backlog.md      # DEPRECATE: → roadmap backlog

docs/
└── commands-analysis.md    # MODIFY: Update command counts

CLAUDE.md                   # MODIFY: Update workflow documentation
```

## Architecture

### New `/speckit.design` Command

```text
/speckit.design [flags]

Flags:
  (none)      - Full design flow: discover → spec → plan → tasks → checklists
  --spec      - Regenerate from spec (cascade: spec → plan → tasks → checklists)
  --plan      - Regenerate from plan (cascade: plan → tasks → checklists)
  --tasks     - Regenerate from tasks (cascade: tasks → checklists)
  --checklist - Regenerate only checklists

Artifacts produced:
  specs/{phase}/discovery.md     - Codebase findings
  specs/{phase}/spec.md          - Feature specification
  specs/{phase}/plan.md          - Technical plan
  specs/{phase}/tasks.md         - Task list
  specs/{phase}/checklists/      - Implementation + verification checklists
```

### Design Command Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                     /speckit.design                         │
├─────────────────────────────────────────────────────────────┤
│  PHASE 1: DISCOVER                                          │
│  ├─ Load phase context from .specify/phases/NNNN-*.md      │
│  ├─ Examine codebase (search for related code)             │
│  ├─ Read memory documents (constitution, tech-stack)       │
│  └─ Ask progressive clarifying questions (max 5 rounds)    │
│                         ↓                                   │
│  PHASE 2: SPECIFY                                           │
│  ├─ Create spec.md from phase file + discovery answers     │
│  ├─ Create requirements.md checklist                       │
│  └─ Handle inline clarifications (max 3 questions)         │
│                         ↓                                   │
│  PHASE 3: PLAN                                              │
│  ├─ Create plan.md with technical context                  │
│  ├─ Constitution compliance check                          │
│  └─ Generate research.md, data-model.md if needed          │
│                         ↓                                   │
│  PHASE 4: TASKS                                             │
│  ├─ Generate tasks.md from plan                            │
│  ├─ Organize by user story priority                        │
│  └─ Add dependency markers                                 │
│                         ↓                                   │
│  PHASE 5: CHECKLISTS                                        │
│  ├─ Generate checklists/implementation.md                  │
│  └─ Generate checklists/verification.md                    │
└─────────────────────────────────────────────────────────────┘
```

### Updated Orchestrate Workflow

**Before (9 steps):**
```
discover → specify → clarify → plan → tasks → analyze → checklist → implement → verify
   0          1         2        3       4        5          6          7         8
```

**After (4 steps):**
```
design → analyze → implement → verify
   0        1          2         3
```

### State Migration

When orchestrate detects old step indices (0-8), auto-migrate:

| Old Index | Old Step | Maps To | New Index |
|-----------|----------|---------|-----------|
| 0 | discover | design | 0 |
| 1 | specify | design | 0 |
| 2 | clarify | design | 0 |
| 3 | plan | design | 0 |
| 4 | tasks | design | 0 |
| 5 | analyze | analyze | 1 |
| 6 | checklist | design | 0 |
| 7 | implement | implement | 2 |
| 8 | verify | verify | 3 |

Note: Old indices 0-4,6 all map to new "design" step since design now encompasses all design phases.

### Deprecation Stub Pattern

```markdown
---
description: DEPRECATED - Use /speckit.design instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.design`.

**Reason**: [Specific reason for this command]

**Migration**:

# OLD (deprecated)
/speckit.specify

# NEW (use this)
/speckit.design         # Full design flow
/speckit.design --spec  # Regenerate spec only

For more information, see the documentation or run `/speckit.help`.
```

## Implementation Phases

### Phase 1: Create Design Command
1. Create `commands/speckit.design.md` with full flow
2. Combine logic from: discover, specify, clarify, plan, tasks, checklist
3. Implement cascade flags (--spec, --plan, --tasks, --checklist)
4. Always generate both implementation and verification checklists

### Phase 2: Update Orchestrate
1. Update `commands/speckit.orchestrate.md` workflow steps
2. Change step indices from 0-8 to 0-3
3. Add state migration logic for old indices
4. Update status display to show 4 steps

### Phase 3: Expand Roadmap
1. Add `backlog` subcommand to `commands/speckit.roadmap.md`
2. Move backlog functionality from speckit.backlog.md
3. Support --auto and --dry-run flags

### Phase 4: Create Deprecation Stubs
1. Convert speckit.specify.md to deprecation stub
2. Convert speckit.clarify.md to deprecation stub
3. Convert speckit.plan.md to deprecation stub
4. Convert speckit.tasks.md to deprecation stub
5. Convert speckit.checklist.md to deprecation stub
6. Convert speckit.backlog.md to deprecation stub

### Phase 5: Update Documentation
1. Update CLAUDE.md workflow section
2. Update docs/commands-analysis.md with new counts
3. Update any cross-references in other commands

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing workflows | High | State migration logic, deprecation stubs with guidance |
| Design command too large | Medium | Well-structured phases, resumable checkpoints |
| Lost functionality in consolidation | High | Verify each deprecated command's features are in design |

## Testing Strategy

1. **Manual Testing**:
   - Run `/speckit.design` on fresh phase
   - Run `/speckit.design --plan` with existing spec
   - Run deprecated commands to verify stubs work
   - Run `/speckit.orchestrate status` to verify 4-step display

2. **Integration Testing**:
   - Full workflow: design → analyze → implement → verify
   - State migration: old 9-step state to new 4-step

3. **Backward Compatibility**:
   - Existing projects with old state continue to work
   - Deprecated commands show helpful messages
