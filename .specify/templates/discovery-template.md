---
version: '1.0'
description: 'Pre-specification discovery document for codebase context and scope clarification'
---

# Discovery: [PHASE NAME]

**Phase**: `[NNNN-phase-name]`
**Created**: [DATE]
**Status**: In Progress

## Phase Context

**Source**: [ROADMAP phase / PDR / User request]
**Goal**: [Brief summary of what this phase aims to achieve]

---

## Codebase Examination

### Related Implementations

<!--
  Document existing code that touches the same area as this change.
  Include file paths, function names, and brief descriptions.
-->

| Location | Description | Relevance |
|----------|-------------|-----------|
| `[file:line]` | [What this code does] | [How it relates to this change] |

### Existing Patterns & Conventions

<!--
  Document patterns found in the codebase that should be followed.
-->

- **[Pattern Name]**: [Description and location where it's used]
- **[Convention]**: [How similar features are typically implemented]

### Integration Points

<!--
  Document where this change will need to integrate with existing code.
-->

- **[System/Component]**: [How integration will work]

### Constraints Discovered

<!--
  Technical or architectural constraints found during examination.
-->

- **[Constraint]**: [Description and impact on implementation]

---

## Requirements Sources

### From ROADMAP/Phase File

- [Requirement or goal from phase definition]

### From Related Issues

```bash
specflow issue list --phase [NNNN]
```

| Issue | Description | Priority |
|-------|-------------|----------|
| [ISSUE-XXX] | [Description] | [High/Medium/Low] |

### From Previous Phase Handoffs

<!--
  Deferred items from previous phases that apply here.
-->

- [Inherited requirement from handoff file]

### From Memory Documents

- **Constitution**: [Relevant principles that apply]
- **Tech Stack**: [Approved technologies to use]

---

## Scope Clarification

### Questions Asked

<!--
  Record the progressive questions asked and answers received.
-->

#### Question 1: [Topic]

**Context**: [What was found in codebase that prompted this question]

**Question**: [The specific question asked]

**Options Presented**:
- A (Recommended): [Option and why recommended]
- B: [Alternative option]

**User Answer**: [Selected option or custom response]

**Research Done**: [Any follow-up investigation based on answer]

---

#### Question 2: [Topic]

**Context**: [Context for this question]

**Question**: [The question]

**Options Presented**:
- A (Recommended): [Option]
- B: [Option]

**User Answer**: [Answer]

---

### Confirmed Understanding

<!--
  Summarize the confirmed understanding before proceeding to SPECIFY.
-->

**What the user wants to achieve**:
[Summary of goals]

**How it relates to existing code**:
[Summary of integration approach]

**Key constraints and requirements**:
- [Constraint 1]
- [Requirement 1]

**Technical approach (if discussed)**:
[Any agreed-upon technical direction]

**User confirmed**: [Yes/No - Date]

---

## Recommendations for SPECIFY

<!--
  Notes for the specification phase based on discovery.
-->

### Should Include in Spec

- [Feature/requirement that should be in scope]

### Should Exclude from Spec (Non-Goals)

- [Feature/requirement that should be out of scope]

### Potential Risks

- [Risk identified during discovery]

### Questions to Address in CLARIFY

- [Remaining ambiguity to resolve in clarify phase]
