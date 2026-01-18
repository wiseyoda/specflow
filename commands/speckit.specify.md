---
description: DEPRECATED - Use /speckit.design instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.design`.

**Reason**: The specification step is now part of the unified design workflow that produces all design artifacts (discovery, spec, plan, tasks, checklists) in one command.

**Migration**:

```bash
# OLD (deprecated)
/speckit.specify "Feature description"

# NEW (use this)
/speckit.design         # Full design flow including spec
/speckit.design --spec  # Regenerate spec and downstream artifacts
```

**What `/speckit.design` does**:
1. **DISCOVER** - Examines codebase and asks clarifying questions
2. **SPECIFY** - Creates spec.md and requirements.md (this step)
3. **PLAN** - Creates plan.md with technical context
4. **TASKS** - Generates tasks.md from plan
5. **CHECKLISTS** - Creates implementation.md and verification.md

**Key Benefits of `/speckit.design`**:
- Single command produces all artifacts
- Inline clarification questions with context
- Resumable if interrupted
- Cascade flags for partial regeneration

For more information, run `/speckit.design` or see the documentation.

## Context

$ARGUMENTS
