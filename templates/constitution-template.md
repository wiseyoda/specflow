---
version: '1.0'
description: 'Project constitution template'
---

# [PROJECT_NAME] Constitution

> **Agents**: Reference this document for architectural principles and non-negotiable project requirements.
> This is the authoritative source for project governance and development philosophy.

## Product Vision

[PRODUCT_VISION_DESCRIPTION]

**Target Audience**: [TARGET_AUDIENCE]

**Primary Experience**: [PRIMARY_EXPERIENCE]

## Core Principles

### I. [PRINCIPLE_1_NAME]

[PRINCIPLE_1_DESCRIPTION]

- [PRINCIPLE_1_REQUIREMENT_1]
- [PRINCIPLE_1_REQUIREMENT_2]
- [PRINCIPLE_1_REQUIREMENT_3]

**Rationale**: [PRINCIPLE_1_RATIONALE]

### II. [PRINCIPLE_2_NAME]

[PRINCIPLE_2_DESCRIPTION]

- [PRINCIPLE_2_REQUIREMENT_1]
- [PRINCIPLE_2_REQUIREMENT_2]
- [PRINCIPLE_2_REQUIREMENT_3]

**Rationale**: [PRINCIPLE_2_RATIONALE]

### III. [PRINCIPLE_3_NAME]

[PRINCIPLE_3_DESCRIPTION]

- [PRINCIPLE_3_REQUIREMENT_1]
- [PRINCIPLE_3_REQUIREMENT_2]
- [PRINCIPLE_3_REQUIREMENT_3]

**Rationale**: [PRINCIPLE_3_RATIONALE]

<!-- Add more principles as needed. Common principles include:
- Code Quality & Type Safety (if applicable to your language)
- Test-First Development
- Security by Default
- Accessibility & UX Excellence
- Simplicity & Maintainability
- API-First Architecture
- POSIX Compliance (for shell scripts)
- Documentation as Code
-->

## Technology Stack

<!-- Optional: Link to tech-stack.md if it exists, otherwise document key technologies here -->

**Core Technologies**: [List key technologies for your project]

**Deviation Process**: Any deviation from approved technologies MUST be documented in the
feature's `plan.md` with clear justification.

> See [`tech-stack.md`](./tech-stack.md) for complete list of approved technologies (if exists).

## Development Workflow

### Code Review Requirements

- All changes to `main` branch require pull request review
- PRs MUST include description of changes and testing performed
- Reviewer verifies constitution compliance before approval
- Squash merge for clean history

### Quality Gates

Before merge, all PRs MUST pass:

1. Build/compilation with no errors
2. Linter with no errors (warnings acceptable with justification)
3. All automated tests passing
4. Code formatting check
5. No secrets detected in code

### Commit Standards

- Conventional Commits format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Commit messages describe "why" not just "what"
- Each commit represents a logical unit of change

## Governance

### Authority

This Constitution supersedes all other development practices and guidelines.
When conflicts arise, Constitution principles take precedence.

### Amendment Process

1. Propose amendment via pull request to this file
2. Document rationale for change in PR description
3. Changes require project lead approval
4. Version increment follows semantic versioning:
   - MAJOR: Principle removed or fundamentally redefined
   - MINOR: New principle added or existing principle expanded
   - PATCH: Clarifications, typo fixes, non-semantic refinements
5. All dependent artifacts updated as part of amendment PR

### Compliance Review

- Every PR review includes Constitution compliance check
- Quarterly review of Constitution relevance (keep or amend)
- Complexity violations MUST be documented in `plan.md` with justification

### Runtime Guidance

For day-to-day development guidance, code style details, and project-specific conventions,
refer to the generated `CLAUDE.md` file at project root and feature-specific `plan.md` files.

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
