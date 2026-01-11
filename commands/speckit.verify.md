---
description: Verify feature completion, compliance with memory documents, checklist status, and readiness for user verification. Updates ROADMAP.md with status.
handoffs:
  - label: Start Next Feature
    agent: speckit.specify
    prompt: Create a specification for the next feature. I want to build...
  - label: Continue Orchestration
    agent: speckit.orchestrate
    prompt: Continue to the next phase
    send: true
  - label: Continue Later
    agent: speckit.start
    prompt: Resume work on this project
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). The user may specify a specific feature branch/directory to verify.

## Goal

Perform comprehensive verification of a completed feature phase to confirm:

1. All tasks are complete
2. Implementation complies with project memory documents (constitution, tech-stack, coding-standards, etc.)
3. All checklists are satisfied
4. Any deferred items are documented
5. Feature is ready for user verification gate (if applicable)

This command produces a detailed verification report and updates ROADMAP.md status.

## Execution Steps

### 1. Initialize Verification Context

Run `speckit context --json --require-tasks --include-tasks` from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS.

If the script doesn't exist or fails, manually determine feature directory:

- Check for `specs/` directory in repo root
- List available feature directories (e.g., `specs/000-*`, `specs/001-*`)
- Use user input to identify target feature, or use most recent if not specified

For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

Derive absolute paths:

- FEATURE_DIR = identified feature directory
- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md
- CHECKLISTS_DIR = FEATURE_DIR/checklists/

### 2. Task Completion Verification

Use the SpecKit CLI for task verification:

**2a. Get task completion status:**

```bash
# Get overall task status
speckit tasks status

# Get detailed status by phase
speckit tasks phase-status

# Get JSON output for parsing
speckit tasks status --json
```

The output includes:
- Completed tasks (marked `[X]` or `[x]`)
- Incomplete tasks (marked `[ ]`)
- Completion percentage

**2b. If any tasks are incomplete:**

```bash
# List incomplete tasks
speckit tasks incomplete
```

**CRITICAL**: A phase cannot be marked complete with incomplete tasks. For each incomplete task:

1. **Complete it now** - If feasible, finish the task and mark it done:
   ```bash
   speckit tasks mark T###
   ```

2. **Move to backlog** - If task should be deferred, add to ROADMAP.md backlog:
   ```bash
   speckit roadmap backlog add "[Deferred from PHASE] T###: Task description - REASON"
   ```
   Then mark the task complete with a note in tasks.md:
   ```bash
   # Edit tasks.md to mark as complete with deferral note
   # Change: - [ ] T### Description
   # To:     - [x] T### Description *(deferred to backlog)*
   ```

3. **Block verification** - If task cannot be completed or deferred, verification FAILS

**All tasks must be either completed OR explicitly deferred to backlog before verification can pass.**

### 3. Memory Document Compliance Check

Load and verify compliance with each memory document in `.specify/memory/`:

**3a. Constitution Compliance (`constitution.md`):**

- Check all MUST requirements are satisfied
- Verify no violations of core principles
- Flag any deviations that weren't documented in plan.md

**3b. Tech Stack Compliance (`tech-stack.md`):**

- Verify any code/dependencies added match approved technologies
- Check version constraints are respected
- Flag any undeclared dependencies

**3c. Coding Standards Compliance (`coding-standards.md`):**

- Verify file naming conventions followed
- Check code organization patterns
- Verify TypeScript conventions (if applicable)

**3d. API Standards Compliance (`api-standards.md`):**

- If feature includes API changes, verify response formats
- Check error handling patterns
- Verify pagination/filtering patterns (if applicable)

**3e. Security Checklist (`security-checklist.md`):**

- Run through applicable security requirements
- Flag any potential security concerns

**3f. Testing Strategy Compliance (`testing-strategy.md`):**

- Verify test coverage for critical paths
- Check test patterns followed

Produce compliance summary:

