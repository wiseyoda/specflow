---
description: Create or update the project ROADMAP.md with logical feature phases, verification gates, and phase sizing for agentic development.
handoffs:
  - label: Start First Phase
    agent: flow.orchestrate
    prompt: Begin orchestrated development from the roadmap
---

## User Input

```text
$ARGUMENTS
```

## Arguments

| Argument | Description |
|----------|-------------|
| (empty) | Generate or update ROADMAP.md |
| `add-pdr` | Convert PDRs to phases → [Add PDR](#add-pdr-subcommand) |
| `add-pdr --all` | Convert all approved PDRs |
| `backlog` | Triage backlog items → [Backlog](#backlog-subcommand) |
| `backlog --auto` | Auto-assign high-confidence matches |
| Other text | Use as project description for generation |

---

## Execution

### 1. Initialize

```bash
specflow status --json
```

Parse response:
- Check if ROADMAP.md exists (via file system)
- Get project context if available

If ROADMAP.md exists, ask user:
- Update existing (add phases, update statuses)
- Replace entirely
- Cancel

### 2. Load Context

Read available sources (in priority order):
- `.specify/discovery/context.md` - project type, criticality
- `.specify/discovery/decisions.md` - key architecture choices
- `.specify/memory/constitution.md` - core principles
- `.specify/memory/tech-stack.md` - technology stack
- User input - vision, specific requirements

### 3. Apply Core Principles

**CRITICAL: Prove Core Functionality First**

The roadmap MUST follow this pattern:

1. **Core business logic FIRST** (no UI, no database)
2. **POC test page** to verify core logic works (USER GATE)
3. **Data layer** (database, persistence)
4. **API layer** exposing data
5. **API-integrated POC** to verify data flow (USER GATE)
6. **External integrations** (AI, payments, etc.) if applicable
7. **Integration POC** to verify integrations (USER GATE)
8. **Production UI**
9. **Complete UX POC** (USER GATE)
10. **Admin capabilities** if applicable
11. **Production hardening** (PWA, performance, accessibility)
12. **Authentication** (intentionally late - anonymous-first)
13. **Deployment** (USER GATE)

**Why this order?**
- Validates core assumptions before building on them
- Catches fundamental issues early
- Each POC is a checkpoint for user verification
- UI is built on proven, stable foundations

### 4. Size Phases for Agentic Development

Each phase MUST be sized for a **single agentic coding session** (~200k tokens):

| Size | Characteristics | Example |
|------|----------------|---------|
| Small | 1-2 files, minimal testing | "Add loading spinner" |
| Medium | 3-5 files, unit tests | "Implement flow engine" |
| Large | 5-10 files, integration tests | "Build API endpoints" |
| Too Large | Split required | "Build entire admin UI" → split |

**Phase Sizing Rules:**
- Prefer medium-sized phases (3-5 files, ~500-1000 lines)
- Each phase produces a deployable increment
- Include tests within the phase (not separate testing phases)
- No phase should depend on incomplete phases

### 5. Number Phases (ABBC Format)

`NNNN` = Four-digit ABBC number:
- **A** = Milestone (0-9)
- **BB** = Phase within milestone (01-99)
- **C** = Hotfix slot (0 = main, 1-9 = hotfixes)

**Examples:**
- `0010` - Milestone 0, Phase 01, main
- `0020` - Milestone 0, Phase 02, main
- `0021` - Hotfix after Phase 02
- `1010` - Milestone 1, Phase 01, main

**Rules:** Start at 0010, increment by 10, use hotfix slots for insertions.

### 6. Define User Verification Gates

Place USER GATES at critical checkpoints:

| Gate Type | When to Use |
|-----------|-------------|
| Core Logic POC | After building main business logic |
| Integration POC | After connecting layers |
| Feature POC | After major feature set |
| UX POC | After UI implementation |
| Production Gate | Before launch |

**Gate Requirements:** Specific, testable criteria. Clear pass/fail. Cannot proceed until passed.

### 7. Generate Output

Create `ROADMAP.md` in project root:

```markdown
# [Project Name] Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.

**Project**: [Name] - [Brief Description]
**Created**: [Date]
**Schema Version**: 2.1 (ABBC numbering)
**Status**: [Not Started | In Progress | Complete]

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | phase-name | ⬜ Not Started | Gate description |
| 0020 | phase-name | ⬜ Not Started | Gate description |
| 0030 | **user-gate-poc** | ⬜ Not Started | **USER GATE**: Description |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| Gate 1 | 0030 | Description |

---

## How to Use

### Starting Development
```
/flow.orchestrate
```

### After Completing a Phase
1. Update status: ⬜ → ✅
2. If USER GATE: get explicit user verification before proceeding
```

For each phase, also create `.specify/phases/NNNN-phase-name.md`:

```markdown
---
phase: NNNN
name: phase-name
status: not_started
created: YYYY-MM-DD
---

### NNNN - Phase Name

**Goal**: [One sentence]

**Scope**:
- [Bullet list of what's included]
- [Include testing scope]

**Deliverables**:
- `path/to/file.ts` - Description
- Tests for above

**Verification Gate**: [Specific, testable criteria]

**Estimated Complexity**: [Low/Medium/High]
```

### 8. Insert Phases

Use CLI to add phases to existing ROADMAP:

```bash
specflow phase add 0010 "core-engine"
specflow phase add 0020 "database-schema" --gate "Schema migrations run successfully"
specflow phase add 0030 "api-poc" --user-gate --gate "API returns valid data"
```

### 9. Post-Generation

1. **Write files** - ROADMAP.md and phase files
2. **Report summary** - total phases, USER GATES, starting point
3. **Suggest commit**: `feat(roadmap): add project roadmap with N phases`

---

## Add PDR Subcommand

Converts PDRs (Product Design Requirements) from `.specify/memory/pdrs/` into ROADMAP phases.

### Execution

1. **List PDRs**: Scan `.specify/memory/pdrs/*.md` (exclude `_` prefixed files)

2. **Select PDRs**: If none specified, present options to user:
   - Show PDRs with status "Approved" or "Ready"
   - Let user multi-select

3. **For each PDR**, extract:
   - Title → Phase name
   - Problem Statement + Desired Outcome → Phase goal
   - User Stories → Scope items
   - Success Criteria + Acceptance Criteria → Verification gate

4. **Calculate phase number**: Get next available from ROADMAP

5. **Insert phase**:
   ```bash
   specflow phase add NNNN "phase-name" --gate "verification criteria"
   ```

6. **Create phase file**: `.specify/phases/NNNN-phase-name.md`

7. **Mark PDR as processed**: Rename with `_` prefix
   ```bash
   mv .specify/memory/pdrs/pdr-feature.md .specify/memory/pdrs/_pdr-feature.md
   ```

### Output

```
Created N phase(s) from M PDR(s):
  0020 - Offline Mode Support (from pdr-offline-mode.md)

PDRs marked as processed: _pdr-offline-mode.md

Next: /flow.orchestrate to begin development
```

---

## Backlog Subcommand

Triages backlog items and orphaned tasks into appropriate phases.

### Execution

1. **Scan for orphaned tasks**: Check completed phase specs for incomplete tasks
   - Read `specs/*/tasks.md` for phases marked complete
   - Find tasks still marked `- [ ]`
   - Add to backlog: `specflow phase defer "[Orphaned from NNNN] T###: description"`

2. **Parse backlog**: Read `BACKLOG.md` or backlog section from ROADMAP

3. **Match items to phases**: For each backlog item:
   - Extract keywords
   - Compare against phase Goal and Scope
   - Calculate confidence score (keyword match, domain alignment)

4. **Present matches**:
   ```
   Item: "Add dark mode support"
   Best match: 0020 - UI Polish (confidence: 0.65)

   Options:
   A. Assign to 0020 (Recommended)
   B. Assign to different phase
   C. Create new phase
   D. Skip (keep in backlog)
   ```

5. **Update ROADMAP**: Add assigned items to phase scope

6. **With `--auto`**: Auto-assign items with confidence ≥ 0.7

### Output

```
Triage Complete:
  Assigned: 3 items to existing phases
  New phases: 1 created (0051 - Integration Features)
  Remaining: 1 item in backlog

Next: /flow.orchestrate to continue
```

---

## Constraints

- **Preserve completion status** when updating existing ROADMAP
- **Never delete phases** without user confirmation
- **USER GATES are non-negotiable** - cannot be skipped
- **Phases must be deployable** - no half-finished features
