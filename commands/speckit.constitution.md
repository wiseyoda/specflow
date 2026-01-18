---
description: DEPRECATED - Use /speckit.init instead
---

## DEPRECATED

This command has been deprecated and consolidated into `/speckit.init`.

**Reason**: Constitution creation is now part of the unified project initialization flow. Running `/speckit.init` will handle discovery, constitution, memory documents, and roadmap creation in one command.

**Migration**:

```
# OLD (deprecated)
/speckit.constitution

# NEW (use this)
/speckit.init
```

### What happens now:

The `/speckit.init` command now runs the complete setup flow:

1. **Discovery Interview** - Collects project context and decisions
2. **Constitution Generation** - Creates constitution from decisions (what this command did)
3. **Memory Documents** - Generates tech-stack, coding-standards, etc.
4. **Roadmap Creation** - Creates initial ROADMAP.md

If you only need to update an existing constitution, edit `.specify/memory/constitution.md` directly.

For more information, see the documentation or run `/speckit.help`.
