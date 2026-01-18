# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecFlow v3.0 is a spec-driven development framework for Claude Code. This repository contains the development source - changes are deployed to users via `./install.sh` which copies files to `~/.claude/`.

## Commands

```bash
# Smart Commands (TypeScript CLI)
specflow status              # Complete project status
specflow next                # Next actionable task with context
specflow mark T007           # Mark task complete
specflow check --fix         # Validation with auto-fix
specflow state get <key>     # State operations
specflow phase close         # Close current phase (update ROADMAP, archive)

# All commands support --json for machine-readable output
specflow status --json
specflow next --json
```

## Architecture

The CLI uses a TypeScript architecture with a bash dispatcher:

```
bin/specflow                 → Bash dispatcher, routes to TypeScript CLI
packages/cli/                → TypeScript CLI implementation
├── src/
│   ├── index.ts            → Main entry, Commander.js setup
│   ├── commands/           → Command implementations
│   │   ├── status.ts       → Project status command
│   │   ├── next.ts         → Next task command
│   │   ├── mark.ts         → Mark task command
│   │   ├── check.ts        → Validation command
│   │   ├── state/          → State subcommands
│   │   └── phase/          → Phase lifecycle (open/close/status)
│   └── lib/                → Shared libraries
│       ├── tasks.ts        → Parse tasks.md
│       ├── roadmap.ts      → Parse ROADMAP.md
│       ├── checklist.ts    → Parse checklists
│       ├── context.ts      → Project context resolution
│       ├── health.ts       → Health check logic
│       ├── state.ts        → State file operations
│       ├── paths.ts        → Path resolution
│       └── specs.ts        → Spec cleanup/archiving
├── tests/                  → Vitest tests
└── dist/                   → Compiled output

commands/flow.*.md          → Claude Code slash commands (/flow.*)
```

**State file**: `.specify/orchestration-state.json` in target projects.

## CLI Syntax Notes

```bash
# State operations
specflow state get orchestration.phase.number
specflow state set orchestration.step.current=verify

# Mark tasks or checklist items
specflow mark T007              # Single task
specflow mark T007 T008 T009    # Multiple tasks
specflow mark T007..T010        # Range
specflow mark V-001             # Single verification item
specflow mark V-001 V-002       # Multiple checklist items
specflow mark I-001             # Implementation checklist item

# Validation gates
specflow check --gate design    # Verify design artifacts exist
specflow check --gate implement # Verify all tasks complete
specflow check --gate verify    # Verify checklists complete
specflow check --gate memory    # Verify memory docs healthy
specflow check --fix            # Auto-fix issues

# Phase lifecycle
specflow phase                  # Show current phase
specflow phase open 0081        # Start a specific phase
specflow phase open --hotfix    # Create and start a hotfix phase (auto-number)
specflow phase open --hotfix "Code Review"  # Hotfix with custom name
specflow phase close            # Close current phase (archives specs, promotes incomplete tasks)
specflow phase close --dry-run  # Preview close operations
specflow phase close --keep-specs  # Keep specs directory instead of archiving
specflow phase archive 0042     # Retroactively archive a completed phase
specflow phase archive 0042 --dry-run  # Preview archive operations
specflow phase scan             # Scan archives for incomplete tasks
specflow phase scan --verbose   # Show task details
specflow phase scan --suggest-backlog  # Generate BACKLOG.md entries
specflow phase defer "item"     # Add item to BACKLOG.md
specflow phase defer "item1" "item2"  # Add multiple items
specflow phase add 0010 "core-engine"  # Add phase to ROADMAP
specflow phase add 0020 "api-poc" --user-gate --gate "API works"  # With USER GATE
```

## Code Style

- TypeScript with strict mode
- ESM modules
- 2-space indentation
- Vitest for testing
- Commander.js for CLI
- Zod for validation (via @specflow/shared)

## Development Workflow

1. Make changes in `packages/cli/src/`
2. Build: `pnpm --filter @specflow/cli build`
3. Test: `pnpm --filter @specflow/cli test`
4. Run: `specflow <command>`

## Artifact Lifecycle

SpecFlow creates these artifacts in target projects:

| Location | Purpose | Lifecycle |
|----------|---------|-----------|
| `specs/NNNN-name/` | Active phase artifacts (spec.md, plan.md, tasks.md, checklists/) | Created during phase, archived on close |
| `.specify/archive/NNNN-name/` | Archived phase specs | Created on `phase close` |
| `.specify/phases/NNNN.md` | Future/in-progress phase details | Until phase closes |
| `.specify/history/HISTORY.md` | Archived phase summaries | Appended on `phase close` |
| `ROADMAP.md` | Phase overview table | Updated on `phase close` |
| `BACKLOG.md` | Deferred items | Accumulated during verify |
| `.specify/memory/` | Evergreen project knowledge | Continuously updated |

## Claude Code Slash Commands

The `/flow.*` commands are Claude-side workflows that leverage AI judgment:

| Command | Purpose |
|---------|---------|
| `/flow.orchestrate` | End-to-end phase execution with self-healing |
| `/flow.design` | Create all design artifacts (discovery, spec, plan, tasks) |
| `/flow.implement` | Execute tasks with TDD |
| `/flow.verify` | Verify completion, update ROADMAP |
| `/flow.merge` | Close phase, push, and merge to main |
| `/flow.memory` | Verify and optimize memory documents |
| `/flow.memory --archive <phase\|all>` | Review archived phases for memory promotion |
| `/flow.analyze` | Cross-artifact consistency analysis |
| `/flow.review` | Systematic code reviews |

**Memory Archive Review** (`/flow.memory --archive`):
- Scans archived phase documents for promotable content
- Detects explicit markers (`[PROMOTE]`, `[MEMORY]`) and implicit signals
- Assesses codebase relevance before promotion
- Presents findings interactively for approval
- Tracks reviewed status in state to prevent re-review

## Key Files (This Repo)

- `packages/cli/` - TypeScript CLI source
- `commands/flow.*.md` - Claude Code slash commands (`/flow.orchestrate`, `/flow.design`)
- `.specify/memory/constitution.md` - Project principles

## Important Notes

- **JSON output**: All commands support `--json` for machine-readable output
- **Monorepo**: `packages/cli`, `packages/shared`, `packages/dashboard`
- **Deprecated commands**: Old bash commands (context, doctor, tasks, etc.) show migration guidance
