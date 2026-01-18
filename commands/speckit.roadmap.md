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
  - label: Add PDRs to Roadmap
    agent: speckit.roadmap
    prompt: add-pdr
---

## User Input

```text
$ARGUMENTS
```

## Argument Routing

**IMPORTANT**: Check the user input and route to the appropriate action:

| Argument | Action |
|----------|--------|
| (empty) | Run full roadmap generation flow → [Goal](#goal) |
| `add-pdr` | List PDRs and convert to phases → [Add PDR Subcommand](#add-pdr-subcommand) |
| `add-pdr pdr-name.md` | Convert specific PDR to phase → [Add PDR Subcommand](#add-pdr-subcommand) |
| `add-pdr --all` | Convert all approved PDRs → [Add PDR Subcommand](#add-pdr-subcommand) |
| `backlog` | Scan and triage backlog items → [Backlog Subcommand](#backlog-subcommand) |
| `backlog --auto` | Auto-assign high-confidence matches → [Backlog Subcommand](#backlog-subcommand) |
| `backlog --dry-run` | Preview assignments without changes → [Backlog Subcommand](#backlog-subcommand) |
| Other text | Use as project description, generate roadmap → [Goal](#goal) |

---

You **MUST** consider the user input before proceeding (if not empty). The user may provide:
- A project description or vision
- Specific phases they want included
- Number of phases to generate
- Phase sizing preferences
- **`add-pdr`** subcommand to convert PDRs to phases

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

For each phase, create a file in `.specify/phases/`:

**File**: `.specify/phases/NNNN-phase-name.md`

```markdown
---
phase: NNNN
name: phase-name
status: not_started
created: YYYY-MM-DD
---

### NNNN - Phase Name

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

Use the CLI to create phase files:
```bash
speckit phase create 0010 "phase-name"
```

### Phase 6: Number and Name Phases

**Naming Convention**: `NNNN-kebab-case-name` (ABBC format)

- `NNNN` = Four-digit ABBC number
  - **A** = Milestone (0-9)
  - **BB** = Phase within milestone (01-99)
  - **C** = Hotfix slot (0 = main, 1-9 = hotfixes)
- Name = Descriptive kebab-case (e.g., `flow-engine-core`, `database-schema`)

**Examples:**
- `0010` - Milestone 0, Phase 01, main
- `0020` - Milestone 0, Phase 02, main
- `0021` - Hotfix inserted after Phase 02
- `1010` - Milestone 1, Phase 01, main

**Numbering Rules:**
- Start at 0010
- Increment by 10 (0010, 0020, 0030...)
- Use hotfix slots for insertions (0021, 0022 after 0020)

## Output Format

Generate `ROADMAP.md` (lightweight index) AND phase files in `.specify/phases/`:

### ROADMAP.md Structure

```markdown
# [Project Name] Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds sequentially through phases. Each phase produces a deployable increment.

**Project**: [Project Name] - [Brief Description]
**Created**: [Date]
**Schema Version**: 2.1 (ABBC numbering, modular phases)
**Status**: [Not Started | In Progress | Complete]

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | phase-name | ⬜ Not Started | Gate description |
| 0020 | phase-name | ⬜ Not Started | Gate description |
| 0030 | **user-gate-poc** | ⬜ Not Started | **USER GATE**: Description |
| ... | ... | ... | ... |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Phase Details

Phase details are stored in modular files:

| Location | Content |
|----------|---------|
| `.specify/phases/*.md` | Active/pending phase details |
| `.specify/history/HISTORY.md` | Archived completed phases |

To view a specific phase:
```bash
speckit phase show 0010
```

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| Gate 1 | 0030 | Description |
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
2. Document deferred items in `specs/[phase]/checklists/deferred.md`
3. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.design
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Archive phase: `speckit phase archive NNNN`
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases
```bash
speckit roadmap insert --after 0020 "New Phase Name"
speckit phase create 0025 "new-phase"
```
```

### Phase Files

For each phase, also create `.specify/phases/NNNN-phase-name.md` with full details (see Phase 5 above).

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
/speckit.init          → Creates discovery artifacts, constitution, memory docs, and ROADMAP
/speckit.roadmap       → Creates/updates ROADMAP.md (THIS COMMAND)
/speckit.roadmap add-pdr → Converts PDRs to ROADMAP phases
/speckit.roadmap backlog → Triages backlog items into phases
/speckit.orchestrate   → Reads ROADMAP.md, executes phases
/speckit.design        → Creates spec, plan, tasks for current phase
```

**The roadmap is THE source of truth for:**
- What to build next
- What's already done
- When to pause for user verification

---

## Add PDR Subcommand

When invoked with `add-pdr`, this command converts PDRs (Product Design Requirements) into ROADMAP phases.

### Usage

```
/speckit.roadmap add-pdr                    # List available PDRs
/speckit.roadmap add-pdr pdr-feature.md     # Convert specific PDR
/speckit.roadmap add-pdr pdr-a.md pdr-b.md  # Convert multiple PDRs
/speckit.roadmap add-pdr --all              # Convert all approved PDRs
```

### Pre-Execution: Load PDR Context

#### 1. List Available PDRs

Use the CLI to discover PDRs:

```bash
# List all PDRs with status
speckit pdr list --json

# Show specific PDR details
speckit pdr show <filename>
```

#### 2. Check Existing ROADMAP

```bash
# Get roadmap status
speckit roadmap status --json

# Get next phase number
speckit roadmap next --json
```

#### 3. Load Memory Documents (for context)

```bash
CONSTITUTION=".specify/memory/constitution.md"
TECH_STACK=".specify/memory/tech-stack.md"
```

### PDR Selection

#### If User Specifies PDRs

Parse user input for:
- Specific filenames: `pdr-offline-mode.md pdr-sync-status.md`
- Glob patterns: `pdr-auth-*.md`
- `--all`: Create phases for all PDRs with status "Approved"

#### If No PDRs Specified

Use AskUserQuestion to present options:

1. **List approved PDRs** - Show PDRs with status "Approved" or "Ready"
2. **Let user select** - Multi-select from available PDRs
3. **Ask for clarification** - If no suitable PDRs exist

```
Question: Which PDRs should be included in this phase?
Options:
  - pdr-offline-mode.md (Approved, P1, 3 stories)
  - pdr-sync-status.md (Ready, P2, 2 stories)
  - pdr-notifications.md (Draft, P2, 4 stories)
```

### Phase Generation from PDRs

#### Step 1: Read and Analyze PDRs

For each selected PDR, extract:

| Field | Source | Use |
|-------|--------|-----|
| Title | `# PDR: [Title]` | Phase name |
| Problem | `## Problem Statement` | Phase goal context |
| Outcomes | `## Desired Outcome` | Deliverables |
| Stories | `## User Stories` | Scope items |
| Success Criteria | `## Success Criteria` | Verification gate |
| Constraints | `## Constraints` | Phase boundaries |
| Non-Goals | `## Non-Goals` | Explicit exclusions |
| Acceptance | `## Acceptance Criteria` | Gate requirements |

#### Step 2: Determine Phase Strategy

**Single PDR → Single Phase**
- Map PDR directly to one phase
- Use PDR title as phase name
- Stories become scope items

**Multiple PDRs → Decision Required**

Use AskUserQuestion:

```
Question: How should these PDRs be organized into phases?
Options:
  - One phase per PDR (3 phases)
  - Combine into single phase
  - Group by priority (P1 together, P2 together)
  - Let me decide the grouping
```

#### Step 3: Calculate Phase Number

```bash
# Get next available phase number
speckit roadmap next --json
```

Use ABBC numbering (4-digit):
- If roadmap is empty: start at `0010`
- Otherwise: next available in sequence

For multiple phases:
- Sequential: `0020`, `0030`, `0040`
- Or insert after specific phase: `speckit roadmap insert --after 0020`

#### Step 4: Synthesize Phase Content

For each phase, generate:

```markdown
### NNNN - [Phase Name from PDR Title]

**Goal**: [Synthesized from Problem Statement + Desired Outcome]

**Source PDRs**:
- `pdr-[name].md` - [PDR Title]

**Scope**:
<!-- Derived from User Stories -->
- [Story 1 title: key deliverable]
- [Story 2 title: key deliverable]
- [Story 3 title: key deliverable]

**Deliverables**:
<!-- To be determined during /speckit.design -->
- TBD based on technical design

**Constraints** (from PDR):
- [Must/Should/Must Not constraints]

**Non-Goals** (from PDR):
- [Explicit exclusions]

**Verification Gate**:
<!-- Derived from Success Criteria + Acceptance Criteria -->
- [Measurable criterion 1]
- [Measurable criterion 2]
- **USER VERIFICATION**: [User-observable test from acceptance criteria]

**Estimated Complexity**: [Low/Medium/High based on story count and scope]
```

#### Step 5: Determine Phase Dependencies

If creating multiple phases:

1. Check PDR `## Related PDRs` for explicit dependencies
2. Look for references between PDRs (`pdr-[name]`)
3. Order phases by:
   - Explicit dependencies (blocking → dependent)
   - Priority (P1 before P2 before P3)
   - Story count (smaller first for quick wins)

#### Step 6: Update ROADMAP.md

**If ROADMAP.md Exists**

Insert new phases using CLI:

```bash
# For each new phase
speckit roadmap insert --after NNNN "Phase Name" --non-interactive
```

Or edit ROADMAP.md directly to:
1. Add row to Phase Overview table
2. Add phase section with full details
3. Update Verification Gates Summary if USER GATE

**If ROADMAP.md Doesn't Exist**

Create new ROADMAP.md with:
1. Standard header from template
2. Phase Overview table
3. Generated phase sections
4. Verification Gates Summary
5. Standard footer

#### Step 7: Mark PDRs as Processed

After adding to ROADMAP, mark each PDR as processed using the CLI:

```bash
# For each PDR that was turned into a phase
speckit pdr mark pdr-<name>.md
```

This renames the file with a `_` prefix (e.g., `pdr-offline-mode.md` → `_pdr-offline-mode.md`) to indicate it has been processed into a phase.

**Why?** This makes it easy to see which PDRs are still waiting to become phases:
- `speckit pdr list` shows only unprocessed PDRs
- `speckit pdr list --all` shows all PDRs including processed ones

Optionally, also update the PDR file status:
- Change `**Status**: Approved` → `**Status**: Implemented`
- Add note: `**Phase**: NNNN - [Phase Name]`

### Add PDR Output Format

After generation, report:

```
Created N phase(s) from M PDR(s):

  0020 - Offline Mode Support
         Source: pdr-offline-mode.md
         Stories: 3 | Complexity: Medium
         Gate: USER VERIFICATION

  0030 - Sync Status Indicators
         Source: pdr-sync-status.md
         Stories: 2 | Complexity: Low
         Gate: Automated

PDRs marked as processed:
  speckit pdr mark pdr-offline-mode.md  ✓
  speckit pdr mark pdr-sync-status.md   ✓

Next steps:
  1. Review ROADMAP.md for accuracy
  2. Run /speckit.orchestrate to begin development
  3. Or run /speckit.design to create detailed spec for first phase

Suggested commit:
  feat(roadmap): add phases 0020, 0030 from PDRs
```

### Add PDR Edge Cases

#### No Approved PDRs

```
No PDRs with status 'Approved' or 'Ready' found.

Available PDRs:
  - pdr-feature.md (Draft) - needs completion

To approve a PDR:
  1. Complete all required sections
  2. Run: speckit pdr validate pdr-feature.md
  3. Update status to 'Approved' in the file

Or create a new PDR:
  cp templates/pdr-template.md .specify/memory/pdrs/pdr-my-feature.md
```

#### PDR Validation Fails

```bash
# Validate before using
speckit pdr validate <filename>
```

If validation fails:
- Report missing sections
- Suggest fixes
- Do not create phase from invalid PDR

#### Conflicting PDRs

If selected PDRs have conflicting constraints or goals:
- Flag the conflict
- Ask user to resolve
- Or create separate phases

#### ROADMAP Conflicts

If phase number conflicts or insert fails:
- Use next available number
- Report the adjustment
- Never overwrite existing phases

### Add PDR CLI Dependencies

```bash
# PDR operations
speckit pdr list --json
speckit pdr show <file>
speckit pdr validate <file>
speckit pdr mark <file>      # Mark PDR as processed after phase creation

# Roadmap operations
speckit roadmap status --json
speckit roadmap next --json
speckit roadmap insert --after <phase> "<name>"
speckit roadmap validate
```

---

## Backlog Subcommand

When invoked with `backlog`, this command scans completed phases for orphaned tasks and triages backlog items into appropriate phases.

### Usage

```
/speckit.roadmap backlog                    # Interactive triage on all backlog items
/speckit.roadmap backlog --auto             # Auto-assign high-confidence matches
/speckit.roadmap backlog --dry-run          # Preview assignments without changes
```

### Goal

Ensure no work is lost by scanning completed phases and triaging backlog items:

1. **Scan for orphaned tasks** - Find incomplete tasks in completed phases
2. **Parse backlog items** - Read backlog section from ROADMAP.md
3. **Analyze phases** - Extract Goal and Scope from each phase
4. **Match items to phases** - Score relevance by keywords and alignment
5. **Propose assignments** - Present matches with confidence scores
6. **Update ROADMAP** - Apply assignments and clear processed items

### Execution Steps

#### Step 1: Scan Completed Phases for Orphaned Tasks

**IMPORTANT**: Before triaging existing backlog items, scan previously completed phases for any incomplete tasks left behind.

```bash
# Get all completed phases from ROADMAP
speckit roadmap status --json | jq -r '.phases[] | select(.status == "complete") | .number'
```

For each completed phase, check for incomplete tasks:

```bash
for phase_dir in specs/*/; do
  phase_name=$(basename "$phase_dir")
  tasks_file="$phase_dir/tasks.md"

  if [[ -f "$tasks_file" ]]; then
    incomplete=$(grep -E '^\s*-\s*\[ \]\s*T[0-9]+' "$tasks_file" || true)
    if [[ -n "$incomplete" ]]; then
      echo "Found orphaned incomplete tasks in $phase_name"
    fi
  fi
done
```

For each orphaned task found:
1. Add to backlog: `speckit roadmap backlog add "[Orphaned from NNNN] T###: Task description"`
2. Mark original as deferred: `- [x] T### ... *(deferred to backlog)*`

#### Step 2: Parse Backlog Items

```bash
BACKLOG_JSON=$(speckit roadmap backlog list --json)
ITEM_COUNT=$(echo "$BACKLOG_JSON" | jq '.count')

if [[ "$ITEM_COUNT" -eq 0 ]]; then
  echo "No items in backlog to triage"
  exit 0
fi
```

#### Step 3: Extract Phase Scopes

For each phase in ROADMAP, read phase file to get:
- Goal (one sentence)
- Scope keywords

```text
phases = [
  {
    "number": "0020",
    "name": "Onboarding Polish",
    "goal": "Make the first-run experience smooth",
    "scope_keywords": ["templates", "scaffold", "CLI", "output"]
  },
  ...
]
```

#### Step 4: Match Items to Phases

For each backlog item, calculate match score:

| Score Component | Weight | Description |
|----------------|--------|-------------|
| Keyword match | 0.3 per keyword | Item contains phase scope keyword |
| Goal alignment | 0.2 | Item description aligns with phase goal |
| Domain match | 0.2 | Item category matches phase category |

Confidence levels:
| Score | Confidence | Action |
|-------|------------|--------|
| 0.7+ | High | Auto-assign (with --auto) |
| 0.4-0.7 | Medium | Show suggestion, ask user |
| 0.1-0.4 | Low | Show suggestion, likely new phase |
| <0.1 | None | Propose new phase |

#### Step 5: Present Assignments

```text
============================================
Backlog Triage Results
============================================

Item: "Add dark mode support"
  Best match: 0020 - Onboarding Polish (confidence: 0.65)
  Matched keywords: UI, user experience

  Options:
  A. Assign to 0020 - Onboarding Polish (Recommended)
  B. Assign to different phase
  C. Create new phase
  D. Skip (keep in backlog)
```

Use `AskUserQuestion` for each item.

#### Step 6: Update ROADMAP

For assigned items, add to phase scope:
```markdown
**Scope**:
- Existing scope item 1
- Add dark mode support  ← NEW (from backlog)
```

For new phases:
```bash
speckit roadmap insert --after "$LAST_PHASE" "$NEW_PHASE_NAME" --non-interactive
```

Clear assigned items from backlog.

### --auto Mode

In `--auto` mode:
- Auto-assign all high-confidence (0.7+) matches
- Prompt only for medium/low confidence
- Skip items with no good match (keep in backlog)

### --dry-run Mode

In `--dry-run` mode:
- Show all proposed assignments
- Show what ROADMAP changes would be made
- Don't actually modify any files

```text
DRY RUN - Proposed Changes:

Would assign:
  "Add dark mode support" → 0020 Onboarding Polish

Would create new phase:
  0051 - Integration Features (after 0050)
    Items: "Implement webhook integration"

Would remain in backlog:
  "Parallel phase execution"

No changes made.
```

### Summary Output

```text
============================================
Triage Complete
============================================

Assigned to existing phases:
  • "Add dark mode support" → 0020 Onboarding Polish
  • "Improve error messages" → 0020 Onboarding Polish

New phases created:
  • 0051 - Integration Features
    - Implement webhook integration
    - Add API rate limiting

Remaining in backlog:
  • "Parallel phase execution" (user skipped)

Run /speckit.orchestrate to continue development
```

### Error Handling

| Error | Response |
|-------|----------|
| Empty backlog | "No items to triage" and exit |
| ROADMAP parse error | Show line number, suggest manual fix |
| Phase insert fails | Show error, keep item in backlog |
| No phases defined | "Create phases first with /speckit.roadmap" |

---

## Context

$ARGUMENTS
