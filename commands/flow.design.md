---
description: Create all design artifacts (discovery, spec, plan, tasks, checklists) in one command with inline clarifications.
handoffs:
  - label: Analyze Artifacts
    agent: specflow.analyze
    prompt: Run consistency analysis on all artifacts
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

**Note**: Use `specflow` directly, NOT `npx specflow`. It's a local CLI at `~/.claude/specflow-system/bin/`.

## Agent Teams Mode (Opus 4.6)

- Prefer Agent Teams for parallel worker sections when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Use scoped project agents from `.claude/agents/` for reusable roles when available.
- If teams are unavailable, unsupported, or fail mid-run, fall back to Task agents using the same scopes.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Prerequisites

| Requirement | Check Command | If Missing |
|-------------|---------------|------------|
| Active phase | `specflow phase` | Run `specflow phase open <number>` |
| Phase document | `.specify/phases/NNNN-*.md` | Create phase in ROADMAP.md first |
| Constitution | `.specify/memory/constitution.md` | Run `/flow.init` |
| Git branch | `git branch --show-current` | Should be on phase branch |

## Goal

Produce all design artifacts for the current phase.

**Artifact Location**: `specs/{PHASE_NUMBER}-{phase-name}/` at project root.
- Example: Phase 0060 "GitHub Integration" → `specs/0060-github-integration/`
- **NOT** `.specify/phases/` - that's for phase definition files only

| Artifact | Location |
|----------|----------|
| `discovery.md` | `specs/NNNN-name/discovery.md` |
| `spec.md` | `specs/NNNN-name/spec.md` |
| `requirements.md` | `specs/NNNN-name/requirements.md` |
| `ui-design.md` | `specs/NNNN-name/ui-design.md` (if UI phase) |
| `plan.md` | `specs/NNNN-name/plan.md` |
| `tasks.md` | `specs/NNNN-name/tasks.md` |
| `checklists/implementation.md` | `specs/NNNN-name/checklists/implementation.md` |
| `checklists/verification.md` | `specs/NNNN-name/checklists/verification.md` |

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

Parse:
- `phase.number` - Current phase number (e.g., "0060")
- `phase.name` - Phase name (e.g., "GitHub Integration")
- `phase.branch` - Git branch
- `context.featureDir` - Path to artifacts directory (null if not created yet)
- `context.hasSpec/hasPlan/hasTasks/hasChecklists` - Which artifacts exist

**Resolve PHASE_DIR** (critical - this is where ALL artifacts go):
```
If context.featureDir exists and is not null:
  PHASE_DIR = context.featureDir (e.g., /path/to/project/specs/0060-github-integration)
Else:
  # Create the specs directory - artifacts ALWAYS go in specs/, never .specify/phases/
  PHASE_DIR = {PROJECT_ROOT}/specs/{phase.number}-{phase.name-kebab-case}

  # Example: Phase 0060 "GitHub Integration" → specs/0060-github-integration/
  mkdir -p {PHASE_DIR}
  mkdir -p {PHASE_DIR}/checklists
```

**⚠️ CRITICAL**: Artifacts MUST go in `specs/NNNN-name/` at the project root, NOT in `.specify/phases/`. The `.specify/phases/` directory is for phase DEFINITION files (NNNN.md), not artifacts.

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

**Update state (respecting orchestrate ownership):**

```bash
# Check if orchestrate already set the step
CURRENT_STEP=$(specflow state get orchestration.step.current 2>/dev/null)

# Only set step.current if not already set (standalone mode)
# Orchestrate owns step transitions - never override if already set
if [[ -z "$CURRENT_STEP" || "$CURRENT_STEP" == "null" ]]; then
  specflow state set "orchestration.step.current=design" "orchestration.step.index=0"
fi

# Always set status to in_progress (safe for both modes)
specflow state set "orchestration.step.status=in_progress"
```

**State ownership note**: `/flow.orchestrate` owns step transitions (`step.current`, `step.index`). Sub-commands only update `step.status` (in_progress, complete, failed). When run standalone, sub-commands initialize step if not set.

Use TodoWrite: mark [DESIGN] SETUP complete. As you complete each phase, mark it complete and mark the next in_progress (e.g., mark [DESIGN] DISCOVER complete, mark [DESIGN] SPECIFY in_progress).

---

### 1. DISCOVER Phase

**Skip if**: Starting from spec, plan, tasks, or checklists.

**1a. Load phase document (SOURCE OF TRUTH):**

```bash
specflow phase
```

From the phase output, get `PHASE_NUMBER`, then read the phase document:
- `.specify/phases/{PHASE_NUMBER}-*.md` - This is the **authoritative source** for phase goals and scope

