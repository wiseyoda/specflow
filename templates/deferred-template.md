---
version: '1.0'
description: 'Deferred items template - tracks items intentionally postponed from a phase'
---

# Deferred Items - Phase [PHASE_NUMBER]: [PHASE_NAME]

> Items intentionally deferred from this phase with documented rationale and target phases.
> **Created by**: speckit.verify
> **Date**: [DATE]

---

## Summary Table

| Item | Source | Reason | Target Phase |
|------|--------|--------|--------------|
| [ITEM_1] | [SOURCE_FILE:LINE] | [BRIEF_REASON] | Phase [NNNN] |
| [ITEM_2] | [SOURCE_FILE:LINE] | [BRIEF_REASON] | Backlog |

---

## Detailed Rationale

### [ITEM_1]

**Source**: [spec.md / plan.md / tasks.md] - [Section or Line Reference]

**What was requested**:
[Original requirement or feature description]

**Why deferred**:
[Detailed explanation of why this was deferred - scope, dependencies, complexity, etc.]

**What was done instead** (if applicable):
[Any partial implementation or workaround]

**Target Phase**: Phase [NNNN] - [Phase Name]

**Prerequisites for implementing**:
- [Prerequisite 1]
- [Prerequisite 2]

---

### [ITEM_2]

**Source**: [SOURCE_FILE:LINE]

**What was requested**:
[Original requirement]

**Why deferred**:
[Reason]

**What was done instead**:
[Alternative if any, or "N/A"]

**Target Phase**: Backlog (no specific phase assigned)

**Notes**:
[Any additional context]

---

## How to Use This Document

### For Future Phases
When starting a new phase that inherits deferred items:
1. Check the "Target Phase" column in the summary table
2. Reference this file in the new phase's spec.md
3. Copy applicable items into the new spec's scope

### For ROADMAP.md Updates
The roadmap phase entry should include:
```markdown
**Deferred from Previous Phases** (see `specs/[PREV_PHASE]/checklists/deferred.md`):
- [Item 1 brief description]
- [Item 2 brief description]
```

### For Backlog Items
Items marked "Backlog" should also be added to the project-level `BACKLOG.md` file.

---

## Cross-References

- **Source Spec**: `specs/[PHASE_NUMBER]-[name]/spec.md`
- **ROADMAP.md**: See Phase [PHASE_NUMBER] entry
- **Project Backlog**: `BACKLOG.md` (if items added to backlog)
