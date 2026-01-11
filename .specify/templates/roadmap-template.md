---
version: '1.0'
description: 'Project roadmap template'
---

# [PROJECT_NAME] Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds sequentially through phases. Each phase produces a deployable increment.

**Project**: [PROJECT_NAME] - [PROJECT_DESCRIPTION]
**Created**: [CREATED_DATE]
**Status**: [PROJECT_STATUS]

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 001 | [PHASE_001_NAME] | ⬜ Not Started | [PHASE_001_GATE] |
| 002 | [PHASE_002_NAME] | ⬜ Not Started | [PHASE_002_GATE] |
| 003 | [PHASE_003_NAME] | ⬜ Not Started | **USER GATE**: [PHASE_003_GATE] |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Foundation Phases (001-003)

### 001 - [PHASE_001_NAME]

**Goal**: [PHASE_001_GOAL]

**Scope**:
- [PHASE_001_SCOPE_ITEM_1]
- [PHASE_001_SCOPE_ITEM_2]
- [PHASE_001_SCOPE_ITEM_3]

**Deliverables**:
- `[DELIVERABLE_PATH_1]` - [DELIVERABLE_DESCRIPTION_1]
- `[DELIVERABLE_PATH_2]` - [DELIVERABLE_DESCRIPTION_2]

**Verification Gate**:
- [VERIFICATION_CRITERION_1]
- [VERIFICATION_CRITERION_2]

**Estimated Complexity**: [COMPLEXITY_LEVEL] ([COMPLEXITY_JUSTIFICATION])

---

### 002 - [PHASE_002_NAME]

**Goal**: [PHASE_002_GOAL]

<!-- Include this section if previous phase had deferred items targeting this phase -->
**Deferred from Previous Phases** (see `specs/001-[name]/checklists/deferred.md`):
- [DEFERRED_ITEM_1]
- [DEFERRED_ITEM_2]

**Scope**:
- [PHASE_002_SCOPE_ITEM_1]
- [PHASE_002_SCOPE_ITEM_2]

**Deliverables**:
- `[DELIVERABLE_PATH]` - [DELIVERABLE_DESCRIPTION]

**Verification Gate**:
- [VERIFICATION_CRITERION]

**Estimated Complexity**: [COMPLEXITY_LEVEL]

---

### 003 - [PHASE_003_NAME]

**Goal**: [PHASE_003_GOAL] - POC to verify core functionality.

**Scope**:
- [POC_SCOPE_ITEM_1]
- [POC_SCOPE_ITEM_2]

**Deliverables**:
- `src/app/poc/[POC_NAME]/page.tsx` - POC test page
- [OTHER_DELIVERABLES]

**Verification Gate**: **USER VERIFICATION REQUIRED**
- User can [USER_ACTION_1]
- User can [USER_ACTION_2]
- [SPECIFIC_TESTABLE_CRITERION]

**Estimated Complexity**: [COMPLEXITY_LEVEL]

---

## [SECTION_NAME] Phases (NNN-NNN)

<!-- Add more phase sections as needed -->

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| **Gate 1** | 003 | [GATE_1_DESCRIPTION] |
| **Gate 2** | NNN | [GATE_2_DESCRIPTION] |

---

## Phase Sizing Guidelines

Each phase is designed to be:
- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:
1. Cut scope to MVP for that phase
2. Document deferred items in `specs/[phase]/checklists/deferred.md`
3. Update next phase's section with "Deferred from Previous Phases"
4. Prioritize verification gate requirements

### Deferred Items Flow
When items are deferred from a phase:
1. `/speckit.verify` creates `checklists/deferred.md` with full documentation
2. ROADMAP.md next phase section gets updated with reference
3. `/speckit.specify` for next phase automatically checks for inherited items
4. Items not assigned to a specific phase go to project `BACKLOG.md`

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.specify "Phase NNN - [Phase Name]"
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Note completion date
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases
- Insert at appropriate position
- Renumber subsequent phases if needed
- Update phase overview table
- Consider dependencies on previous phases

---

## Notes

- [PROJECT_SPECIFIC_NOTE_1]
- [PROJECT_SPECIFIC_NOTE_2]
