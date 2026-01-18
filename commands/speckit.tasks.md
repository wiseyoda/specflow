---
description: DEPRECATED - Use /speckit.design instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.design`.

**Reason**: Task generation is now part of the unified design workflow, ensuring tasks are generated from the complete design context.

**Migration**:

```bash
# OLD (deprecated)
/speckit.tasks

# NEW (use this)
/speckit.design          # Full design flow including tasks
/speckit.design --tasks  # Regenerate tasks and checklists only
```

**What the TASKS phase in `/speckit.design` does**:
1. Loads plan.md, spec.md, data-model.md, contracts/
2. Organizes tasks by user story from spec.md
3. Generates tasks with proper format:
   ```
   - [ ] T### [P?] [US?] Description with file path
   ```
4. Creates dependency graph
5. Adds Progress Dashboard

**Task Organization (unchanged)**:
- Phase 1: Setup (project initialization)
- Phase 2: Foundational (blocking prerequisites)
- Phase 3+: User Stories (in priority order)
- Final: Polish & cross-cutting

**Cascade Behavior**:
- `--tasks` regenerates: tasks → checklists
- Preserves: discovery.md, spec.md, plan.md

For more information, run `/speckit.design` or see the documentation.

## Context

$ARGUMENTS
