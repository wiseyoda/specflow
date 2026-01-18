# Implementation Plan: CLI TypeScript Migration

**Branch**: `0080-cli-typescript-migration` | **Date**: 2025-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/0080-cli-typescript-migration/spec.md`

## Summary

Migrate 24 bash scripts (~18k lines) to 5 smart TypeScript commands that return rich, contextual data. Each command returns everything Claude needs - no follow-up calls required. Reduces CLI calls per phase from 50-100 to 10-15.

## Technical Context

**Language/Version**: TypeScript 5.4+ / Node.js 20+
**Primary Dependencies**: Commander.js 12.x, Chalk 5.x, Zod 3.23+
**Storage**: JSON files (`.specify/orchestration-state.json`, markdown files)
**Testing**: Vitest 2.x with parity tests against bash
**Target Platform**: macOS/Linux CLI (Node.js)
**Project Type**: Monorepo package (`packages/cli`)
**Performance Goals**: <500ms per command, <5s build time
**Constraints**: ESM modules, hybrid dispatcher during transition
**Scale/Scope**: 5 commands, ~4-6k lines TypeScript (down from 18k bash)

## Constitution Check

_GATE: Checked against `.specify/memory/constitution.md` v1.2.0_

- [x] I. Developer Experience First - Smart commands reduce cognitive load
- [x] II. POSIX-Compliant Bash for Scripts - bin/specflow dispatcher remains bash
- [x] IIa. TypeScript for CLI Packages - packages/cli uses TypeScript + strict mode
- [x] III. CLI Over Direct Edits - All state changes via CLI commands
- [x] IV. Simplicity Over Cleverness - Clear command structure, explicit logic
- [x] V. Helpful Error Messages - NFR-006 requires context + next steps
- [x] VI. Graceful Degradation - Hybrid dispatcher, partial status on missing files
- [x] VII. Three-Line Output Rule - NFR-005 requires compliance

## Project Structure

### Documentation (this feature)

```text
specs/0080-cli-typescript-migration/
├── spec.md              # Feature specification
├── discovery.md         # Codebase examination and scope clarification
├── plan.md              # This file
├── cli-design.md        # Command specifications and output schemas
├── command-mapping.md   # Bash → TypeScript mapping reference
├── target-architecture.md # Package structure documentation
├── tasks.md             # Task list (generated)
└── checklists/          # Verification checklists
    ├── implementation.md
    └── verification.md
```

### Source Code (repository root)

```text
packages/cli/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── src/
    ├── index.ts              # CLI entry point (Commander.js)
    ├── commands/
    │   ├── status.ts         # specflow status (US1)
    │   ├── next.ts           # specflow next (US2)
    │   ├── mark.ts           # specflow mark (US3)
    │   ├── check.ts          # specflow check (US4)
    │   └── state/            # specflow state (US5)
    │       ├── index.ts
    │       ├── get.ts
    │       ├── set.ts
    │       ├── show.ts
    │       └── init.ts
    ├── lib/
    │   ├── state.ts          # State file operations
    │   ├── tasks.ts          # Task parsing from tasks.md
    │   ├── roadmap.ts        # ROADMAP.md parsing
    │   ├── checklist.ts      # Checklist parsing
    │   ├── context.ts        # Project context resolution
    │   ├── health.ts         # Health checks
    │   ├── output.ts         # Output formatting (JSON/human)
    │   ├── errors.ts         # Error types and handling
    │   └── paths.ts          # Path resolution utilities
    └── types/
        └── index.ts          # Re-export from @specflow/shared

tests/
├── commands/             # Command integration tests
├── lib/                  # Library unit tests
├── parity/               # Bash vs TypeScript parity tests
└── fixtures/             # Test data (state files, markdown)
```

**Structure Decision**: Single package in monorepo, shared types from `packages/shared`

---

## Implementation Status

> Last updated: 2025-01-18

| Phase | Status | Progress |
|-------|--------|----------|
| Scaffolding | ✅ Complete | Package created, builds working |
| state command | ✅ Complete | get, set, show, init working |
| status command | ⏳ Pending | Aggregate status from all sources |
| next command | ⏳ Pending | Next actionable item with context |
| mark command | ⏳ Pending | Mark + return updated state |
| check command | ⏳ Pending | Validation with fixes |
| Integration | ⏳ Pending | Hybrid dispatcher, slash command updates |

### Completed Work

- [x] Analyzed 24 bash scripts and their usage (68 refs to state, 49 to roadmap)
- [x] Designed Smart Commands architecture (5 commands vs 24)
- [x] Created `packages/cli/` with TypeScript + tsup + vitest
- [x] Fixed `packages/shared/` ESM builds (.js extensions)
- [x] Implemented `specflow state` command (get, set, show, init)
- [x] Verified CLI builds and runs correctly

### Files Created

```
packages/cli/src/
├── index.ts
├── commands/state/
│   └── index.ts, get.ts, set.ts, show.ts, init.ts, sync.ts
└── lib/
    └── paths.ts, errors.ts, output.ts, state.ts
```

---

## Design References

Detailed command specifications and migration mappings are in separate design documents:

- **[cli-design.md](./cli-design.md)** - Smart commands architecture with output schemas
- **[command-mapping.md](./command-mapping.md)** - Bash → TypeScript command mapping
- **[target-architecture.md](./target-architecture.md)** - Package structure and build configuration

---

## Complexity Tracking

_No constitution violations - all constraints satisfied by design._

| Pattern | Why Used | Simpler Alternative |
|---------|----------|---------------------|
| Smart commands | Reduce CLI calls 5x | 1:1 bash migration would preserve call overhead |
| Hybrid dispatcher | Gradual migration | Big-bang rewrite would be risky |
| Zod schemas | Runtime type safety | Manual validation would be error-prone |