Extract and note:
- **Goals**: What this phase must accomplish
- **Scope**: What's in and out of scope
- **Deliverables**: Expected outputs
- **Verification Gate**: How success is measured (including USER GATE if present)

**Persist goals to state** (survives conversation compaction):

```bash
# Store phase number for cross-command access
specflow state set orchestration.phase.number=$PHASE_NUMBER

# Store goals as JSON array for tracking through workflow
specflow state set orchestration.phase.goals='["Goal 1", "Goal 2", "Goal 3"]'

# Store USER GATE status if present
specflow state set orchestration.phase.hasUserGate=true  # or false

# Store gate criteria for compaction recovery (if gate exists)
specflow state set orchestration.phase.userGateCriteria="Criteria text from phase doc"
```

These goals will be tracked through spec → plan → tasks to ensure nothing is lost.

**CRITICAL**: These state writes MUST execute - they enable context compaction recovery.

**1b. Load context (Parallel):**

**Use parallel sub-agents** to gather all context simultaneously (timeout: 180s each):

```
Launch 3 parallel workers (Agent Teams preferred; Task agents fallback) (subagent_type: Explore):

Team-mode role hints:
- `specflow-codebase-scanner` for Agent 1
- `specflow-memory-checker` for Agent 2
- `specflow-researcher` for Agent 3
- Parent orchestrator uses `specflow-coordinator` to aggregate findings

Agent 1 (Codebase): Search files, functions, patterns related to change
  - Scope: src/, relevant directories
  - Look for existing implementations in same area
  - Identify dependencies and integration points
  - Note patterns and conventions established
  → Return: relevant files, patterns found, dependencies

Agent 2 (Memory): Read memory documents per `.specify/templates/memory-loading-guide.md`
  - Scope: .specify/memory/
  - constitution.md (REQUIRED - abort if missing)
  - tech-stack.md (recommended for design)
  - glossary.md (recommended for terminology)
  → Return: MUST requirements, approved technologies, domain terms

Agent 3 (Research): Web search for relevant patterns/best practices
  - Only if feature involves unfamiliar technology
  - Search for common approaches to this type of feature
  → Return: recommended patterns, gotchas to avoid

**Synchronization**: Wait for ALL 3 agents before proceeding
```

**Expected speedup**: 2-3x faster context loading (3 parallel vs. sequential)

**Aggregate results** from all 3 agents before proceeding to questions.

**1c. Progressive clarifying questions:**

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

**Existence check**: If `{PHASE_DIR}/discovery.md` exists:
- Show diff preview of what will change
- Use `AskUserQuestion` with options: "Overwrite", "Merge changes", "Skip"
- Only proceed with user consent

Write `{PHASE_DIR}/discovery.md` using template: `.specify/templates/discovery-template.md`

**1f. Verify understanding:**

Summarize understanding and ask user to confirm: "Does this accurately capture your intent?"
- If yes → proceed to SPECIFY
- If no → ask what was misunderstood, update discovery.md

---

### 2. SPECIFY Phase

**Skip if**: Starting from plan, tasks, or checklists.

**2a. Load context:**
- Read `.specify/phases/{PHASE_NUMBER}-*.md` - **Phase goals (source of truth)**
- Read `discovery.md` (for confirmed understanding)
- Read template: `.specify/templates/spec-template.md`

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

**Existence check**: If `{PHASE_DIR}/spec.md` exists:
- Show diff preview of what will change
- Use `AskUserQuestion` with options: "Overwrite", "Merge changes", "Skip"
- Only proceed with user consent

Write `{PHASE_DIR}/spec.md` using template structure.

**2d. Verify phase goal coverage (REQUIRED):**

Before proceeding, generate the goals coverage matrix using the format from `.specify/templates/goal-coverage-template.md`:

```markdown
## Phase Goals Coverage

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | [Goal from phase doc] | FR-001 | - | PARTIAL |
| 2 | [Goal from phase doc] | FR-002, NFR-001 | - | PARTIAL |
| 3 | [Goal from phase doc] | NONE | - | MISSING |
```

**ID formats** (from spec-template.md): `FR-###` (functional), `NFR-###` (non-functional), `SC-###` (success criteria)

**Status values**: `COVERED`, `PARTIAL` (has req, no tasks yet), `MISSING`, `DEFERRED`

**If any goal is MISSING:**
1. Add requirement(s) to spec.md that address the goal
2. Re-verify coverage
3. If goal cannot be addressed in this phase, mark as `DEFERRED` and document reason

**Do NOT proceed to PLAN until all phase goals are at least PARTIAL (have requirements).**

**2f. Create requirements checklist:**

Write `{PHASE_DIR}/requirements.md` using template: `.specify/templates/checklist-template.md`

