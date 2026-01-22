---
version: '1.0'
description: 'UI/UX design document template for visual changes'
---

## UI Design Decision Matrix

Use this matrix to determine if ui-design.md is needed for a phase:

| Phase Type | ui-design.md? | Rationale |
|------------|---------------|-----------|
| New UI screens/pages/views | YES | Visual structure needs documentation |
| Significant layout changes | YES | Users need to understand new arrangement |
| Complex user flows | YES | Multi-step interactions need visualization |
| New UI components | YES | Component specs for implementation |
| CLI/terminal tools | NO | No visual interface |
| API/backend services | NO | No user-facing visuals |
| Database/infrastructure | NO | No visual interface |
| Bug fixes/refactoring | NO | Existing UI unchanged |
| Minor UI tweaks | NO | Changes too small to document |
| Existing patterns apply | NO | Reuse existing component specs |

**Decision rule**: If you need to explain WHERE something goes or HOW it looks, create ui-design.md. If the change is purely behavioral or internal, skip it.

---

# UI/UX Design: [Phase Name]

**Phase**: [NNNN]
**Created**: [Date]
**Status**: Draft

---

## Current State (Before)

[Describe the existing UI, or "New feature - no existing UI"]

---

## Proposed Design (After)

[Description of the proposed UI changes]

### Visual Mockup

```
[ASCII art mockup or describe the layout]
┌─────────────────────────────────────────────┐
│  Header / Navigation                        │
├─────────────────────────────────────────────┤
│                                             │
│  Main Content Area                          │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Component │  │ Component │  │ Component │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

---

## Rationale

[Explain the design decisions]

- **Why this layout?** [Reasoning]
- **User flow:** [How users will interact]
- **Accessibility considerations:** [Any a11y notes]

---

## Component Inventory

| Component | Type | Purpose | Notes |
|-----------|------|---------|-------|
| [name] | [button/form/panel/card/etc] | [what it does] | [additional notes] |

---

## Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| [description] | [user action] | [system response] |

---

## Design Constraints

- [Constraint 1]
- [Constraint 2]

---

## Open Questions

- [ ] [Question that needs resolution before implementation]
