# Templates Guide

SpecKit uses templates to generate consistent documentation artifacts. Templates can be customized at project or system level.

## Template Locations

| Level | Location | Priority |
|-------|----------|----------|
| Project | `.specify/templates/` | Highest (overrides system) |
| System | `~/.claude/speckit-system/templates/` | Default |

## Available Templates

```
templates/
├── spec-template.md          # Feature specification
├── plan-template.md          # Implementation plan
├── tasks-template.md         # Task breakdown
├── checklist-template.md     # Verification checklist
├── roadmap-template.md       # Project roadmap
├── review-template.md        # Code review
└── memory/                   # Memory document templates
    ├── constitution.md
    ├── tech-stack.md
    ├── coding-standards.md
    ├── testing-strategy.md
    └── glossary.md
```

## Managing Templates

### List Available Templates

```bash
speckit templates list
```

### Copy Template to Project

Copy a system template to your project for customization:

```bash
speckit templates copy spec-template.md
```

This creates `.specify/templates/spec-template.md` which overrides the system default.

### Check for Updates

See if your project templates differ from upstream:

```bash
speckit templates check
```

### View Differences

```bash
speckit templates diff spec-template.md
```

### Update Templates

```bash
speckit templates update spec-template.md    # Update specific
speckit templates update-all                  # Update all
```

## Template Variables

Templates support variable substitution during generation:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{PHASE_NUMBER}}` | 4-digit phase number | `0041` |
| `{{PHASE_NAME}}` | Phase name (kebab-case) | `code-review-findings` |
| `{{DATE}}` | Current date | `2026-01-11` |
| `{{PROJECT_NAME}}` | Project name from state | `my-app` |
| `{{PROJECT_TYPE}}` | Detected project type | `typescript` |

## Customization Examples

### Custom Spec Template

Create `.specify/templates/spec-template.md`:

```markdown
# {{PHASE_NAME}} Specification

**Phase:** {{PHASE_NUMBER}}
**Date:** {{DATE}}

## Overview

<!-- Your custom sections -->

## Requirements

### Functional Requirements

### Non-Functional Requirements

## Acceptance Criteria

## Out of Scope
```

### Custom Checklist Template

Create `.specify/templates/checklist-template.md`:

```markdown
# {{PHASE_NAME}} Checklist

## Pre-Implementation
- [ ] Spec reviewed and approved
- [ ] Plan reviewed and approved
- [ ] Dependencies identified

## Implementation
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Code reviewed

## Post-Implementation
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Demo prepared
```

## Project Type Detection

SpecKit auto-detects project type and selects appropriate template variants:

| Detection | Project Type |
|-----------|-------------|
| `tsconfig.json` | TypeScript |
| `package.json` | JavaScript |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pyproject.toml` | Python |
| `*.sh` files | Bash |
| None | Generic |

The project type affects:
- Default testing framework in templates
- Code style recommendations
- Build/lint command suggestions

## Best Practices

1. **Start with defaults** - Use system templates initially
2. **Customize gradually** - Only copy templates you need to modify
3. **Keep templates minimal** - Don't over-engineer
4. **Version control** - Commit `.specify/templates/` to your repo
5. **Check updates** - Periodically run `speckit templates check`