```text
| Memory Document | Status | Issues |
|-----------------|--------|--------|
| constitution.md | ✅ COMPLIANT | - |
| tech-stack.md | ✅ COMPLIANT | - |
| coding-standards.md | ⚠️ MINOR ISSUES | 2 naming deviations |
| api-standards.md | N/A | No API changes |
| security-checklist.md | ✅ COMPLIANT | - |
| testing-strategy.md | ✅ COMPLIANT | - |
```

### 4. Checklist Verification and Completion

**CRITICAL**: This step requires ACTIVELY RUNNING verification items, not just checking status.

Use the SpecKit CLI for checklist verification:

**4a. Get checklist status:**

```bash
# Get overall checklist status
speckit checklist status

# List all checklists with status
speckit checklist list

# Get JSON output for parsing
speckit checklist status --json
```

**4b. The CLI produces checklist summary with:**
- Each checklist file with completed/total counts
- Completion percentage
- Pass/Fail status indicators

**4c. For any incomplete checklist items - ACTIVELY VERIFY EACH ONE:**

```bash
# List incomplete items across all checklists
speckit checklist incomplete

# Show specific checklist details
speckit checklist show requirements.md
speckit checklist show verification.md
```

**For each incomplete item, you MUST:**

1. **Read the verification item** - Understand what needs to be tested
2. **Execute the verification** - Run commands, check code, verify behavior
3. **Mark the item complete** - Use the CLI command:
   ```bash
   # Mark item V-001 complete (auto-finds file)
   speckit checklist mark V-001

   # Or specify file explicitly
   speckit checklist mark CHK005 specs/0010-example/checklists/requirements.md
   ```
4. **Document failures** - If item cannot pass, add a note explaining why

**Verification Execution Process:**

For **verification.md** (post-implementation checks):
- These are functional tests - actually run the commands and verify they work
- Example: If item says "speckit roadmap insert creates phase 0021", RUN that command and verify
- Mark `[x]` only if the verification passes

For **requirements.md** (requirements quality checks):
- These validate requirements completeness/clarity
- Review spec.md against each item
- Mark `[x]` if the requirement is properly documented

**4d. Check for inline Verification Checklist in tasks.md:**

Some tasks.md files include an inline "Verification Checklist" section at the bottom. If present:

