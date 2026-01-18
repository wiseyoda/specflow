---
description: DEPRECATED - Use /speckit.roadmap add-pdr instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.roadmap add-pdr`.

**Reason**: PDR-to-phase conversion is a roadmap operation. All roadmap-related functionality is now in `/speckit.roadmap`.

**Migration**:

```
# OLD (deprecated)
/speckit.phase
/speckit.phase pdr-feature.md

# NEW (use these)
/speckit.roadmap add-pdr
/speckit.roadmap add-pdr pdr-feature.md
```

### What to use instead:

| Old Command | New Command | Description |
|-------------|-------------|-------------|
| `/speckit.phase` | `/speckit.roadmap add-pdr` | List PDRs and convert to phases |
| `/speckit.phase pdr-name.md` | `/speckit.roadmap add-pdr pdr-name.md` | Convert specific PDR |

The functionality is identical - only the command name has changed to better reflect that this is a roadmap operation.

For more information, see the documentation or run `/speckit.help`.
