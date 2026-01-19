# Integration Guide

This guide explains how to integrate SpecFlow with projects that have existing documentation.

## Overview

SpecFlow can work with existing documentation from your project, preserving your institutional knowledge while adding SpecFlow's structured workflow. This is especially useful for:

- Projects with existing Architecture Decision Records (ADRs)
- Established codebases with existing documentation
- Teams migrating from other documentation systems

## Integrating with Existing Projects

### Using /flow.init

The `/flow.init` command is the primary way to integrate SpecFlow with an existing project:

```
/flow.init
```

During initialization, the discovery interview will:
1. Examine your existing codebase structure
2. Detect existing documentation and ADRs
3. Capture project context and decisions
4. Generate memory documents that complement existing docs

### Existing ADRs

If your project has existing Architecture Decision Records, `/flow.init` can detect and reference them during the discovery process. Your ADRs remain in their original location, and the generated memory documents will reference them.

**Common ADR locations detected:**
- `docs/adr/`
- `docs/decisions/`
- `adr/`
- `adrs/`

### Existing Documentation

SpecFlow detects common documentation patterns:

| Pattern | Description |
|---------|-------------|
| `docs/`, `doc/` | Documentation directories |
| `ARCHITECTURE.md` | Architecture documentation |
| `CONTRIBUTING.md` | Contribution guidelines |
| `DESIGN.md` | Design documentation |
| `openapi.yaml`, `swagger.json` | API specifications |

The discovery interview incorporates this context into generated memory documents.

## Memory Document Integration

### Approach

Rather than importing or duplicating existing docs, SpecFlow:

1. **References** existing documentation in memory documents
2. **Extracts** key decisions and principles during discovery
3. **Complements** existing docs with SpecFlow-specific artifacts

### constitution.md

The constitution captures core principles extracted from your existing documentation and discovery interview:

```markdown
# Project Constitution

## Core Principles
<!-- Extracted from existing docs and discovery -->
1. User privacy is paramount
2. Performance over features

## References
- See `docs/ARCHITECTURE.md` for detailed architecture
- See `docs/adr/` for historical decisions
```

### tech-stack.md

Generated from existing `package.json`, `Cargo.toml`, or similar, plus discovery answers:

```markdown
# Tech Stack

## Languages
- TypeScript (primary)
- Python (scripts)

## Frameworks
- Next.js 14 (from package.json)

## References
- See `docs/tech-decisions.md` for rationale
```

## Common Workflows

### New SpecFlow on Existing Codebase

```
# 1. Initialize SpecFlow
/flow.init

# 2. Answer discovery questions (references existing docs)

# 3. Review generated memory documents

# 4. Create first roadmap
/flow.roadmap
```

### Keeping Docs in Sync

Use `/flow.memory` to detect drift between memory documents and codebase:

```
/flow.memory              # Full reconciliation
/flow.memory --promote    # Promote learnings from completed specs
```

## What SpecFlow Creates vs. Uses

### SpecFlow Creates

| Artifact | Location | Purpose |
|----------|----------|---------|
| `orchestration-state.json` | `.specflow/` | Workflow state |
| `constitution.md` | `.specify/memory/` | Core principles |
| `tech-stack.md` | `.specify/memory/` | Technology choices |
| Phase specs | `specs/NNNN-*/` | Feature specifications |
| `ROADMAP.md` | Project root | Development phases |
| `BACKLOG.md` | Project root | Deferred items |

### SpecFlow Uses (Read-Only)

| Artifact | Purpose |
|----------|---------|
| Existing ADRs | Context for decisions |
| `package.json` / `Cargo.toml` | Tech stack detection |
| Existing docs | Reference during discovery |
| `.git` | Branch management |

## Best Practices

1. **Don't duplicate** - Reference existing docs rather than copying content
2. **Keep ADRs where they are** - SpecFlow works with ADRs in any location
3. **Use discovery** - Let `/flow.init` examine your codebase naturally
4. **Run memory checks** - Use `/flow.memory` periodically to detect drift
5. **Update constitution** - Keep core principles current as project evolves

## Troubleshooting

### "Missing constitution.md"

Run `/flow.init` to generate memory documents from your project context.

### ADRs Not Detected

Ensure ADRs follow standard naming patterns:
- `NNN-*.md` (3-digit number prefix)
- `NNNN-*.md` (4-digit number prefix)
- `ADR-NNN-*.md` (ADR prefix with number)

### Memory Docs Outdated

Run `/flow.memory --reconcile` to detect and fix drift between memory documents and your codebase.
