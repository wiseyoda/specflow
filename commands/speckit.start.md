---
description: DEPRECATED - Use /speckit.orchestrate instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.orchestrate`.

**Reason**: The smart routing logic is no longer needed. Use `/speckit.orchestrate` directly to continue development, or `/speckit.init` for new project setup.

**Migration**:

```
# OLD (deprecated)
/speckit.start

# NEW (use these)
/speckit.init        # For new project setup
/speckit.orchestrate # For ongoing development
```

### What to use instead:

| Old Command | New Command | When to Use |
|-------------|-------------|-------------|
| `/speckit.start` | `/speckit.init` | Setting up a new project |
| `/speckit.start` | `/speckit.orchestrate` | Continuing development on existing project |

For more information, see the documentation or run `/speckit.help`.
