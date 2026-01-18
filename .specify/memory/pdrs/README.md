# Product Design Requirements (PDRs)

This directory contains PDRs - non-technical feature requirements that capture **what** we want to build, not **how** to build it.

## Purpose

PDRs are the bridge between ideas and implementation:

1. **Capture Requirements** - Agent or human writes a PDR for a feature idea
2. **Refine & Approve** - Iterate until requirements are clear
3. **Bundle into Phases** - Group related PDRs into implementation phases
4. **Implement** - SpecFlow generates specs, plans, and tasks from approved PDRs

## Commands

### CLI Commands (`specflow pdr`)

```bash
# List all PDRs with status
specflow pdr list

# Show status summary
specflow pdr status

# Show details for a specific PDR
specflow pdr show pdr-my-feature.md

# Validate PDR structure
specflow pdr validate pdr-my-feature.md

# Show PDR directory path
specflow pdr path

# Initialize PDR directory (if missing)
specflow pdr init
```

### Skill Command (`/specflow.phase`)

Creates ROADMAP.md phases from PDRs:

```
# Create phase from specific PDRs
/specflow.phase pdr-offline-mode.md pdr-sync-status.md

# Create phases from all approved PDRs
/specflow.phase all approved

# Interactive selection
/specflow.phase
```

## Creating a PDR

Use the template at `templates/pdr-template.md`:

```bash
cp templates/pdr-template.md .specify/memory/pdrs/pdr-my-feature.md
```

Or ask an agent:
> "Create a PDR for [feature description]"

## PDR Status

| Status | Meaning |
|--------|---------|
| `Draft` | Work in progress |
| `Ready` | Complete, awaiting approval |
| `Approved` | Ready for phase planning |
| `Implemented` | Shipped (archive candidate) |

## File Naming

Use the pattern: `pdr-[short-slug].md`

Examples:
- `pdr-offline-mode.md`
- `pdr-user-notifications.md`
- `pdr-export-to-csv.md`

## Key Principles

1. **WHAT not HOW** - No implementation details, architecture, or code
2. **User-focused** - Written from the user's perspective
3. **Measurable** - Success criteria must be observable
4. **Bounded** - Clear non-goals prevent scope creep
5. **Independent** - Each PDR should stand alone

## Workflow

```
[Idea]
   ↓
[Create PDR]         specflow pdr init (if needed)
   ↓                 cp templates/pdr-template.md .specify/memory/pdrs/pdr-feature.md
[Refine PDR]         Edit file, fill in sections
   ↓
[Validate]           specflow pdr validate pdr-feature.md
   ↓
[Approve]            Edit file: Status: Draft → Approved
   ↓
[Create Phase]       /specflow.phase pdr-feature.md
   ↓
[Implement]          /specflow.orchestrate
```

## Required Sections

The following sections must be present for a valid PDR:

- `## Problem Statement` - Why this matters
- `## Desired Outcome` - What success looks like
- `## User Stories` - Who needs what and why
- `## Success Criteria` - Measurable outcomes
- `## Acceptance Criteria` - Done conditions

## Optional Sections

These sections provide additional context:

- `## Constraints` - Boundaries (Must/Should/Must Not)
- `## Non-Goals` - Explicit exclusions
- `## Dependencies` - External factors
- `## Open Questions` - Unresolved items
- `## Related PDRs` - Cross-references
