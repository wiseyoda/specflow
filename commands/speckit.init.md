# SpecKit Project Initialization

You are conducting a requirements interview for a software project using the SpecKit Spec-Driven Development (SDD) methodology. This is a universal, adaptive framework that works for any project type and outputs directly into the `.specify/` folder structure.

## Overview

This is the **first command** to run when starting a new SpecKit project. It combines requirements discovery with SDD folder setup, creating the foundation for all subsequent `/speckit.*` commands.

## Setup: Create Project Structure

Use the SpecKit CLI to create the project structure:

```bash
# Check current project status
speckit scaffold --status

# Create the complete .specify/ structure
speckit scaffold

# Force recreate (if needed)
speckit scaffold --force
```

The `speckit scaffold` command creates:
- `.specify/discovery/` - context.md, state.md, decisions.md
- `.specify/memory/adrs/` - Memory documents directory
- `.specify/templates/` - Copies templates from user-scope
- `.specify/scripts/bash/` - Copies scripts from user-scope
- `.specify/archive/` - Archive directory
- `specs/` - Feature specifications directory

If creating manually, follow the templates below:

### 1. Create `.specify/discovery/context.md` if missing:
```markdown
# Project Context

## Project Identity
| Field | Value |
|-------|-------|
| **Project Name** | (TBD - set in Phase 0) |
| **One-line Description** | (TBD) |
| **Project Type** | (TBD) |
| **Target Users** | (TBD) |
| **Stage** | (TBD - greenfield/brownfield/rewrite) |
| **Criticality** | (TBD - prototype/internal/production/mission-critical) |

## Relevance Filters
(Set after Phase 0 - marks which phases to emphasize/skip)

## Constraints & Givens
(Populated during interview)

## Reference Materials
(Documents, code, prototypes mentioned during discovery)
```

### 2. Create `.specify/discovery/state.md` if missing:
```markdown
# Interview State

## Session Info
| Field | Value |
|-------|-------|
| **Started** | (timestamp) |
| **Current Phase** | 0 |
| **Current Question** | 1 |
| **Total Decisions** | 0 |

## Phase Progress
| Phase | Status | Decisions | Memory Docs Affected |
|-------|--------|-----------|---------------------|
| 0: Discovery | pending | 0 | context.md |
| 1: Problem & Vision | pending | 0 | constitution.md |
| 2: Users & Stakeholders | pending | 0 | glossary.md, ux-patterns.md |
| 3: Functional | pending | 0 | api-standards.md, glossary.md |
| 4: Non-Functional | pending | 0 | constitution.md, security-checklist.md, performance-budgets.md |
| 5: Architecture | pending | 0 | tech-stack.md, coding-standards.md, adrs/ |
| 6: Errors & Recovery | pending | 0 | security-checklist.md, api-standards.md |
| 7: UX | pending | 0 | design-system.md, ux-patterns.md |
| 8: Operations | pending | 0 | performance-budgets.md |
| 9: Testing | pending | 0 | testing-strategy.md |
| 10: Evolution | pending | 0 | constitution.md |
| 11: Memory Bootstrap | pending | 0 | All memory docs |

## Contradictions
(populated if conflicts detected)

## Open Questions
(populated during interview)
```

### 3. Create `.specify/discovery/decisions.md` if missing:
```markdown
# Requirements Decisions Log

> Decisions captured during `/speckit.init` interview. These feed into memory document generation.

## Decision Index
| ID | Phase | Title | Confidence | Memory Doc Impact |
|----|-------|-------|------------|-------------------|

## Progress
- **Decisions Made**: 0
- **Open Questions**: 0
- **Contradictions**: 0

---
<!-- Decisions appended below -->
```

### 4. Create folder structure:
```bash
mkdir -p .specify/discovery
mkdir -p .specify/memory/adrs
mkdir -p .specify/templates
mkdir -p .specify/scripts/bash
mkdir -p .specify/archive
mkdir -p specs
```

### 5. Copy templates from user-scope to project-scope:
```bash
# Copy templates if user-scope templates exist
if [ -d "$HOME/.claude/speckit-system/templates" ]; then
  cp -n "$HOME/.claude/speckit-system/templates/"*.md .specify/templates/ 2>/dev/null || true
  cp -n "$HOME/.claude/speckit-system/templates/"*.yaml .specify/templates/ 2>/dev/null || true
  echo "Copied templates from user-scope to .specify/templates/"
fi
```

**Note**: The `-n` flag ensures existing project templates are NOT overwritten. This allows project-specific customizations to persist.

### 6. Copy scripts from user-scope to project-scope:
```bash
# Copy scripts if user-scope scripts exist
if [ -d "$HOME/.claude/speckit-system/scripts/bash" ]; then
  cp -n "$HOME/.claude/speckit-system/scripts/bash/"*.sh .specify/scripts/bash/ 2>/dev/null || true
  chmod +x .specify/scripts/bash/*.sh 2>/dev/null || true
  echo "Copied scripts from user-scope to .specify/scripts/bash/"
fi
```

**Note**: Scripts are copied with `-n` (no-clobber) to preserve project-specific customizations. The `chmod +x` ensures scripts are executable.

## Reference Documents

Read the global templates for question framework and adaptation rules:
- `~/.claude/speckit-system/QUESTION_CATEGORIES.md` - 172 questions across 12 phases with memory doc mappings

## Interview Process

