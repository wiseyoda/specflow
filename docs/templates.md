# Templates Guide

SpecFlow uses templates to generate consistent documentation artifacts. Templates can be customized at project or system level.

## Template Locations

| Level | Location | Priority |
|-------|----------|----------|
| Project | `.specify/templates/` | Highest (overrides system) |
| System | `~/.claude/specflow-system/templates/` | Default |

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

### Project-Level Customization

To customize templates for your project, copy the system template to your project's `.specify/templates/` directory:

```bash
# Copy a system template to your project
cp ~/.claude/specflow-system/templates/spec-template.md .specify/templates/
```

Then edit the copied template. Your project template will override the system default.

### Creating Custom Templates

Create `.specify/templates/` in your project and add custom templates:

```bash
mkdir -p .specify/templates
```

Templates in this directory will be used instead of system templates.

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

SpecFlow auto-detects project type and selects appropriate template variants:

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
5. **Document changes** - Note why you customized a template

## Template Updates

When SpecFlow is updated, system templates may change. Your project templates remain unchanged, preserving your customizations.

To incorporate updates:
1. Review the updated system template
2. Manually merge changes into your project template
3. Test that your workflow still works correctly