**2g. Handle inline clarifications:**

If `[NEEDS CLARIFICATION]` markers exist (max 3):
1. Extract all markers
2. Present each as `AskUserQuestion` with options and recommendation
3. Wait for user response
4. Update spec, removing markers

**2h. Validate spec quality:**
```bash
specflow check --gate design
```

Fix any reported issues (max 3 iterations).

---

### 2.5 UI DESIGN Phase (Conditional)

**Decision matrix**: See `.specify/templates/ui-design-template.md` for the standardized decision criteria.

**Quick reference**:
| Create ui-design.md | Skip ui-design.md |
|---------------------|-------------------|
| New screens/pages/views | CLI/terminal tools |
| Significant layout changes | API/backend services |
| Complex user flows | Database/infrastructure |
| New UI components | Bug fixes/refactoring |
| | Minor UI tweaks |
| | Existing patterns apply |

**2.5a. Decide if UI design is needed:**
- Review the spec.md scope and requirements
- Apply the decision matrix from the template
- **Rule**: If you need to explain WHERE something goes or HOW it looks → create ui-design.md
- If in doubt, skip it - ui-design.md can be added later if needed

**2.5b. Create ui-design.md:**
- Read template: `.specify/templates/ui-design-template.md`
- Document **Current State**: Existing UI, or "New feature - no existing UI"
- Create **Proposed Design**: Description + ASCII mockup
- List **Component Inventory**: All UI elements with type and purpose
- Document **Interactions**: User actions and system responses
- Explain **Rationale**: Why these design decisions

**Existence check**: If `{PHASE_DIR}/ui-design.md` exists:
- Show diff preview of what will change
- Use `AskUserQuestion` with options: "Overwrite", "Merge changes", "Skip"
- Only proceed with user consent

Write `{PHASE_DIR}/ui-design.md`

**2.5c. Link in spec.md:**
- Find sections in spec.md that reference UI elements
- Add inline references: `(see [ui-design.md](ui-design.md#section-name))`
- Link to specific sections using markdown anchors

---

### 3. PLAN Phase

**Skip if**: Starting from tasks or checklists.

**3a. Load context:**
- Read `.specify/phases/{PHASE_NUMBER}-*.md` - **Phase goals (source of truth)**
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

**3d. Research unknowns (Parallel, if any exist):**

**Use parallel sub-agents** to research all unknowns simultaneously:

```
For N unknowns marked "NEEDS RESEARCH":

Launch N parallel workers (Agent Teams preferred; Task agents fallback) (subagent_type: Explore):

Team-mode role hints:
- Use `specflow-researcher` for all unknown-research workers
- Parent orchestrator uses `specflow-coordinator` to consolidate decisions

Agent U1: Research unknown 1 (e.g., "best approach for X")
  - Web search for current best practices
  - Check codebase for existing patterns
  → Return: decision, rationale, alternatives

Agent U2: Research unknown 2 (e.g., "library choice for Y")
  - Compare options, check compatibility
  - Verify fits with tech-stack.md
  → Return: decision, rationale, alternatives

... (one agent per unknown)
```

**Expected speedup**: 3-5x faster (N parallel research vs. sequential)

**Aggregate results** into `research.md`:
- For each unknown: decision, rationale, alternatives considered

**3e. Generate optional artifacts:**
- `data-model.md` if data entities involved
- `contracts/` if API endpoints involved

**3f. Write plan.md:**

**Existence check**: If `{PHASE_DIR}/plan.md` exists:
- Show diff preview of what will change
- Use `AskUserQuestion` with options: "Overwrite", "Merge changes", "Skip"
- Only proceed with user consent

Write `{PHASE_DIR}/plan.md` using template structure.

---

### 4. TASKS Phase

**Skip if**: Starting from checklists.

**4a. Load context:**
- Read `.specify/phases/{PHASE_NUMBER}-*.md` - **Phase goals (source of truth)**
- Read `plan.md` (required)
- Read `spec.md` (for user story priorities and requirement mapping)
- Read `ui-design.md` (if exists, for component tasks)
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

**⚠️ DO NOT use these incorrect formats:**
```markdown
### T001: Task as header        ❌ WRONG - CLI cannot parse
- [ ] Subtask without ID        ❌ WRONG - no task ID

## T001 Header style            ❌ WRONG - not a checkbox item
```

The task ID MUST be inline with the checkbox. The CLI parses `- [ ] T###` patterns only.

**4c. Validate tasks:**
- Every task has ID, description, file path
- User story tasks have `[US#]` label
- Dependencies are clear

**4d. Write tasks.md:**

