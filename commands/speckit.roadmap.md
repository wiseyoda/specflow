---
description: Create or update the project ROADMAP.md with logical feature phases, verification gates, and phase sizing for agentic development.
handoffs:
  - label: Start First Phase
    agent: speckit.specify
    prompt: Create a specification for the first phase in the roadmap
  - label: Run Full Orchestration
    agent: speckit.orchestrate
    prompt: Begin orchestrated development from the roadmap
    send: true
  - label: Continue Later
    agent: speckit.start
    prompt: Resume work on this project
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). The user may provide:
- A project description or vision
- Specific phases they want included
- Number of phases to generate
- Phase sizing preferences

## Goal

Create or update `ROADMAP.md` in the repository root. This file serves as the **single source of truth** for:
- What feature phases exist
- Their logical order (dependencies build on each other)
- Current completion status
- User verification gates
- Phase sizing for agentic coders

## Pre-Execution: Load Context

### 1. Check for Existing Context

Load these files if they exist (in order of priority):

```bash
# Discovery artifacts (from /speckit.init)
CONTEXT=".specify/discovery/context.md"
DECISIONS=".specify/discovery/decisions.md"

# Memory documents
CONSTITUTION=".specify/memory/constitution.md"
TECH_STACK=".specify/memory/tech-stack.md"

# Existing roadmap
ROADMAP="ROADMAP.md"
```

### 2. Extract Project Understanding

From available sources, determine:

| Source | Extract |
|--------|---------|
| context.md | Project name, type, criticality, target users |
| decisions.md | Key architecture decisions, technology choices |
| constitution.md | Core principles, non-negotiables |
| tech-stack.md | Technology stack for implementation |
| User input | Vision, specific requirements, phase preferences |

### 3. Check for Existing ROADMAP.md

Use the SpecKit CLI to check ROADMAP status:

```bash
# Check if ROADMAP exists and is valid
speckit roadmap validate

# Get current phase statuses
speckit roadmap status

# Get current/next phase info
speckit roadmap current
speckit roadmap next
```

If `ROADMAP.md` exists:
- Parse current phases and their status
- Identify completed vs pending phases
- Preserve completion status when updating
- Ask user if they want to: update existing, replace entirely, or add phases

## Roadmap Generation Workflow

### Phase 1: Determine Project Scope

Based on context, identify the major functional areas:

**For a typical application:**
1. **Foundation** - Project setup, architecture, core types
2. **Core Business Logic** - The main engine/service (POC to verify it works)
3. **Data Layer** - Database schema, data access
4. **API Layer** - Endpoints exposing business logic
5. **External Integrations** - AI, payments, auth providers (if applicable)
6. **User Interface** - Components, pages, user flows
7. **Admin/Management** - Admin UI, configuration (if applicable)
8. **Production Readiness** - PWA, performance, accessibility, error handling
9. **Authentication & User Data** - Auth, user profiles, sync (if applicable)
10. **Deployment** - Production deployment, monitoring

### Phase 2: Apply Core Principles

**CRITICAL PRINCIPLE: Prove Core Functionality First**

The roadmap MUST follow this pattern:
1. **Build core business logic FIRST** (no UI, no database)
2. **Create POC test page** to verify core logic works (USER GATE)
3. **Add data layer** (database, persistence)
4. **Add API layer** exposing data
5. **Create API-integrated POC** to verify data flow (USER GATE)
6. **Add external integrations** (AI, etc.) if applicable
7. **Create integration POC** to verify integrations (USER GATE)
8. **Build production UI**
9. **Create complete user experience POC** (USER GATE)
10. **Add admin capabilities** if applicable
11. **Production hardening** (PWA, performance, accessibility)
12. **Authentication** (intentionally late - anonymous-first)
13. **Deployment** (USER GATE)

**Why this order?**
- Validates core assumptions before building on them
- Catches fundamental issues early (not 100 phases in)
- Each POC is a checkpoint for user verification
- UI is built on proven, stable foundations

### Phase 3: Size Phases for Agentic Development

Each phase MUST be sized for a **single agentic coding session** (~200k tokens):

| Size | Characteristics | Example |
|------|----------------|---------|
| Small | Single component, 1-2 files, minimal testing | "Add loading spinner component" |
| Medium | Feature slice, 3-5 files, unit tests | "Implement flow engine service" |
| Large | Feature area, 5-10 files, integration tests | "Build API endpoints with tests" |
| Too Large | Split required | "Build entire admin UI" → split into multiple phases |

**Phase Sizing Rules:**
- Prefer medium-sized phases (3-5 files, ~500-1000 lines of code)
- Each phase produces a deployable increment
- No phase should have dependencies that aren't complete
- Include tests within the phase (not separate "testing phases")

### Phase 4: Define User Verification Gates

Place USER GATES at critical checkpoints:

