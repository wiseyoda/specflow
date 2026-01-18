---
description: SpecFlow Project Initialization
handoffs:
  - label: Start Orchestration
    agent: specflow.orchestrate
    prompt: Begin development workflow
    send: true
  - label: Check Memory Health
    agent: specflow.memory
    prompt: Verify memory document health
  - label: Update Roadmap
    agent: specflow.roadmap
    prompt: Update the project roadmap
---

# SpecFlow Project Initialization

Initialize a project with SpecFlow by running a structured discovery interview, then generating governance documents.

**Steps**:
1. **Discovery Interview** - Collect project context and decisions
2. **Constitution Generation** - Create governance document from decisions
3. **Memory Documents** - Generate tech-stack, coding-standards, etc.
4. **Roadmap Creation** - Create initial ROADMAP.md

Each step is idempotent - if artifacts exist and appear complete, that step is skipped.

## User Input

```text
$ARGUMENTS
```

## Arguments

| Argument | Action |
|----------|--------|
| (empty) | Run full initialization flow (or resume) |
| `status` | Show current progress |
| `--force` | Regenerate all artifacts even if complete |
| `faster` | Fast mode: 4 questions/round, skip optional phases |
| `deeper` | Deep mode: 2 questions/round, apply 5 Whys technique |
| `compare A vs B` | Compare two options side-by-side |
| `research TOPIC` | Research a topic before deciding |
| Other text | Use as project description, start interview |

---

## Pre-Flight

**Get project status:**
```bash
specflow status --json
```

This tells us:
- Whether a phase is in progress (`phase.status`)
- What artifacts exist (`artifacts`)
- Project structure status

**If orchestration is in progress** (and not `--force`):
```
Active Phase Detected

Phase [number] is currently in progress.
Running /flow.init during active development is not recommended.

Options:
1. Complete the current phase with /flow.orchestrate
2. Run /flow.init --force to reinitialize anyway
```

**Create project structure** if `.specify/` doesn't exist:
- `.specify/discovery/` - context.md, state.md, decisions.md
- `.specify/memory/`
- `.specify/templates/`
- `.specify/phases/`
- `specs/`

---

## Argument Routing

### Status Action

Show current initialization progress.

Read from `.specify/discovery/`:
- `state.md` for phase progress
- `decisions.md` for decision count
- `context.md` for project info

Output:
```
SpecFlow Initialization Status

Project: [Name]
Type: [Type] | Stage: [Stage] | Criticality: [Level]

Phase Progress: X/11 phases | Y decisions captured

Memory Document Readiness:
| Document | Decisions | Status |
|----------|-----------|--------|
| constitution.md | N | Ready/Partial/Missing |
| tech-stack.md | N | Ready/Partial/Missing |
| coding-standards.md | N | Ready/Partial/Missing |

Next: Phase N, Question X
```

**Stop and wait for user input.**

---

### Compare Action

Argument: `compare A vs B`

Create comparison table:
```
## Comparison: A vs B

| Aspect | A | B |
|--------|---|---|
| Pros | ... | ... |
| Cons | ... | ... |
| Best for | ... | ... |
| Team familiarity | ... | ... |
| Community/Support | ... | ... |

**Recommendation**: [Based on project context]

Which would you like to proceed with?
```

---

### Research Action

Argument: `research TOPIC`

1. Use web search or codebase exploration to gather information
2. Present findings with sources
3. Ask follow-up decision question based on research

---

## Full Initialization Flow

### Step 1: Discovery Interview

**Check completion:**
- `.specify/discovery/state.md` shows all phases complete
- `.specify/discovery/decisions.md` has decisions

**If complete (and not --force):**
Output: "Discovery complete (X decisions). Skipping..."
Proceed to Step 2.

