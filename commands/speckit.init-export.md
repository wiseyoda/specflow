# Export Interview to Memory Documents

> **Note**: This command is deprecated. Use `/speckit.init export` instead.
> This file is kept for backwards compatibility.

Generate SpecKit memory documents from interview decisions.

## Arguments
$ARGUMENTS - Export format: summary | constitution | tech-stack | all

## Actions

1. Read all interview files:
   - `.specify/discovery/decisions.md`
   - `.specify/discovery/context.md`
   - `.specify/discovery/state.md`
2. Group decisions by target memory document
3. Generate requested format(s)
4. Write to `.specify/memory/`

## Export Formats

### `summary` → `.specify/discovery/summary.md`
One-page project overview:
- Project identity (from Phase 0)
- Problem statement (from Phase 1)
- Key users (from Phase 2)
- Core features (from Phase 3) - bullet list
- Top 5 architecture decisions
- Key constraints and trade-offs
- Memory document readiness status

### `constitution` → `.specify/memory/constitution.md`
Draft constitution from interview decisions:

```markdown
# [Project Name] Constitution

> **Agents**: Reference this document for architectural principles and non-negotiable project requirements.
> This is the authoritative source for project governance and development philosophy.

## Product Vision

[From Phase 1 decisions - problem statement, success criteria]

**Target Audience**: [From Phase 2 decisions]

**Primary Experience**: [From Phase 2, 7 decisions]

## Core Principles

### I. [Principle from Phase 4/5 decisions]

[Description from decision context]

- [MUST/SHOULD requirements]
- [Constraints]

**Rationale**: [From decision rationale]

[Repeat for each principle identified - typically 8-12 principles]

## Technology Stack

See [`tech-stack.md`](./tech-stack.md) for the complete list of approved technologies.

**Deviation Process**: [From Phase 5 decisions or default]

## Development Workflow

[From Phase 5, 9 decisions]

## Governance

[From Phase 10 decisions or default template]

**Version**: 0.1.0-draft | **Generated**: [DATE] | **Status**: DRAFT - Finalize with /speckit.constitution
```

### `tech-stack` → `.specify/memory/tech-stack.md`
Technology decisions organized:

```markdown
# [Project Name] Technology Stack

> **Agents**: Reference this document for approved technologies, versions, and package policies.

**Last Updated**: [DATE]
**Status**: DRAFT - Review and finalize

---

## Version Matrix

### Runtime & Language

| Technology | Version | Constraint | Notes |
|------------|---------|------------|-------|
[From Phase 5 technology decisions]

### Frontend
[If applicable - from decisions]

### Backend
[If applicable - from decisions]

### Database
[If applicable - from decisions]

### Testing
[From Phase 9 decisions]

---

## Package Policies

### MUST Use (No Alternatives)
[From decisions with "must use" or "standard" markers]

### MUST NOT Use
[From decisions with "avoid" or "banned" markers]

---

## Environment Configuration

[From Phase 5, 8 decisions]

---

## Deviation Process

[Default or from decisions]
```

### `glossary` → `.specify/memory/glossary.md`
Domain terms from interview:

```markdown
# [Project Name] Glossary

> **Agents**: Reference this document for consistent terminology.

**Last Updated**: [DATE]

---

## Domain Terms

[Extract terms defined or clarified during Phases 1-3]

### [Term]
[Definition from decisions]
- **Properties**: [if applicable]
- **Related**: [related terms]

---

## Technical Terms

[Extract from Phases 5-6]

---

## Abbreviations

[Extract any abbreviations mentioned]
```

### `security` → `.specify/memory/security-checklist.md`
Security requirements:

```markdown
# [Project Name] Security Checklist

> **Agents**: Reference for security requirements and compliance.

**Last Updated**: [DATE]

---

## Authentication & Authorization
[From Phase 4 security decisions]

## Data Protection
[From Phase 4 decisions about sensitive data]

## Input Validation
[From Phase 6 error handling decisions]

## Infrastructure Security
[From Phase 5, 8 decisions]
```

### `testing` → `.specify/memory/testing-strategy.md`
Test approach:

```markdown
# [Project Name] Testing Strategy

> **Agents**: Reference for test patterns and coverage requirements.

**Last Updated**: [DATE]

---

## Test Pyramid
[From Phase 9 decisions]

## Coverage Requirements
[From Phase 9 decisions]

## Test Patterns
[From Phase 9 decisions]
```

### `adrs` → `.specify/memory/adrs/`
Architecture Decision Records:
- One file per major architecture decision from Phase 5
- Filename: `NNN-[slug].md`
- MADR format

### `all`
Generate all formats above plus:
- `coding-standards.md` (from Phase 5)
- `api-standards.md` (from Phase 3, 5)
- `design-system.md` (from Phase 7)
- `performance-budgets.md` (from Phase 4, 8)
- `ux-patterns.md` (from Phase 7)

## Post-Export

After generating:

```markdown
## Memory Documents Generated

### Created/Updated
| Document | Decisions Used | Status |
|----------|---------------|--------|
| constitution.md | 12 | DRAFT |
| tech-stack.md | 8 | DRAFT |
| ... | ... | ... |

### Gaps (Insufficient Decisions)
| Document | Decisions | Minimum Needed | Action |
|----------|-----------|----------------|--------|
| security-checklist.md | 1 | 5 | Run Phase 4 or add manually |

### Next Steps
1. **Review drafts**: All generated documents are marked DRAFT
2. **Finalize constitution**: Run `/speckit.constitution` to refine principles
3. **Fill gaps**: Address documents with insufficient coverage
4. **Start features**: Once memory is ready, run `/speckit.specify`

### Handoff to Constitution
To finalize the constitution with interactive refinement:
\`\`\`
/speckit.constitution
\`\`\`
```

## User Input

```text
$ARGUMENTS
```