**Existence check**: If `{PHASE_DIR}/tasks.md` exists:
- Show diff preview of what will change
- Use `AskUserQuestion` with options: "Overwrite", "Merge changes", "Skip"
- Only proceed with user consent

Write `{PHASE_DIR}/tasks.md` using template with Progress Dashboard.

**4e. Verify phase goal → task coverage (REQUIRED):**

Update the goals coverage matrix (from step 2d) to include tasks and **persist it to tasks.md**:

```markdown
# Tasks: Phase NNNN - Feature Name

## Phase Goals Coverage

| # | Phase Goal | Spec Requirement(s) | Task(s) | Status |
|---|------------|---------------------|---------|--------|
| 1 | [Goal from phase doc] | FR-001 | T001-T005 | COVERED |
| 2 | [Goal from phase doc] | FR-002, NFR-001 | T010-T015 | COVERED |
| 3 | [Goal from phase doc] | FR-003 | NONE | PARTIAL |
| 4 | [Goal from phase doc] | Deferred | - | DEFERRED |

Coverage: 2/4 goals (50%) - need tasks for Goal 3

---

## Progress Dashboard
...
```

**Storage location**: The matrix MUST be written to the top of `{PHASE_DIR}/tasks.md` before the Progress Dashboard. This ensures it survives context compaction and gets archived with the phase.

See `.specify/templates/goal-coverage-template.md` for full format details.

**If any goal has PARTIAL status (requirement but no tasks):**
1. Add task(s) to tasks.md that implement the requirement
2. Re-verify coverage
3. Update status to COVERED

**Do NOT proceed until all non-deferred goals have COVERED status.**

**4f. Verify task format (REQUIRED):**

After writing tasks.md, verify the CLI can parse it:
```bash
specflow status --json
```

Check `tasks.total` > 0. If tasks.total is 0 but you wrote tasks, the format is wrong. Re-read the format requirements above and regenerate tasks.md with correct inline task IDs.

---

### 5. CHECKLISTS Phase

**5a. Load context:**
- Read `spec.md`, `plan.md`, `tasks.md`
- Read templates:
  - `.specify/templates/implementation-checklist-template.md`
  - `.specify/templates/verification-checklist-template.md`

**5b. Generate checklists (Parallel):**

**Use parallel sub-agents** to generate both checklists simultaneously:

```
Launch 2 parallel workers (Agent Teams preferred; Task agents fallback):

Team-mode role hints:
- `specflow-quality-auditor` for checklist quality checks
- `specflow-doc-assembler` for final checklist formatting

Agent 1 (Implementation): Create checklists/implementation.md
  - Use template: .specify/templates/implementation-checklist-template.md
  - Read spec.md, plan.md for requirements
  - Focus on REQUIREMENTS QUALITY (I-### items):
    - Requirement Completeness: All necessary requirements present?
    - Requirement Clarity: Specific and unambiguous?
    - Scenario Coverage: All flows/cases addressed?
    - Edge Case Coverage: Boundary conditions defined?
  → Return: implementation.md content

Agent 2 (Verification): Create checklists/verification.md
  - Use template: .specify/templates/verification-checklist-template.md
  - Read spec.md, tasks.md for acceptance criteria
  - Focus on post-implementation verification (V-### items):
    - Acceptance Criteria Quality: Success criteria measurable?
    - Non-Functional Requirements: Performance, security, accessibility?
    - Phase Goal Verification: All goals have verification items?
  → Return: verification.md content
```

**Expected speedup**: 50% faster (2 parallel vs. sequential)

Write both checklists from agent results.

**5c. Add UI verification items (if ui-design.md exists):**

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

## Parallel Agent Coordination

See `.specify/templates/parallel-execution-guide.md` for the complete standardized protocol.

**Quick Reference** for parallel agents (context loading, research, checklist generation):

**1. Pre-launch**:
- Verify target files/directories exist
- Define clear scope for each agent (no overlapping write targets)

**2. Execution**:
- Launch agents simultaneously using Agent Teams (preferred) or Task tool (fallback) with `subagent_type: Explore`
- Set timeout: **180 seconds** per agent (standardized)
- Agents work independently on UNIQUE output files

**3. Synchronization** (CRITICAL):
- **Wait for ALL agents** before proceeding to next phase
- If agent times out after 180s, continue with available results
- Log incomplete agents for debugging

**4. Result aggregation**:
- Merge agent outputs into unified context
- Resolve conflicts by preferring more specific findings
- Deduplicate: Same file:line → keep highest severity
- Document sources for traceability

**5. Error handling**:
- 1 agent fails: Continue with other results, log warning
- >50% agents fail: HALT and report
- All agents timeout: Abort with "Parallel execution failed"

---

## Context

$ARGUMENTS