**If not complete:**
Run the interview process (see [Interview Process](#interview-process) below).

---

### Step 2: Constitution Generation

**Check completion:**
- `.specify/memory/constitution.md` exists
- Has at least 2 `## Principle` sections with content
- No placeholder patterns like `[PROJECT_NAME]`

**If complete (and not --force):**
Output: "Constitution exists (X principles). Skipping..."
Proceed to Step 3.

**If incomplete:**

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

3. Generate using template: `.specify/templates/constitution-template.md`
4. Write to `.specify/memory/constitution.md`

---

### Step 3: Memory Document Generation

**Check completion:**
- `tech-stack.md` exists with actual technology entries
- No placeholder patterns like `[TECHNOLOGY]`, `[VERSION]`

**If complete (and not --force):**
Output: "Memory documents exist. Skipping..."
Proceed to Step 4.

**If incomplete:**

1. Load decisions from `.specify/discovery/decisions.md`
2. Load constitution from `.specify/memory/constitution.md`
3. Generate documents:

| Document | Source Decisions |
|----------|------------------|
| `tech-stack.md` | Technology choices, framework decisions |
| `coding-standards.md` | Code style, patterns, conventions |
| `testing-strategy.md` | Test approach, coverage requirements |
| `api-standards.md` | API patterns (if applicable) |
| `security-checklist.md` | Security requirements (if applicable) |
| `glossary.md` | Domain terms discovered during interview |

4. Write to `.specify/memory/`

---

### Step 4: Roadmap Creation

**Check completion:**
- `ROADMAP.md` exists with at least 1 phase defined

**If complete (and not --force):**
Output: "ROADMAP.md exists (X phases). Skipping..."
Proceed to completion.

**If incomplete:**

1. Load context from:
   - `.specify/discovery/context.md`
   - `.specify/memory/constitution.md`
   - `.specify/memory/tech-stack.md`

2. Apply roadmap principles:
   - Build core business logic first
   - Create POC checkpoints
   - Size phases for agentic sessions (~200k tokens)
   - Place USER GATES at key verification points

3. Create `ROADMAP.md` at project root
4. Create phase detail files in `.specify/phases/`

---

### Initialization Complete

```
Project Initialization Complete!

| Step | Status | Details |
|------|--------|---------|
| Discovery | Complete | X decisions captured |
| Constitution | Complete | X principles |
| Memory Docs | Complete | X documents |
| Roadmap | Complete | X phases |

Next: Run /flow.orchestrate to begin the first phase.
```

---

## Interview Process

### Interview Modes

**Normal mode** (default): 3 questions per round, balanced depth.

**Fast mode** (`faster`): 4 questions per round, skip optional phases, brief decisions.

**Deep mode** (`deeper`): 2 questions per round, apply 5 Whys technique, detailed decisions with alternatives.

### Inline Controls

During any question, the user can say:
- **"skip"** - Skip current phase, move to next
- **"pause"** - Save state and stop (resume with `/flow.init`)
- **"go back to phase N"** - Revisit a previous phase
- **"focus on X"** - Prioritize remaining questions about topic X
- **"research X"** or **"compare A vs B"** - Pause for research/comparison

Handle these contextually and continue.

---

### Phase 0: Discovery (Always First)

Ask using `AskUserQuestion`:

**Round 1 - Project Identity:**
1. What is this project? (one sentence)
2. What type of software? (CLI, API, web app, library, mobile, etc.)
3. Who is it for? (developers, end users, machines)
4. What stage? (greenfield, brownfield, prototype, rewrite)

**Round 2 - Context:**
5. What already exists? (code, prototypes, docs)
6. What's already decided? (tech constraints, timeline)
7. Team size and composition?
8. Criticality level? (hobby, internal, production, mission-critical)

After Phase 0:
1. Update `.specify/discovery/context.md`
2. Set relevance filters for remaining phases
3. If reference materials mentioned, explore them

---

### Phases 1-10: Domain Questions

For each phase:
1. Announce phase and relevance level
2. Ask questions using `AskUserQuestion`
3. Update `decisions.md` and `state.md` after each answer
4. Track memory document impacts
5. Move to next phase

**Questions must build on previous answers:**
- Bad: "What's your testing strategy?"
- Good: "You said this is a CLI for developers (D-2) running overnight (D-5). How should test failures be surfaced?"

**Phase topics:**
1. Problem & Vision
2. Users & Personas
3. Core Features
4. Technical Architecture
5. Data & Storage
6. Security & Compliance
7. Performance & Scale
8. Testing Strategy
9. Deployment & Operations
10. Future & Extensibility

---

### Phase 11: Memory Bootstrap

Final interview phase:
1. Review all captured decisions
2. Generate draft memory documents
3. Write to `.specify/memory/`
4. Create gap analysis
5. Mark interview complete
6. Continue to Step 2 (Constitution Generation)

---

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

---

## Error Handling

| Error | Response |
|-------|----------|
| No project structure | Create `.specify/` directories |
| Active phase in progress | Warn user, suggest `/flow.orchestrate` |
| Interview incomplete | Resume from saved state |

**On any error:**
```bash
specflow state set "interview.status=error"
```

---

## Context

$ARGUMENTS
