---
description: Create ROADMAP.md phase(s) from one or more PDRs (Product Design Requirements).
handoffs:
  - label: Start Specification
    agent: speckit.specify
    prompt: Create a specification for the newly created phase
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

## Goal

Create one or more phases in `ROADMAP.md` from approved PDRs in `.specify/memory/pdrs/`.

This command synthesizes non-technical requirements (PDRs) into implementation-ready phases that can be executed by `/speckit.orchestrate`.

## Pre-Execution: Load Context

### 1. List Available PDRs

Use the CLI to discover PDRs:

```bash
# List all PDRs with status
speckit pdr list --json

# Show specific PDR details
speckit pdr show <filename>
```

### 2. Check Existing ROADMAP

```bash
# Get roadmap status
speckit roadmap status --json

# Get next phase number
speckit roadmap next --json
```

### 3. Load Memory Documents

Read these if they exist (for context):

```bash
CONSTITUTION=".specify/memory/constitution.md"
TECH_STACK=".specify/memory/tech-stack.md"
```

## PDR Selection

### If User Specifies PDRs

Parse user input for:
- Specific filenames: `pdr-offline-mode.md pdr-sync-status.md`
- Glob patterns: `pdr-auth-*.md`
- "All approved": Create phases for all PDRs with status "Approved"

### If No PDRs Specified

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

## Phase Generation Workflow

### Step 1: Read and Analyze PDRs

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

### Step 2: Determine Phase Strategy

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

### Step 3: Calculate Phase Number

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

### Step 4: Synthesize Phase Content

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
<!-- To be determined during /speckit.specify -->
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

### Step 5: Determine Phase Dependencies

If creating multiple phases:

1. Check PDR `## Related PDRs` for explicit dependencies
2. Look for references between PDRs (`pdr-[name]`)
3. Order phases by:
   - Explicit dependencies (blocking → dependent)
   - Priority (P1 before P2 before P3)
   - Story count (smaller first for quick wins)

### Step 6: Update ROADMAP.md

#### If ROADMAP.md Exists

Insert new phases using CLI:

```bash
# For each new phase
speckit roadmap insert --after NNNN "Phase Name" --non-interactive
```

Or edit ROADMAP.md directly to:
1. Add row to Phase Overview table
2. Add phase section with full details
3. Update Verification Gates Summary if USER GATE

#### If ROADMAP.md Doesn't Exist

Create new ROADMAP.md with:
1. Standard header from template
2. Phase Overview table
3. Generated phase sections
4. Verification Gates Summary
5. Standard footer

Use template at `templates/roadmap-template.md` as base.

### Step 7: Update PDR Status

After adding to ROADMAP, mark PDRs as used:

Edit each PDR file:
- Change `**Status**: Approved` → `**Status**: Implemented`
- Or add note: `**Phase**: NNNN - [Phase Name]`

## Output Format

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

Next steps:
  1. Review ROADMAP.md for accuracy
  2. Run /speckit.specify to create detailed spec for first phase
  3. Or run /speckit.orchestrate to begin development

Suggested commit:
  feat(roadmap): add phases 0020, 0030 from PDRs
```

## Edge Cases

### No Approved PDRs

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

### PDR Validation Fails

```bash
# Validate before using
speckit pdr validate <filename>
```

If validation fails:
- Report missing sections
- Suggest fixes
- Do not create phase from invalid PDR

### Conflicting PDRs

If selected PDRs have conflicting constraints or goals:
- Flag the conflict
- Ask user to resolve
- Or create separate phases

### ROADMAP Conflicts

If phase number conflicts or insert fails:
- Use next available number
- Report the adjustment
- Never overwrite existing phases

## CLI Dependencies

This command uses:

```bash
# PDR operations
speckit pdr list --json
speckit pdr show <file>
speckit pdr validate <file>

# Roadmap operations
speckit roadmap status --json
speckit roadmap next --json
speckit roadmap insert --after <phase> "<name>"
speckit roadmap validate
```

## Integration with SpecKit Flow

```
[PDR Creation]     → User/Agent writes PDRs
[PDR Approval]     → User marks as Approved
/speckit.phase     → THIS COMMAND: PDRs → ROADMAP phases
/speckit.specify   → Phase → Detailed spec
/speckit.plan      → Spec → Implementation plan
/speckit.tasks     → Plan → Actionable tasks
/speckit.implement → Tasks → Working code
/speckit.verify    → Code → Verified feature
```

## Context

$ARGUMENTS
