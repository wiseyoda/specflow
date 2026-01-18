# Implementation Checklist: Workflow Consolidation

**Phase**: 0072
**Purpose**: Guide agentic implementation with quality gates

---

## Design Command (`/speckit.design`)

### Structure & Headers
- [ ] Command file starts with YAML frontmatter (description field)
- [ ] User Input section with $ARGUMENTS placeholder
- [ ] Goal section explaining the command purpose
- [ ] Clear phase sections (DISCOVER, SPECIFY, PLAN, TASKS, CHECKLISTS)

### DISCOVER Phase
- [ ] Load phase context from `.specify/phases/NNNN-*.md`
- [ ] Examine codebase for related implementations
- [ ] Read memory documents (constitution.md, tech-stack.md)
- [ ] Ask progressive clarifying questions (max 5 rounds)
- [ ] Create discovery.md with findings

### SPECIFY Phase
- [ ] Create spec.md using template structure
- [ ] Create requirements.md checklist
- [ ] Handle inline clarifications (max 3 questions)
- [ ] Use `AskUserQuestion` with recommended options

### PLAN Phase
- [ ] Create plan.md with technical context
- [ ] Constitution compliance check included
- [ ] Generate research.md if needed
- [ ] Generate data-model.md if needed

### TASKS Phase
- [ ] Create tasks.md from plan
- [ ] Organize by user story priority
- [ ] Include dependency markers
- [ ] Add progress dashboard section

### CHECKLISTS Phase
- [ ] Create checklists/implementation.md
- [ ] Create checklists/verification.md
- [ ] Both generated without asking scope questions

### Cascade Flags
- [ ] `--spec` starts from SPECIFY (skips DISCOVER)
- [ ] `--plan` starts from PLAN (skips DISCOVER, SPECIFY)
- [ ] `--tasks` starts from TASKS
- [ ] `--checklist` starts from CHECKLISTS only
- [ ] Each flag regenerates current + all downstream artifacts

### State Tracking
- [ ] Track design substep for resumability
- [ ] Discovery always re-runs when design resumes
- [ ] State updates via CLI commands (not direct edits)

---

## Orchestrate Updates

### Workflow Steps
- [ ] Update workflow table: 4 steps instead of 9
- [ ] Step names: design, analyze, implement, verify
- [ ] Step indices: 0, 1, 2, 3

### State Migration
- [ ] Detect old indices (0-8)
- [ ] Map to new indices (0-3) automatically
- [ ] Old design-related steps (0-4, 6) → 0
- [ ] Old analyze (5) → 1
- [ ] Old implement (7) → 2
- [ ] Old verify (8) → 3

### Status Display
- [ ] Show 4 rows in status table
- [ ] Each step shows status and artifacts
- [ ] Current step highlighted

### Skip-to Argument
- [ ] Accept: design, analyze, implement, verify
- [ ] Reject old step names with helpful error

---

## Roadmap Backlog

### Subcommand Structure
- [ ] Add `backlog` to roadmap command argument parsing
- [ ] Document in Arguments section
- [ ] Include in Usage Examples

### Functionality
- [ ] List backlog items grouped by source phase
- [ ] Support `--auto` for auto-assignment
- [ ] Support `--dry-run` for preview
- [ ] Maintain same behavior as old `/speckit.backlog`

---

## Deprecation Stubs

### Format (each stub)
- [ ] YAML frontmatter with deprecation description
- [ ] "## DEPRECATED" header
- [ ] Clear reason for deprecation
- [ ] Migration code block showing OLD vs NEW
- [ ] Reference to replacement command

### Content (~30 lines each)
- [ ] speckit.specify.md → design
- [ ] speckit.clarify.md → design
- [ ] speckit.plan.md → design --plan
- [ ] speckit.tasks.md → design --tasks
- [ ] speckit.checklist.md → design --checklist
- [ ] speckit.backlog.md → roadmap backlog

---

## Documentation

### CLAUDE.md
- [ ] Update workflow steps description
- [ ] Reference new 4-step flow
- [ ] Update command list if needed

### docs/commands-analysis.md
- [ ] Update command count (11 → 6)
- [ ] Mark deprecated commands
- [ ] Add new design command entry
