---
description: DEPRECATED - Use /speckit.design instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.design`.

**Reason**: Clarification is now handled inline during the specification phase of `/speckit.design`, providing better context and flow.

**Migration**:

```bash
# OLD (deprecated)
/speckit.clarify

# NEW (use this)
/speckit.design         # Full design flow with inline clarifications
/speckit.design --spec  # Regenerate spec (includes clarification step)
```

**How clarification works in `/speckit.design`**:

1. **During DISCOVER phase**:
   - Progressive clarifying questions about user intent
   - Up to 5 rounds of 1-2 questions each
   - Context-aware recommendations based on codebase examination

2. **During SPECIFY phase**:
   - Inline `[NEEDS CLARIFICATION]` markers (max 3)
   - Questions presented with options table and recommendations
   - Answers integrated directly into spec

**Benefits**:
- Better context (questions asked while examining relevant code)
- No separate step needed
- Recommendations based on existing patterns
- Questions grouped by priority/impact

For more information, run `/speckit.design` or see the documentation.

## Context

$ARGUMENTS
