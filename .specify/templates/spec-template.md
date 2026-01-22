---
version: '1.0'
description: 'Feature specification template'
---

# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

## ID Format Reference

This spec uses standardized IDs for traceability through the workflow:

| ID Format | Type | Example | Used For |
|-----------|------|---------|----------|
| `FR-###` | Functional Requirement | FR-001 | Must-have functionality |
| `NFR-###` | Non-Functional Requirement | NFR-001 | Performance, security, etc. |
| `SC-###` | Success Criteria | SC-001 | Measurable outcomes |
| `US-###` | User Story | US-001 | User journeys |
| `IR-###` | Inherited Requirement | IR-001 | Deferred from prior phase |

**Traceability chain**: Phase Goal → FR-### → T### → V-###

---

## Inherited Requirements _(if applicable)_

<!--
  This section is populated automatically when handoff files exist from previous phases.
  Each inherited requirement was deferred from a prior phase and MUST be addressed.

  If no handoff files exist, DELETE this entire section.
-->

### From Phase [NNNN] - [Phase Name]

| ID | Requirement | Original Context | Status |
|----|-------------|------------------|--------|
| IR-001 | [Inherited requirement description] | [Why it was deferred] | ⬜ Pending |
| IR-002 | [Inherited requirement description] | [Why it was deferred] | ⬜ Pending |

**Handoff Source**: `.specify/phases/[NNNN]-handoff.md`

**Resolution**:
- Items marked ✅ Incorporated are included in this spec's Requirements section
- Items marked ❌ Rejected are documented in Non-Goals with rationale
- Items marked ➡️ Re-deferred are moved to the next phase's handoff

---

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

---

## Memory Promotion Markers

Use these markers to flag content for promotion to memory documents during archive review:

| Marker | Purpose | Example |
|--------|---------|---------|
| `[PROMOTE]` | Flag content for memory promotion | `[PROMOTE] This pattern works well for async APIs` |
| `[MEMORY]` | Same as PROMOTE | `[MEMORY] Always validate user input at boundaries` |

**When to use**:
- Discoveries that apply beyond this phase (architectural insights, patterns, gotchas)
- Corrections to existing assumptions in memory docs
- New coding standards or conventions established during this phase

**What happens**: During `/flow.memory --archive`, marked content is presented for review and can be promoted to the appropriate memory document (constitution.md, coding-standards.md, tech-stack.md, etc.).
