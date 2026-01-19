---
description: Create all design artifacts (discovery, spec, plan, tasks, checklists) in one command with inline clarifications.
handoffs:
  - label: Analyze Artifacts
    agent: specflow.analyze
    prompt: Run consistency analysis on all artifacts
    send: true
  - label: Continue Development
    agent: specflow.orchestrate
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

Produce all design artifacts for the current phase:

| Artifact | Purpose |
|----------|---------|
| `discovery.md` | Codebase examination and clarified user intent |
| `spec.md` | Feature specification with requirements |
| `requirements.md` | Requirements quality checklist |
| `ui-design.md` | Visual mockups and rationale (if UI phase) |
| `plan.md` | Technical implementation plan |
| `tasks.md` | Actionable task list |
| `checklists/implementation.md` | Implementation guidance |
| `checklists/verification.md` | Verification checklist |

---

## Execution Flow

### 0. Setup

**Create todo list immediately (use TodoWrite):**

1. [DESIGN] SETUP - Get project context
2. [DESIGN] DISCOVER - Examine codebase and clarify intent
3. [DESIGN] SPECIFY - Create feature specification
4. [DESIGN] PLAN - Technical implementation plan
5. [DESIGN] TASKS - Generate task list
6. [DESIGN] CHECKLISTS - Create verification checklists

Set [DESIGN] SETUP to in_progress, then proceed.

**Get project context:**
```bash
specflow status --json
```

Parse: `phase.number`, `phase.dir`, `branch`, `artifacts` (to check what exists).

**Determine starting phase** from cascade flags or artifact existence:
- If `--checklist` → start at CHECKLISTS
- If `--tasks` → start at TASKS
- If `--plan` → start at PLAN
- If `--spec` → start at SPECIFY
- Otherwise, check existing artifacts to auto-resume:
  - `tasks.md` exists, no `checklists/` → start at CHECKLISTS
  - `plan.md` exists, no `tasks.md` → start at TASKS
  - `spec.md` exists, no `plan.md` → start at PLAN
  - `discovery.md` exists, no `spec.md` → start at SPECIFY
  - Otherwise → start at DISCOVER

**Update state:**
```bash
specflow state set "orchestration.step.current=design" "orchestration.step.status=in_progress"
```

Use TodoWrite: mark [DESIGN] SETUP complete. As you complete each phase, mark it complete and mark the next in_progress (e.g., mark [DESIGN] DISCOVER complete, mark [DESIGN] SPECIFY in_progress).

---

### 1. DISCOVER Phase

**Skip if**: Starting from spec, plan, tasks, or checklists.

**1a. Load phase context:**
```bash
specflow phase
```

**1b. Examine codebase:**
- Search for files, functions, and patterns related to this change
- Look for existing implementations in the same area
- Identify dependencies and integration points
- Note patterns and conventions already established

**1c. Read memory documents:**
Read from `.specify/memory/`:
- `constitution.md` (required)
- `tech-stack.md` (if exists)
- `coding-standards.md` (if exists)

**1d. Progressive clarifying questions:**

Ask up to 5 rounds of 1-2 questions each to understand user intent.

For each question, use `AskUserQuestion`:
- **Always provide context**: What you found, why it matters, pros/cons
- **Recommend an option**: Mark first option with "(Recommended)"
- Include what you discovered in codebase that informed the question

Between question rounds:
- Research based on answers (examine new code areas, web search if needed)
- Update understanding
- Ask follow-ups only if new areas emerge

**1e. Document findings:**

Write `{PHASE_DIR}/discovery.md` using template: `.specify/templates/discovery-template.md`

**1f. Verify understanding:**

Summarize understanding and ask user to confirm: "Does this accurately capture your intent?"
- If yes → proceed to SPECIFY
- If no → ask what was misunderstood, update discovery.md

---

### 2. SPECIFY Phase

**Skip if**: Starting from plan, tasks, or checklists.

**2a. Load context:**
- Read `discovery.md` (for confirmed understanding)
- Read template: `.specify/templates/spec-template.md`
- Get phase Goal/Scope from `specflow phase`

**2b. Check for deferred items:**

Look for handoff files in `.specify/phases/*-handoff.md` and deferred sections in previous `specs/*/tasks.md`.

If found:
- Display notice about inherited requirements
- Ask user which items to include (A: all, B: select, C: defer)
- Add confirmed items under "## Inherited Requirements"

**2c. Generate spec:**

Parse phase file and discovery findings. For unclear aspects:
- Make informed guesses based on context
- Only use `[NEEDS CLARIFICATION: question]` if:
  - Significantly impacts scope or UX
  - Multiple reasonable interpretations exist
  - No reasonable default exists
- **LIMIT: Maximum 3 markers**

Write `{PHASE_DIR}/spec.md` using template structure.

**2d. Create requirements checklist:**

Write `{PHASE_DIR}/requirements.md` using template: `.specify/templates/checklist-template.md`

**2e. Handle inline clarifications:**

