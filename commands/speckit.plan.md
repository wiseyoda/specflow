---
description: DEPRECATED - Use /speckit.design instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.design`.

**Reason**: Planning is now part of the unified design workflow, ensuring all design artifacts are consistent and produced together.

**Migration**:

```bash
# OLD (deprecated)
/speckit.plan

# NEW (use this)
/speckit.design         # Full design flow including plan
/speckit.design --plan  # Regenerate plan and downstream (tasks, checklists)
```

**What the PLAN phase in `/speckit.design` does**:
1. Loads spec.md, discovery.md, and memory documents
2. Performs constitution compliance check
3. Fills technical context
4. Generates research.md (if unknowns exist)
5. Generates data-model.md and contracts/ (if applicable)
6. Creates plan.md with implementation approach

**Cascade Behavior**:
- `--plan` regenerates: plan → tasks → checklists
- Preserves: discovery.md, spec.md

**Benefits of unified workflow**:
- Consistent artifacts
- Single command for complete design
- Constitution check integrated
- Resumable from any point

For more information, run `/speckit.design` or see the documentation.

## Context

$ARGUMENTS
