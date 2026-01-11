# Project Structure

After running `speckit scaffold`, your project will have the following structure.

## Directory Layout

```
your-project/
├── .specify/                    # SpecKit working directory
│   ├── discovery/               # Requirements interview artifacts
│   │   ├── context.md           # Project identity and context
│   │   ├── decisions.md         # Captured decisions
│   │   └── state.md             # Interview progress state
│   │
│   ├── memory/                  # Project memory documents
│   │   ├── constitution.md      # Core principles (REQUIRED)
│   │   ├── tech-stack.md        # Technology choices
│   │   ├── coding-standards.md  # Code style guidelines
│   │   ├── testing-strategy.md  # Testing approach
│   │   ├── glossary.md          # Domain terminology
│   │   ├── lessons-learned.md   # Accumulated learnings
│   │   └── adrs/                # Architecture Decision Records
│   │       └── 001-*.md
│   │
│   ├── phases/                  # Individual phase detail files
│   │   ├── 0010-feature-name.md
│   │   ├── 0020-another-feature.md
│   │   └── ...
│   │
│   ├── issues/                  # Local issue tracking
│   │   ├── 001.md
│   │   ├── 002.md
│   │   └── ...
│   │
│   ├── history/                 # Completed phase archives
│   │   └── HISTORY.md           # Archived phase details
│   │
│   ├── templates/               # Project-specific templates (optional)
│   │   └── spec-template.md     # Overrides system template
│   │
│   ├── archive/                 # State backups
│   │
│   └── orchestration-state.json # Current state (v2.0 schema)
│
├── specs/                       # Feature specifications
│   └── 0010-feature-name/       # One directory per phase
│       ├── spec.md              # Feature specification
│       ├── plan.md              # Implementation plan
│       ├── tasks.md             # Task breakdown
│       └── checklists/          # Verification checklists
│           └── checklist.md
│
├── ROADMAP.md                   # Development phases (lightweight index)
├── CLAUDE.md                    # Agent instructions (minimal SpecKit section)
└── .specify/USAGE.md            # Full CLI and command reference
```

## Key Files

### orchestration-state.json

The state file tracks current progress using v2.0 schema:

```json
{
  "schema_version": "2.0",
  "project": {
    "id": "a1b2c3d4-e5f6-...",
    "name": "my-project",
    "path": "/path/to/project",
    "created_at": "2026-01-11T12:00:00Z"
  },
  "orchestration": {
    "phase": {
      "number": "0010",
      "name": "feature-name",
      "status": "in_progress"
    },
    "step": {
      "current": "implement",
      "index": 4
    }
  },
  "health": {
    "status": "healthy",
    "last_check": "2026-01-11T12:00:00Z"
  }
}
```

### ROADMAP.md

Lightweight index of development phases:

```markdown
# Project Roadmap

## Phases

### Phase 0010: User Authentication
**Status:** complete
**Branch:** `0010-user-auth`

### Phase 0020: Dashboard
**Status:** in_progress
**Branch:** `0020-dashboard`

### Phase 0030: API Integration
**Status:** pending
```

Detailed phase information is stored in `.specify/phases/0010-*.md` files.

### constitution.md (Required)

The only required memory document. Defines core project principles:

```markdown
# Project Constitution

## Core Principles
1. User privacy is paramount
2. Performance over features
3. Simple > clever

## Non-Negotiables
- All user data encrypted at rest
- 100% test coverage for auth code
- No external analytics without consent
```

## Phase Numbering

Phases use 4-digit numbers with 10-increment gaps:

| Phase | Purpose |
|-------|---------|
| 0010 | First feature |
| 0020 | Second feature |
| 0015 | Inserted between (if needed) |

Use `speckit roadmap renumber` to clean up gaps.

## Specs Directory

Each phase gets its own directory under `specs/`:

```
specs/0010-user-auth/
├── spec.md          # What to build (requirements)
├── plan.md          # How to build it (architecture)
├── tasks.md         # Step-by-step implementation tasks
└── checklists/
    └── checklist.md # Verification items
```

## Memory Documents

| Document | Purpose | Required |
|----------|---------|----------|
| `constitution.md` | Core principles | Yes |
| `tech-stack.md` | Approved technologies | Recommended |
| `coding-standards.md` | Code style guidelines | Recommended |
| `testing-strategy.md` | Testing approach | Optional |
| `glossary.md` | Domain terminology | Optional |
| `lessons-learned.md` | Accumulated learnings | Optional |
| `adrs/*.md` | Architecture decisions | Optional |

Generate recommended documents:
```bash
speckit memory init recommended
```

## Issue Files

Local issues use frontmatter-based markdown:

```markdown
---
id: 001
title: Fix login timeout
status: open
priority: high
labels: [bug, auth]
created: 2026-01-11
---

## Description
Login times out after 30 seconds...

## Steps to Reproduce
1. ...
```

## What Gets Committed

Typically commit everything in `.specify/` except:

```gitignore
# Optional: Add to .gitignore
.specify/archive/          # State backups (optional)
```

The `specs/` directory and `ROADMAP.md` should always be committed.
