---
description: Create all design artifacts (discovery, spec, plan, tasks, checklists) in one command with inline clarifications.
handoffs:
  - label: Analyze Artifacts
    agent: speckit.analyze
    prompt: Run consistency analysis on all artifacts
    send: true
  - label: Continue Development
    agent: speckit.orchestrate
    prompt: Resume development workflow
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Arguments

| Flag | Effect |
|------|--------|
| (none) | Full flow: discover → spec → plan → tasks → checklists |
| `--spec` | Cascade from spec: spec → plan → tasks → checklists |
| `--plan` | Cascade from plan: plan → tasks → checklists |
| `--tasks` | Cascade from tasks: tasks → checklists |
| `--checklist` | Regenerate only checklists |

## Goal

Produce all design artifacts for the current phase in one command:
- `discovery.md` - Codebase examination and clarified user intent
- `spec.md` - Feature specification with requirements
- `requirements.md` - Requirements checklist
- `plan.md` - Technical implementation plan
- `tasks.md` - Actionable task list
- `checklists/implementation.md` - Implementation guidance checklist
- `checklists/verification.md` - Verification checklist for completion

## Execution Flow

### 0. Setup & Cascade Detection

**0a. Parse cascade flags:**
```bash
# Determine starting phase based on flags
if [[ "$ARGUMENTS" == *"--checklist"* ]]; then
  START_PHASE="checklists"
elif [[ "$ARGUMENTS" == *"--tasks"* ]]; then
  START_PHASE="tasks"
elif [[ "$ARGUMENTS" == *"--plan"* ]]; then
  START_PHASE="plan"
elif [[ "$ARGUMENTS" == *"--spec"* ]]; then
  START_PHASE="spec"
else
  START_PHASE="discover"
fi
```

**0b. Get context:**
```bash
speckit context --json
```
Parse: FEATURE_DIR, PHASE_NUMBER, BRANCH_NAME, SPEC_FILE

**0c. Update state:**
```bash
speckit state set "orchestration.step.current=design" "orchestration.step.status=in_progress"
```

**0d. Check for resumable state:**
```bash
# Read substep from state if exists
SUBSTEP=$(speckit state get orchestration.design.substep 2>/dev/null || echo "discover")
```

If resuming and no cascade flag specified, continue from saved substep. However, per FR-008a, **DISCOVER always re-runs** on resume (codebase examination and clarifying questions).

---

### 1. DISCOVER Phase

**Skip if**: `START_PHASE` is not "discover" (cascade flag used)

**1a. Load phase context:**
```bash
speckit phase show {PHASE_NUMBER}    # Get Goal, Scope, Deliverables from phase file
```

**1b. Examine codebase:**
1. Search for files, functions, and patterns related to this change
2. Look for existing implementations in the same area
3. Identify dependencies and integration points
4. Note patterns and conventions already established

**1c. Read memory documents:**
```bash
cat .specify/memory/constitution.md   # Required
cat .specify/memory/tech-stack.md     # If exists
cat .specify/memory/coding-standards.md  # If exists
```

**1d. Progressive clarifying questions:**

Ask up to 5 rounds of 1-2 questions each to understand user intent:

For each question, use `AskUserQuestion`:
- **Always provide context**: What you found, why it matters, pros/cons
- **Recommend an option**: Mark with "(Recommended)"
- **Format**:
  ```
  Header: "[Topic]"
  Question: "[Specific question based on codebase examination]"
  Options:
    - Label: "[Option A] (Recommended)"
      Description: "Aligns with existing pattern in [file]. Pros: X. Cons: Y."
    - Label: "[Option B]"
      Description: "Would require changes to [file]. Pros: X. Cons: Y."
  ```

Between question rounds:
- Research based on answers (examine new code areas, web search if needed)
- Update understanding
- Ask follow-ups only if new areas emerge

