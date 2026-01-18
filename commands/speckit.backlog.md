---
description: DEPRECATED - Use /speckit.roadmap backlog instead
---

## DEPRECATED

This command has been deprecated and moved to a subcommand of `/speckit.roadmap`.

**Reason**: Backlog management is a roadmap operation - it triages items into phases defined in the roadmap.

**Migration**:

```bash
# OLD (deprecated)
/speckit.backlog
/speckit.backlog --auto
/speckit.backlog --dry-run

# NEW (use this)
/speckit.roadmap backlog              # Interactive triage
/speckit.roadmap backlog --auto       # Auto-assign high-confidence matches
/speckit.roadmap backlog --dry-run    # Preview without changes
```

**What `/speckit.roadmap backlog` does**:
1. **Scans completed phases** for orphaned incomplete tasks
2. **Parses backlog items** from ROADMAP.md
3. **Analyzes phase scopes** for keyword matching
4. **Proposes assignments** with confidence scores
5. **Updates ROADMAP** with assignments

**Confidence-based matching (unchanged)**:
| Score | Confidence | Action |
|-------|------------|--------|
| 0.7+ | High | Auto-assign (with --auto) |
| 0.4-0.7 | Medium | Ask user |
| 0.1-0.4 | Low | Suggest new phase |
| <0.1 | None | Propose new phase |

**Benefits of roadmap integration**:
- Single location for roadmap operations
- Consistent with `add-pdr` subcommand
- Better visibility into phase context

For more information, run `/speckit.roadmap backlog` or see the documentation.

## Context

$ARGUMENTS