1. **Locate the section** - Look for `## Verification Checklist` heading in TASKS file
2. **Process each item** - Same process as checklists/verification.md:
   - Read the verification command/criteria
   - **Actually execute** the command and verify it works correctly
   - Mark complete with sed (inline items don't use standard IDs):
     ```bash
     # macOS (note the '' after -i)
     sed -i '' 's/- \[ \] `speckit roadmap insert --after 0020/- [x] `speckit roadmap insert --after 0020/' "$TASKS"

     # Linux
     sed -i 's/- \[ \] `speckit roadmap insert --after 0020/- [x] `speckit roadmap insert --after 0020/' "$TASKS"
     ```
3. **All items must pass** before proceeding

**NOTE**: The inline Verification Checklist in tasks.md contains functional tests that should be RUN, not just reviewed. For example, if an item says `speckit roadmap insert --after 0020 "Test"` creates phase 0021, you must actually RUN that command and verify it creates the expected phase.

**4e. After completing items, re-verify all checklists pass:**

```bash
speckit checklist status
```

Also manually verify the inline tasks.md Verification Checklist (if present) shows all items marked `[x]`.

All checklists should show 100% completion before proceeding.

### 5. Deferred Items Identification and Documentation

**5a. Scan for deferred/future work indicators:**

- Search spec.md Non-Goals section for explicitly deferred features
- Search tasks.md for incomplete items marked as deferred
- Search plan.md for "future", "later phase", "out of scope"
- Search spec.md for "deferred", "P3", "nice to have", "not in scope"
- Check for TODO comments in any created/modified files

**5b. For each deferred item, determine target phase:**

- If deferred to specific phase → Use that phase number
- If deferred to "later" or "future" → Assign to next logical phase or "Backlog"
- If unclear → Mark as "Backlog" for project-level tracking

**5c. Create/update deferred items file:**

If ANY deferred items are found, create `CHECKLISTS_DIR/deferred.md`:

```bash
# Check if deferred.md already exists
ls -la "$CHECKLISTS_DIR/deferred.md"
```

Load template from `.specify/templates/deferred-template.md` and populate with:
- Summary table of all deferred items
- Detailed rationale for each item
- Target phase assignments
- Prerequisites for future implementation

Write the file to `CHECKLISTS_DIR/deferred.md`.

**5d. Produce deferred items table for report:**

```text
## Deferred Items

| Item | Source | Reason | Target Phase |
|------|--------|--------|--------------|
| Dark mode support | spec.md:Non-Goals | P3 priority, not MVP | Phase 015 |
| Analytics dashboard | plan.md:L234 | Out of scope for foundation | Phase 016 |
| Multi-language support | tasks.md:T099 | Deferred to post-launch | Backlog |

**Documented in**: `specs/[phase]/checklists/deferred.md`
```

**5e. If no deferred items found:**
- State "No deferred items identified."
- Do NOT create deferred.md file

**5f. For Backlog items, also update project BACKLOG.md:**

If any items are marked "Backlog" (not assigned to a specific phase):
- Check if `BACKLOG.md` exists in repo root
- If exists, append new backlog items
- If not exists, create it using `.specify/templates/backlog-template.md`

### 6. User Verification Gate Check

Use the SpecKit CLI to check ROADMAP status:

**6a. Determine if this phase has a USER GATE:**

```bash
# Get current phase info
speckit roadmap current --json

# Check ROADMAP status
speckit roadmap status
```

From the output, check if the current phase has a "USER GATE" or "USER VERIFICATION" marker

**6b. If USER GATE exists:**

- List the specific verification criteria from ROADMAP.md
- Check if verification artifacts exist (POC pages, test pages, etc.)
- Confirm feature is ready for user testing

**6c. Produce gate readiness assessment:**

```text
## User Verification Gate Status

**Phase**: 003 - Flow Engine POC
**Gate Type**: USER VERIFICATION REQUIRED

### Verification Criteria:
- [x] User can navigate through entire flow
- [x] User can make choices at branch points
- [x] User can go back and change choices
- [x] Flow completes at terminal step
- [x] Debug panel shows correct state

### Verification Artifacts:
- POC Page: src/app/poc/flow-engine/page.tsx ✅ EXISTS
- Sample Flow: src/data/sample-flows/career-explorer.ts ✅ EXISTS

**Status**: ✅ READY FOR USER VERIFICATION
```

### 7. Update ROADMAP.md

Use the SpecKit CLI for ROADMAP updates:

**7a. Get current phase info:**

```bash
# Get current phase from ROADMAP
speckit roadmap current

# Validate ROADMAP structure
speckit roadmap validate
```

**7b. Update status using CLI:**

If all checks pass:
```bash
# Mark phase as complete
speckit roadmap update {phase_number} complete

# Update CLAUDE.md with completion info
speckit claude-md update "{phase_number}: {phase_name}" "Verified and completed"
```

**7c. If USER GATE phase:**

```bash
# Mark as awaiting user verification
speckit roadmap update {phase_number} awaiting
```

User must explicitly confirm before marking complete

**7d. Verify the update:**

```bash
speckit roadmap status
```

**7e. If deferred items exist, update NEXT phase in ROADMAP.md:**

If the phase has deferred items (deferred.md was created), update the NEXT phase's section in ROADMAP.md:

1. Identify the next phase number (current + 1)
2. Read ROADMAP.md and find the next phase's section
3. Add a "Deferred from Previous Phases" subsection after the Goal:

```markdown
**Deferred from Previous Phases** (see `specs/[CURRENT_PHASE]/checklists/deferred.md`):
- [Item 1 brief description]
- [Item 2 brief description]
- [Item 3 brief description]
```

4. If items were added to project BACKLOG.md, note this in the roadmap section:
```markdown
**Note**: Some items deferred to project Backlog - see `BACKLOG.md`
```

This ensures the next phase's spec will automatically reference inherited deferred items.

### 8. Generate Verification Report

Produce comprehensive summary report:

```markdown
# Feature Verification Report

**Feature**: [Feature Name]
**Phase**: [Phase Number]
**Verified**: [Date]
**Status**: [PASS / PASS WITH WARNINGS / FAIL]

---

## Executive Summary

[2-3 sentence summary of verification results]

---

## Task Completion

| Metric          | Value |
| --------------- | ----- |
| Total Tasks     | 53    |
| Completed       | 53    |
| Incomplete      | 0     |
| Completion Rate | 100%  |

**Status**: ✅ ALL TASKS COMPLETE

---

## Memory Document Compliance

| Document              | Status |
| --------------------- | ------ |
| constitution.md       | ✅     |
| tech-stack.md         | ✅     |
| coding-standards.md   | ✅     |
| api-standards.md      | N/A    |
| security-checklist.md | ✅     |
| testing-strategy.md   | ✅     |

**Status**: ✅ FULLY COMPLIANT

---

## Checklist Status

| Checklist       | Status   |
| --------------- | -------- |
| requirements.md | ✅ 16/16 |
| consistency.md  | ✅ 15/15 |

**Status**: ✅ ALL CHECKLISTS PASS

---

## Deferred Items

[Table of deferred items or "None identified"]

---

## User Verification Gate

[Gate status and readiness or "No USER GATE for this phase"]

---

## Issues & Recommendations

### Critical Issues (blocking)

[List or "None"]

### Warnings (non-blocking)

[List or "None"]

### Recommendations

[List of suggestions for improvement]

---

## ROADMAP.md Update

- Previous Status: ⬜ Not Started
- New Status: ✅ Complete
- [Link to updated ROADMAP.md]

---

## Next Steps

1. [If USER GATE] Request user verification of POC/test page
2. [If complete] Proceed to next phase: [Phase Name]
3. [If issues] Address listed issues before proceeding
```

### 9. Handle Failures

**If verification fails:**

- Do NOT update ROADMAP.md status to complete
- Clearly list all failing items
- Provide remediation steps for each failure
- Ask user: "Would you like me to attempt to fix the failing items?"

**If user approves fixes:**

- Attempt to complete incomplete tasks
- Update failing checklist items
- Re-run verification after fixes

## CLI Dependencies

This command uses the SpecKit CLI (`speckit`) for verification operations:

```bash
# Verify CLI is available
speckit --help
```

Key CLI commands used:
- `speckit tasks` - Task completion verification (status, incomplete, phase-status)
- `speckit checklist` - Checklist verification and completion (status, list, incomplete, show, **mark**)
- `speckit roadmap` - ROADMAP.md operations (status, current, update, validate)
- `speckit claude-md` - CLAUDE.md updates (update)
- `speckit doctor` - Diagnostics if verification finds issues

## Operating Principles

### Verification Standards

- **Be thorough**: Check everything, assume nothing
- **Be specific**: Cite exact files, line numbers, task IDs
- **Be actionable**: Every issue should have a clear remediation path
- **Be honest**: Don't mark things complete that aren't

### ROADMAP.md Integrity

- **Only mark complete** if ALL verification checks pass
- **USER GATE phases** require explicit user confirmation before final completion
- **Preserve history**: Add dates/notes, don't just change status symbols

### Context Efficiency

- Load only necessary sections of large files
- Aggregate similar issues rather than listing each individually
- Focus on actionable findings, not exhaustive documentation

## Context

$ARGUMENTS
