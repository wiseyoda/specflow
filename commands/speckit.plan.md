---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs:
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
  - label: Continue Later
    agent: speckit.start
    prompt: Resume work on this project
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `speckit context --json` to get FEATURE_DIR, BRANCH, PHASE, and available docs. Set FEATURE_SPEC="${FEATURE_DIR}/spec.md" and IMPL_PLAN="${FEATURE_DIR}/plan.md".

2. **Update State**: Mark step as in-progress:
   ```bash
   speckit state set "orchestration.step.current=plan" "orchestration.step.status=in_progress"
   ```

3. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

4. **UI Design Verification** (if UI phase):

   Check if this is a UI-related phase by scanning spec for keywords:
   `dashboard, form, button, screen, page, view, component, interface, modal, dialog, panel, widget, layout, navigation, menu, sidebar, header, footer`

   If UI keywords found:
   - Verify `ui/design.md` exists in specs directory
   - If missing, create it using `templates/ui-design-template.md`
   - Reference design.md in the plan's implementation approach
   - Add UI verification to acceptance criteria

5. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

6. **Update State**: Mark step as complete (or failed on error):
   ```bash
   # On success:
   speckit state set "orchestration.step.status=complete"

   # On error (e.g., gate violations, unresolved clarifications):
   speckit state set "orchestration.step.status=failed"
   ```

   **Error Handling**: If gate evaluation fails or required clarifications cannot be resolved, mark step as `failed` before reporting the error.

7. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Memory documents update**:
   - Update `.specify/memory/tech-stack.md` with new technologies from this plan
   - Add only new technology, preserve existing entries
   - Update `.specify/memory/patterns.md` if new patterns are introduced

**Output**: data-model.md, /contracts/\*, quickstart.md, updated memory docs

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