**1e. Document findings:**
Create `{FEATURE_DIR}/discovery.md`:
```markdown
# Discovery: {PHASE_NAME}

**Date**: {TODAY}
**Phase**: {PHASE_NUMBER}

## Codebase Examination

### Relevant Code Locations
- [List files/functions found]

### Existing Patterns
- [List patterns discovered]

### Integration Points
- [List dependencies]

## Clarified Understanding

### User Intent
[Summary of what user wants based on Q&A]

### Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| ... | ... | ... |

### Constraints Discovered
- [List constraints from codebase/discussion]
```

**1f. Verify understanding:**
Summarize understanding and ask user to confirm: "Does this accurately capture your intent?"
- If yes → proceed to SPECIFY
- If no → ask what was misunderstood, update discovery.md

**1g. Update substep:**
```bash
speckit state set "orchestration.design.substep=specify"
```

---

### 2. SPECIFY Phase

**Skip if**: `START_PHASE` is "plan", "tasks", or "checklists"

**2a. Load context:**
- Read `discovery.md` if exists (for confirmed understanding)
- Load `.specify/templates/spec-template.md`
- Get phase Goal/Scope from `speckit phase show {PHASE_NUMBER}`

**2b. Check for deferred items:**
```bash
ls .specify/phases/*-handoff.md 2>/dev/null   # Handoff files from previous phases
grep -l "Deferred" specs/*/tasks.md 2>/dev/null  # Deferred sections
```

If handoff files found:
- Display prominent notice about inherited requirements
- Ask user which items to include (A: all, B: select, C: defer)
- Add confirmed items to spec under "## Inherited Requirements"

**2c. Generate spec:**

Parse phase file and discovery findings. For each unclear aspect:
- Make informed guesses based on context
- Only use `[NEEDS CLARIFICATION: question]` if:
  - Significantly impacts scope or UX
  - Multiple reasonable interpretations exist
  - No reasonable default exists
- **LIMIT: Maximum 3 markers**

Write `{FEATURE_DIR}/spec.md` with template structure.

**2d. Create requirements checklist:**
Write `{FEATURE_DIR}/requirements.md` validating spec quality.

**2e. Handle inline clarifications:**

If `[NEEDS CLARIFICATION]` markers exist (max 3):
1. Extract all markers
2. Present each as a question with options table:

```markdown
## Question [N]: [Topic]

**Context**: [Quote relevant spec section]
**What we need**: [Specific question]

| Option | Answer | Implications |
|--------|--------|--------------|
| A | [First suggested] | [What this means] |
| B | [Second suggested] | [What this means] |
| C | [Third suggested] | [What this means] |

**Recommended**: Option [X] - [reasoning]
```

3. Wait for user response
4. Update spec, removing markers

**2f. Validate spec quality:**
Check against requirements.md checklist. Fix issues (max 3 iterations).

**2g. Update substep:**
```bash
speckit state set "orchestration.design.substep=plan"
```

---

### 3. PLAN Phase

**Skip if**: `START_PHASE` is "tasks" or "checklists"

**3a. Load context:**
- Read spec.md, discovery.md, requirements.md
- Load constitution.md (required)
- Load `.specify/templates/plan-template.md`

**3b. Constitution check:**
Verify planned approach doesn't violate principles. If violations:
- Block on principle violations
- Warn on guideline violations

**3c. Fill technical context:**
- Language/Version
- Dependencies
- Storage
- Testing
- Constraints

Mark unknowns as "NEEDS RESEARCH".

**3d. Generate research.md (if unknowns exist):**
For each unknown:
- Research using web search or codebase examination
- Document decision, rationale, alternatives considered

**3e. Generate optional artifacts:**
- `data-model.md` if data entities involved
- `contracts/` if API endpoints involved

**3f. Write plan.md:**
Use template structure with filled context.

**3g. Update substep:**
```bash
speckit state set "orchestration.design.substep=tasks"
```

---

### 4. TASKS Phase

**Skip if**: `START_PHASE` is "checklists"

**4a. Load context:**
- Read plan.md (required)
- Read spec.md (for user story priorities)
- Read data-model.md, contracts/ (if exist)

**4b. Generate tasks:**