If `[NEEDS CLARIFICATION]` markers exist (max 3):
1. Extract all markers
2. Present each as `AskUserQuestion` with options and recommendation
3. Wait for user response
4. Update spec, removing markers

**2f. Validate spec quality:**
```bash
specflow check --gate design
```

Fix any reported issues (max 3 iterations).

---

### 2.5 UI DESIGN Phase (Conditional)

**Trigger**: Spec.md references visual UI elements.

**Skip if**:
- Starting from plan, tasks, or checklists
- No visual UI elements detected in spec.md

**Detection**: Scan spec.md for visual element keywords:
- **Layout**: dashboard, screen, page, view, layout, panel, sidebar, header, footer
- **Components**: form, button, modal, dialog, widget, card, table, list, menu, navigation, tab
- **Visual actions**: display, render, show, hide, toggle (in UI context)

**2.5a. Detect UI scope:**
- Parse spec.md for UI keywords
- If no UI elements found → skip to PLAN phase
- If UI elements found → continue

**2.5b. Create ui-design.md:**
- Read template: `.specify/templates/ui-design-template.md`
- Document **Current State**: Existing UI, or "New feature - no existing UI"
- Create **Proposed Design**: Description + ASCII mockup
- List **Component Inventory**: All UI elements with type and purpose
- Document **Interactions**: User actions and system responses
- Explain **Rationale**: Why these design decisions

Write `{PHASE_DIR}/ui-design.md`

**2.5c. Link in spec.md:**
- Find sections in spec.md that reference UI elements
- Add inline references: `(see [ui-design.md](ui-design.md#section-name))`
- Link to specific sections using markdown anchors

---

### 3. PLAN Phase

**Skip if**: Starting from tasks or checklists.

**3a. Load context:**
- Read `spec.md`, `discovery.md`, `requirements.md`
- Read `ui-design.md` (if exists, for visual implementation guidance)
- Read `.specify/memory/constitution.md` (required)
- Read template: `.specify/templates/plan-template.md`

**3b. Constitution check:**

Verify planned approach doesn't violate principles:
- **Block** on principle violations
- **Warn** on guideline violations

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

Write `{PHASE_DIR}/plan.md` using template structure.

---

### 4. TASKS Phase

**Skip if**: Starting from checklists.

**4a. Load context:**
- Read `plan.md` (required)
- Read `spec.md` (for user story priorities)
- Read `data-model.md`, `contracts/` (if exist)
- Read template: `.specify/templates/tasks-template.md`

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

**4c. Validate tasks:**
- Every task has ID, description, file path
- User story tasks have `[US#]` label
- Dependencies are clear

**4d. Write tasks.md:**

Write `{PHASE_DIR}/tasks.md` using template with Progress Dashboard.

---

### 5. CHECKLISTS Phase

**5a. Load context:**
- Read `spec.md`, `plan.md`, `tasks.md`
- Read template: `.specify/templates/checklist-template.md`

**5b. Generate implementation.md:**

Create `{PHASE_DIR}/checklists/implementation.md` testing REQUIREMENTS QUALITY.

Focus areas:
- **Requirement Completeness**: Are all necessary requirements present?
- **Requirement Clarity**: Are requirements specific and unambiguous?
- **Scenario Coverage**: Are all flows/cases addressed?
- **Edge Case Coverage**: Are boundary conditions defined?

**5c. Generate verification.md:**

Create `{PHASE_DIR}/checklists/verification.md` for post-implementation verification.

Focus areas:
- **Acceptance Criteria Quality**: Are success criteria measurable?
- **Non-Functional Requirements**: Performance, security, accessibility specified?
- **Dependencies & Assumptions**: Documented and validated?

**5d. Add UI verification items (if ui-design.md exists):**

If `ui-design.md` was created, add these items to verification.md:

```markdown
## UI Design Verification

- [ ] V-UI1: UI implementation matches ui-design.md mockups
- [ ] V-UI2: All components from Component Inventory are implemented
- [ ] V-UI3: All interactions from Interactions table work as specified
- [ ] V-UI4: Design constraints from ui-design.md are respected
- [ ] V-UI5: Accessibility considerations from ui-design.md are addressed
```

---

### 6. Completion

**Update state:**
```bash
specflow state set "orchestration.step.status=complete"
```

**Report completion:**
```
Design artifacts created:
├── discovery.md     - Codebase findings and decisions
├── spec.md          - Feature specification
├── requirements.md  - Requirements checklist
├── ui-design.md     - Visual mockups (if UI phase)
├── plan.md          - Technical implementation plan
├── tasks.md         - X tasks across Y user stories
└── checklists/
    ├── implementation.md - Implementation guidance
    └── verification.md   - Verification checklist

Next: Run /flow.analyze or /flow.orchestrate
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No phase context | "Run `specflow phase open <number>` first" |
| Constitution violation | Block and report specific violation |
| Validation fails after 3 iterations | Report remaining issues, ask user to fix |

**On any error:**
```bash
specflow state set "orchestration.step.status=failed"
```

---

## Context

$ARGUMENTS