| Gate Type | When to Use | Example |
|-----------|-------------|---------|
| Core Logic POC | After building main business logic | Flow engine works with hardcoded data |
| Integration POC | After connecting layers | API-driven flow works end-to-end |
| Feature POC | After major feature set | AI generation produces valid stories |
| UX POC | After UI implementation | Complete user journey works |
| Admin POC | After admin features | Admin can configure and create content |
| Production Gate | Before launch | Everything works in production |

**Gate Requirements:**
- Specific, testable criteria
- Dedicated POC/test page when applicable
- Clear pass/fail determination
- Cannot proceed until gate passes

### Phase 5: Generate Phase Details

For each phase, generate:

```markdown
### NNN - Phase Name

**Goal**: [One sentence describing what this phase achieves]

**Scope**:
- [Bullet list of what's included]
- [Be specific about files/components]
- [Include testing scope]

**Deliverables**:
- `path/to/file.ts` - Description
- `path/to/component.tsx` - Description
- Tests for above

**Verification Gate**: [What proves this phase is complete]
- [Specific, testable criteria]
- [For USER GATES, describe what user verifies]

**Estimated Complexity**: [Low/Medium/High] (brief justification)
```

### Phase 6: Number and Name Phases

**Naming Convention**: `NNN-kebab-case-name`

- `NNN` = Three-digit number (000, 001, 002...)
- Name = Descriptive kebab-case (e.g., `flow-engine-core`, `database-schema`)

**Examples:**
- `000-project-initialization` (if starting fresh)
- `001-project-architecture-setup`
- `002-flow-engine-core`
- `003-flow-engine-poc`

**Numbering Rules:**
- Start at 000 or 001
- Sequential, no gaps
- Leave room for future insertions (can add 001a if needed)

## Output Format

Generate `ROADMAP.md` with this structure:

```markdown
# [Project Name] Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds sequentially through phases. Each phase produces a deployable increment.

**Project**: [Project Name] - [Brief Description]
**Created**: [Date]
**Status**: [Not Started | In Progress | Complete]

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 001 | Phase Name | ⬜ Not Started | Gate description |
| 002 | Phase Name | ⬜ Not Started | Gate description |
| ... | ... | ... | ... |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## [Section Name] Phases (NNN-NNN)

### NNN - Phase Name

**Goal**: ...

**Scope**: ...

**Deliverables**: ...

**Verification Gate**: ...

**Estimated Complexity**: ...

---

[Repeat for each phase]

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| Gate 1 | NNN | Description |
| ... | ... | ... |

---

## Phase Sizing Guidelines

Each phase is designed to be:
- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:
1. Cut scope to MVP for that phase
2. Create a follow-up phase for deferred items
3. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.specify "Phase NNN - [Phase Name]"
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Note completion date
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases
- Insert at appropriate position
- Renumber subsequent phases if needed
- Update phase overview table
- Consider dependencies on previous phases
```

## Clarification Questions

If project scope is unclear, ask using AskUserQuestion:

1. **Project Type**: What kind of application is this? (Web app, API, CLI, library, mobile)
2. **Core Value**: What's the main thing this app does? (The "one sentence pitch")
3. **User Types**: Who are the users? (End users, developers, admins)
4. **External Integrations**: Any AI, payment, auth, or other external services?
5. **Admin Needs**: Does this need admin/management capabilities?
6. **Deployment Target**: Where will this be deployed? (Vercel, AWS, self-hosted)

**Limit to 3 most critical questions** - make reasonable assumptions for the rest.

## Post-Generation

After generating ROADMAP.md:

1. **Write the file** to repository root

2. **Validate the structure** using CLI:
   ```bash
   speckit roadmap validate
   ```

3. **Update orchestration state** (if exists) using CLI:
   ```bash
   speckit state set "config.roadmap_path=ROADMAP.md"
   ```

4. **Update CLAUDE.md** with the new roadmap:
   ```bash
   speckit claude-md update "ROADMAP.md" "Created project roadmap with N phases"
   ```

5. **Report summary**:
   - Total phases generated
   - Number of USER GATES
   - Recommended starting point
   - Suggested commit message

## CLI Dependencies

This command uses the SpecKit CLI (`speckit`) for ROADMAP operations:

```bash
# Verify CLI is available
speckit --help
```

Key CLI commands used:
- `speckit roadmap` - ROADMAP operations (status, validate, current, next)
- `speckit state` - State management (set config path)
- `speckit claude-md` - CLAUDE.md updates (update)

## Integration with SpecKit Flow

**Where ROADMAP.md fits:**

```
/speckit.init          → Creates discovery artifacts
/speckit.init export   → Creates memory documents
/speckit.constitution  → Finalizes constitution
/speckit.roadmap       → Creates ROADMAP.md (THIS COMMAND)
/speckit.orchestrate   → Reads ROADMAP.md, executes phases
/speckit.specify       → Creates spec for current phase (from ROADMAP.md)
```

**The roadmap is THE source of truth for:**
- What to build next
- What's already done
- When to pause for user verification

## Context

$ARGUMENTS
