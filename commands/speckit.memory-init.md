---
description: DEPRECATED - Use /speckit.memory generate instead
---

## DEPRECATED

This command has been consolidated into `/speckit.memory`.

**Use Instead**: `/speckit.memory generate`

### Examples

```
# OLD (deprecated)
/speckit.memory-init coding-standards
/speckit.memory-init all --force

# NEW (use this)
/speckit.memory generate coding-standards
/speckit.memory generate all --force
```

The `generate` subcommand provides the same functionality:
- Analyzes codebase for patterns
- Generates memory documents
- Supports `--dry-run`, `--force` flags
- Works with all document types (coding-standards, testing-strategy, glossary, tech-stack)

See `/speckit.memory` for full documentation.