Organize by user story from spec.md:
- **Phase 1**: Setup (project initialization)
- **Phase 2**: Foundational (blocking prerequisites)
- **Phase 3+**: One phase per user story (priority order)
- **Final**: Polish & cross-cutting

**Task format** (REQUIRED):
```
- [ ] T### [P?] [US?] Description with file path
```

Components:
1. Checkbox: `- [ ]`
2. Task ID: Sequential (T001, T002...)
3. `[P]`: Only if parallelizable
4. `[US#]`: Only for user story phase tasks
5. Description with file path

**4c. Generate dependency graph:**
Show user story completion order.

**4d. Validate:**
- Every task has ID, description, file path
- User story tasks have `[US#]` label
- Dependencies are clear

**4e. Write tasks.md:**
Use template structure with Progress Dashboard.

**4f. Update substep:**
```bash
speckit state set "orchestration.design.substep=checklists"
```

---

### 5. CHECKLISTS Phase

**5a. Load context:**
- Read spec.md, plan.md, tasks.md
- Understand feature domain

**5b. Create checklists directory:**
```bash
mkdir -p {FEATURE_DIR}/checklists
```

**5c. Generate implementation.md:**

Create checklist testing REQUIREMENTS QUALITY for implementation guidance.

Focus areas:
- **Requirement Completeness**: Are all necessary requirements present?
- **Requirement Clarity**: Are requirements specific and unambiguous?
- **Scenario Coverage**: Are all flows/cases addressed?
- **Edge Case Coverage**: Are boundary conditions defined?

Item format:
```
- [ ] CHK### - Are [requirement type] defined for [scenario]? [Quality Dimension, Spec §X.Y]
```

**5d. Generate verification.md:**

Create checklist for post-implementation verification.

Focus areas:
- **Acceptance Criteria Quality**: Are success criteria measurable?
- **Non-Functional Requirements**: Performance, security, accessibility specified?
- **Dependencies & Assumptions**: Documented and validated?

Item format:
```
- [ ] CHK### - Is [requirement] quantified with specific criteria? [Quality Dimension]
```

**5e. Update substep:**
```bash
speckit state set "orchestration.design.substep=complete"
```

---

### 6. Completion

**6a. Update state:**
```bash
speckit state set "orchestration.step.status=complete"
speckit state set "orchestration.design.substep=complete"
```

**6b. Report completion:**

```
Design artifacts created:
├── discovery.md     - Codebase findings and decisions
├── spec.md          - Feature specification
├── requirements.md  - Requirements checklist
├── plan.md          - Technical implementation plan
├── tasks.md         - X tasks across Y user stories
└── checklists/
    ├── implementation.md - Implementation guidance
    └── verification.md   - Verification checklist

Next: Run /speckit.analyze or /speckit.orchestrate
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No phase context | "Run from feature branch or specify phase number" |
| Missing templates | Run `speckit templates sync` |
| Constitution violation | Block and report specific violation |
| Spec validation fails after 3 iterations | Report remaining issues, ask user to fix |

**On any error:**
```bash
speckit state set "orchestration.step.status=failed"
```

---

## Three-Line Output Rule (Constitution VII)

During execution, keep status updates brief:
```
DISCOVER: Examining codebase...
DISCOVER: Found 3 integration points, asking 2 clarifying questions
SPECIFY: Creating spec.md with 5 user stories...
```

Only show detailed output when:
- Asking clarification questions (full context needed)
- Reporting completion (summary table)
- Errors (full details for debugging)

---

## Resumability (FR-008)

Design command is resumable if interrupted:
1. State tracks current substep
2. **DISCOVER always re-runs** on resume (FR-008a) to ensure fresh codebase context
3. Completed artifacts are preserved unless cascade flag regenerates them

Resume logic:
```
if resuming:
  if substep == "specify" and no --spec flag:
    # Re-run discover per FR-008a, then continue from specify
    START_PHASE = "discover"
  else:
    # Continue from saved substep
    START_PHASE = substep
```

---

## Context

$ARGUMENTS