### Phase 0: Discovery (Always First)
Ask 4 questions using AskUserQuestion tool:
1. What is this project? (one sentence description)
2. What type of software? (CLI, API, web app, library, mobile, etc.)
3. Who is it for? (developers, end users, machines)
4. What stage? (greenfield, brownfield, prototype, rewrite)

Then ask 4 more about context:
5. What already exists? (code, prototypes, docs to reference)
6. What's already decided? (tech constraints, timeline)
7. Team size and composition?
8. Criticality level?

After Phase 0:
1. Update `.specify/discovery/context.md` with answers
2. Set relevance filters for remaining phases
3. Create TodoWrite checklist for remaining phases
4. If reference materials mentioned, use Explore agent to analyze them

### Subsequent Phases
For each phase from QUESTION_CATEGORIES.md:
1. Announce phase and its relevance level
2. Ask 4 questions using AskUserQuestion (building on previous answers)
3. After answers: Update decisions.md, state.md
4. Track which memory documents will be affected
5. Check for contradictions
6. Move to next phase

### Phase 11: Memory Bootstrap (Final Phase)
This phase generates draft memory documents:
1. Review all captured decisions
2. For each memory document:
   - Gather relevant decisions
   - Generate draft content
   - Write to `.specify/memory/[doc].md`
3. Create gap analysis report
4. Provide handoff prompt for `/speckit.constitution`

### Decision Format
```markdown
#### D-N: [Title]
- **Phase**: [Phase number and name]
- **Status**: Decided | Tentative | Needs-validation
- **Confidence**: High | Medium | Low
- **Context**: [Why this came up - reference previous decisions]
- **Decision**: [What was decided]
- **Alternatives**: [What was rejected and why]
- **Consequences**: Enables [...], Constrains [...], Requires [...]
- **Dependencies**: [D-X, D-Y]
- **Memory Doc Impact**: [constitution.md, tech-stack.md, etc.]
```

### Building Questions
NEVER ask generic questions after Phase 0. Always reference previous decisions:
- Bad: "What's your testing strategy?"
- Good: "You said this is a CLI for developers (D-2) running unattended overnight (D-5). How should test failures be surfaced?"

## Commands Available During Interview

Use argument format instead of separate commands:

| Command | Purpose |
|---------|---------|
| `/speckit.init status` | Show progress and memory doc coverage |
| `/speckit.init skip` | Skip current phase |
| `/speckit.init revisit N` | Go back to phase N |
| `/speckit.init pause` | Save state and stop |
| `/speckit.init validate` | Check for contradictions and gaps |
| `/speckit.init export FORMAT` | Generate memory docs (constitution, tech-stack, all) |
| `/speckit.init research TOPIC` | Research a topic before deciding |
| `/speckit.init compare A vs B` | Compare options side-by-side |
| `/speckit.init faster` | Accelerate: 4 Qs/round, skip optional phases |
| `/speckit.init deeper` | Slow down: 2 Qs/round, apply 5 Whys |
| `/speckit.init focus TOPIC` | Prioritize questions on a specific topic |

**CLI Tools**: You can also use SpecKit CLI commands for state management:
```bash
# Check project status
speckit doctor

# Validate state file
speckit state validate

# Get current interview state
speckit state get interview
```

## After Interview Completion

When all phases are complete (or user runs `/speckit.init export all`):

1. **Generate Memory Documents**: Create draft `.specify/memory/*.md` files
2. **Create Summary**: Write `.specify/discovery/summary.md`
3. **Handoff to Constitution**: Suggest running `/speckit.constitution` to finalize

```markdown
## Interview Complete!

### Generated Memory Documents (Draft)
- [ ] `.specify/memory/constitution.md` - Review and finalize with `/speckit.constitution`
- [ ] `.specify/memory/tech-stack.md` - [N] technology decisions captured
- [ ] `.specify/memory/coding-standards.md` - [N] conventions documented
- [ ] `.specify/memory/api-standards.md` - [N] API patterns defined
- [ ] `.specify/memory/security-checklist.md` - [N] security requirements
- [ ] `.specify/memory/testing-strategy.md` - [N] test approaches
- [ ] `.specify/memory/glossary.md` - [N] domain terms defined
- [ ] `.specify/memory/adrs/` - [N] architecture decisions

### Gaps Identified
[List any areas with insufficient decisions]

### Next Steps
1. Run `/speckit.constitution` to finalize the constitution
2. Review and refine other memory documents as needed
3. Run `/speckit.roadmap` to create ROADMAP.md with project phases
4. Start development with `/speckit.orchestrate` (or `/speckit.specify` for single phase)
```

## CLI Dependencies

This command uses the SpecKit CLI (`speckit`) for project setup:

```bash
# Verify CLI is available
speckit --help
```

Key CLI commands used:
- `speckit scaffold` - Create project structure (.specify/ folders)
- `speckit state` - State management (get, set, validate)
- `speckit doctor` - Project diagnostics
- `speckit templates` - Template management (check, copy)

## Start Now

1. Run `speckit scaffold` to ensure project structure exists
2. Check if resuming (`speckit state get interview.status` or check `.specify/discovery/state.md`)
3. If resuming: Summarize state, recap recent decisions, continue
4. If new: Begin Phase 0 with AskUserQuestion

## User Input

```text
$ARGUMENTS
```

If arguments provided, use them as context for the project (e.g., project name or initial description).

**Argument handling**:
- `status` - Show current interview status
- `skip` - Skip current phase
- `pause` - Save state and stop
- `continue` - Resume from saved state
- Other text - Use as initial project description
