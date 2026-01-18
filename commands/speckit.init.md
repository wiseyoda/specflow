---
description: SpecKit Project Initialization
handoffs:
  - label: Start Orchestration
    agent: speckit.orchestrate
    prompt: Begin development workflow
    send: true
  - label: Check Memory Health
    agent: speckit.memory
    prompt: Verify memory document health
  - label: Update Roadmap
    agent: speckit.roadmap
    prompt: Update the project roadmap
---

# SpecKit Project Initialization

This command runs the complete project initialization flow:

1. **Discovery Interview** - Collect project context and decisions
2. **Constitution Generation** - Create governance document from decisions
3. **Memory Documents** - Generate tech-stack, coding-standards, etc.
4. **Roadmap Creation** - Create initial ROADMAP.md

Each step is idempotent - if artifacts already exist and appear complete, that step is skipped.

## User Input

```text
$ARGUMENTS
```

## Argument Routing

**IMPORTANT**: Check the user input above and route to the appropriate action:

| Argument | Action |
|----------|--------|
| (empty) | Run full initialization flow |
| `status` | Show current progress → [Status Action](#status-action) |
| `pause` | Save and pause → [Pause Action](#pause-action) |
| `skip` | Skip current phase → [Skip Action](#skip-action) |
| `revisit N` | Return to phase N → [Revisit Action](#revisit-action) |
| `validate` | Check for issues → [Validate Action](#validate-action) |
| `export [format]` | Generate memory docs → [Export Action](#export-action) |
| `faster` | Switch to fast mode → [Mode Action](#mode-action) |
| `deeper` | Switch to deep mode → [Mode Action](#mode-action) |
| `focus TOPIC` | Focus on topic → [Focus Action](#focus-action) |
| `research TOPIC` | Research topic → [Research Action](#research-action) |
| `compare A vs B` | Compare options → [Compare Action](#compare-action) |
| `--force` | Regenerate all artifacts even if complete |
| Other text | Use as project description, start interview |

---

## Pre-Flight Checks

Before running the initialization flow:

### 1. Check for Active Orchestration

```bash
# Check if a phase is in progress
speckit state get orchestration.phase.status 2>/dev/null
```

**If orchestration is in progress**:

```
⚠️ Active Phase Detected

An orchestration phase is currently in progress:
  Phase: [phase_number] - [phase_name]
  Status: [status]
  Step: [step]

Running /speckit.init during active development is not recommended.
It could overwrite project context while work is in progress.

Options:
1. Complete the current phase with /speckit.orchestrate
2. Run /speckit.init --force to reinitialize anyway (use with caution)
```

**If `--force` flag is set**: Continue with warning that artifacts will be regenerated.

### 2. Check Project Structure

```bash
speckit scaffold --status
```

If `.specify/` doesn't exist, it will be created.

---

## Full Initialization Flow

When running without special arguments (or resuming), execute these steps in order:

### Step 1: Discovery Interview

**Check completion**:

```bash
# Check if interview is complete
speckit state get interview.status 2>/dev/null
```

**Completion criteria**:
- `.specify/discovery/state.md` exists AND shows all phases complete
- `.specify/discovery/decisions.md` exists AND has decisions

**If complete (and not --force)**:
- Output: "✓ Discovery complete (X decisions captured). Skipping..."
- Proceed to Step 2

**If not complete**:
- Run the interview process (see [Main Interview Process](#main-interview-process) below)
- After interview completes, proceed to Step 2

---

### Step 2: Constitution Generation

**Check completion**:

```bash
# Check if constitution exists
ls .specify/memory/constitution.md 2>/dev/null
```

**Completion criteria** (smart detection):
- File exists AND
- Does NOT contain placeholder patterns: `[PROJECT_NAME]`, `[PRINCIPLE_`, `[RATIONALE]`
- Has at least 2 `## Principle` sections with content

**If complete (and not --force)**:
- Output: "✓ Constitution exists (X principles). Skipping..."
- Proceed to Step 3

**If incomplete or missing**:

1. Load decisions from `.specify/discovery/decisions.md`
2. Map decisions to constitution principles:

| Decision Category | Constitution Section |
|-------------------|---------------------|
| Architecture decisions | Core principles |
| Technology choices | Tech constraints |
| Testing approach | Testing discipline |
| Security choices | Security principle |
| Performance targets | Performance principle |
| UX priorities | UX principle |

3. Generate constitution using template from `.specify/templates/constitution-template.md`
4. Write to `.specify/memory/constitution.md`
5. Output: "✓ Constitution generated (X principles)"
6. Proceed to Step 3

---

### Step 3: Memory Document Generation

**Check completion**:

```bash
# Check for memory documents
ls .specify/memory/tech-stack.md .specify/memory/coding-standards.md 2>/dev/null
```

**Completion criteria** (smart detection):
- At least `tech-stack.md` exists AND
- Does NOT contain placeholder patterns: `[TECHNOLOGY]`, `[VERSION]`, `[REASON]`
- Has actual technology entries

**If complete (and not --force)**:
- Output: "✓ Memory documents exist. Skipping..."
- Proceed to Step 4

**If incomplete or missing**:

1. Load decisions from `.specify/discovery/decisions.md`
2. Load constitution from `.specify/memory/constitution.md`
3. Generate memory documents:

| Document | Source Decisions |
|----------|------------------|
| `tech-stack.md` | Technology choices, framework decisions |
| `coding-standards.md` | Code style, patterns, conventions |
| `testing-strategy.md` | Test approach, coverage requirements |
| `api-standards.md` | API patterns (if applicable) |
| `security-checklist.md` | Security requirements (if applicable) |
| `glossary.md` | Domain terms discovered during interview |

4. Write documents to `.specify/memory/`
5. Output: "✓ Memory documents generated (X documents)"
6. Proceed to Step 4

---

### Step 4: Roadmap Creation

**Check completion**:

```bash
# Check if roadmap exists
ls ROADMAP.md 2>/dev/null
speckit roadmap validate 2>/dev/null
```

**Completion criteria**:
- `ROADMAP.md` exists AND
- Has at least 1 phase defined
- Passes validation

**If complete (and not --force)**:
- Output: "✓ ROADMAP.md exists (X phases). Skipping..."
- Proceed to Completion Summary

**If incomplete or missing**:

1. Load project context from:
   - `.specify/discovery/context.md`
   - `.specify/memory/constitution.md`
   - `.specify/memory/tech-stack.md`

2. Apply roadmap generation principles:
   - Build core business logic first
   - Create POC checkpoints
   - Size phases for agentic sessions (~200k tokens)
   - Place USER GATES at key verification points

3. Generate phases based on project type and scope

4. Create `ROADMAP.md` at project root

5. Create phase detail files in `.specify/phases/`

6. Output: "✓ ROADMAP.md created (X phases)"

---

### Initialization Complete

After all steps complete, display summary:

```markdown
## Project Initialization Complete!

### Artifacts Created/Verified

| Step | Status | Details |
|------|--------|---------|
| Discovery | ✓ Complete | X decisions captured |
| Constitution | ✓ Complete | X principles |
| Memory Docs | ✓ Complete | X documents |
| Roadmap | ✓ Complete | X phases |

### Project Ready

Your project is now ready for development!

**Next Step**: Run `/speckit.orchestrate` to begin the first phase.

### Quick Commands

- `/speckit.orchestrate` - Start development workflow
- `/speckit.memory` - Check memory document health
- `/speckit.roadmap` - Update roadmap
```

---

## Interview Actions

### Status Action

Show current progress in the interview.

1. Read `.specify/discovery/state.md` for phase progress
2. Read `.specify/discovery/decisions.md` for decision count
3. Read `.specify/discovery/context.md` for project info

Output:

```markdown
## SpecKit Initialization Status

### Project: [Name]
**Type**: [Type] | **Stage**: [Stage] | **Criticality**: [Level]

### Phase Progress
| Phase | Status | Decisions |
|-------|--------|-----------|
| 0: Discovery | complete | 8 |
| 1: Problem & Vision | in_progress | 3 |
| ... | ... | ... |

**Overall**: X/12 phases | Y decisions captured

### Memory Document Coverage
| Document | Decisions | Status |
|----------|-----------|--------|
| constitution.md | N | Ready/Partial/Empty |
| tech-stack.md | N | Ready/Partial/Empty |
| ... | ... | ... |

### Next: Phase N, Question X
```

**After showing status, stop and wait for user input.**

---

### Pause Action

Save state and pause the interview.

1. Update `.specify/discovery/state.md` with pause timestamp
2. Summarize progress

Output:

```markdown
## Interview Paused

**Paused at**: [timestamp]
**Current Phase**: N: [Name]
**Progress**: X/12 phases | Y decisions

State saved to `.specify/discovery/`. Run `/speckit.init` to resume.
```

**Stop and wait for user input.**

---

### Skip Action

Skip the current phase.

1. Read current phase from state.md
2. Mark current phase as "skipped"
3. Move to next phase
4. Continue interview

---

### Revisit Action

Return to a previous phase.

Argument: `revisit N` where N is the phase number.

1. Update state to phase N
2. Summarize decisions from that phase
3. Ask if user wants to modify or add decisions
4. Continue from there

---

### Validate Action

Check decisions for contradictions and gaps.

1. Read all decisions from `.specify/discovery/decisions.md`
2. Check for contradictions (conflicting decisions)
3. Check coverage gaps (phases with no decisions)
4. Check memory document readiness

Output validation report:

```markdown
## Interview Validation Report

### Contradictions: N
| Decisions | Conflict | Suggested Resolution |
|-----------|----------|----------------------|

### Coverage Gaps: N
| Phase | Gap | Impact |
|-------|-----|--------|

### Memory Document Readiness
| Document | Decisions | Ready? |
|----------|-----------|--------|

### Quality Score: X/10

### Recommendations
1. [Priority action]
2. [Secondary action]
```

---

### Export Action

Generate memory documents from decisions.

Argument: `export [format]` where format is:
- `summary` - One-page project overview
- `constitution` - Draft constitution
- `tech-stack` - Technology decisions
- `all` - Generate all memory documents

1. Read all decisions from `.specify/discovery/decisions.md`
2. Group by target memory document
3. Generate requested format(s)
4. Write to `.specify/memory/`

After export, continue to constitution step (Step 2).

---

### Mode Action

Switch interview mode.

**`faster`**: Fast mode
- 4 questions per round
- Skip optional phases
- Brief decisions

**`deeper`**: Deep mode
- 2 questions per round
- Apply 5 Whys technique
- Detailed decisions with alternatives explored

Update mode in state.md and continue interview in new mode.

---

### Focus Action

Focus remaining questions on a specific topic.

Argument: `focus TOPIC`

1. Read remaining phases
2. Filter/prioritize questions related to TOPIC
3. Update state with focus
4. Continue with focused questions

---

### Research Action

Research a topic before deciding.

Argument: `research TOPIC`

1. Use web search or codebase exploration to gather information
2. Present findings to user
3. Ask follow-up decision question based on research

---

### Compare Action

Compare options side-by-side.

Argument: `compare A vs B`

Create a comparison table:

```markdown
## Comparison: A vs B

| Aspect | A | B |
|--------|---|---|
| Pros | ... | ... |
| Cons | ... | ... |
| Best for | ... | ... |
| Team familiarity | ... | ... |
| Community/Support | ... | ... |

**Recommendation**: [Based on project context from decisions]

Which would you like to proceed with?
```

---

## Main Interview Process

If no special argument, run the interview.

### Setup: Create Project Structure

Use the SpecKit CLI:

```bash
# Check and create project structure
speckit scaffold

# Or check status first
speckit scaffold --status
```

This creates:
- `.specify/discovery/` - context.md, state.md, decisions.md
- `.specify/memory/adrs/`
- `.specify/templates/`
- `.specify/scripts/bash/`
- `.specify/archive/`
- `specs/`

### Check for Existing Interview

```bash
# Check if resuming
speckit state get interview.status 2>/dev/null || echo "new"
```

If resuming:
1. Read state.md for current phase/question
2. Summarize recent decisions
3. Continue from where we left off

### Phase 0: Discovery (Always First)

Ask 4 questions using AskUserQuestion:
1. What is this project? (one sentence description)
2. What type of software? (CLI, API, web app, library, mobile, etc.)
3. Who is it for? (developers, end users, machines)
4. What stage? (greenfield, brownfield, prototype, rewrite)

Then 4 more about context:
5. What already exists? (code, prototypes, docs)
6. What's already decided? (tech constraints, timeline)
7. Team size and composition?
8. Criticality level?

After Phase 0:
1. Update `.specify/discovery/context.md`
2. Set relevance filters for remaining phases
3. Create TodoWrite checklist for phases
4. If reference materials mentioned, use Explore agent

### Subsequent Phases

For each phase (1-10):
1. Announce phase and relevance level
2. Ask 4 questions using AskUserQuestion
3. Update decisions.md and state.md
4. Track memory document impacts
5. Check for contradictions
6. Move to next phase

**Questions must build on previous answers:**
- Bad: "What's your testing strategy?"
- Good: "You said this is a CLI for developers (D-2) running overnight (D-5). How should test failures be surfaced?"

### Decision Format

```markdown
#### D-N: [Title]
- **Phase**: [Phase number and name]
- **Status**: Decided | Tentative | Needs-validation
- **Confidence**: High | Medium | Low
- **Context**: [Why this came up]
- **Decision**: [What was decided]
- **Alternatives**: [What was rejected and why]
- **Consequences**: Enables [...], Constrains [...], Requires [...]
- **Memory Doc Impact**: [constitution.md, tech-stack.md, etc.]
```

### Phase 11: Memory Bootstrap

Final interview phase - generate draft memory documents:
1. Review all captured decisions
2. For each memory document, gather relevant decisions and generate draft
3. Write to `.specify/memory/[doc].md`
4. Create gap analysis report
5. Mark interview as complete
6. Continue to Step 2 (Constitution Generation)

---

## CLI Dependencies

```bash
speckit scaffold          # Create project structure
speckit scaffold --status # Check project structure
speckit state get         # Read state
speckit state set         # Update state
speckit doctor            # Check project health
speckit roadmap validate  # Validate roadmap
```

---

## Context

$ARGUMENTS
