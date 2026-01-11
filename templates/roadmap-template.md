---
version: '2.1'
description: 'Project roadmap template with ABBC numbering'
---

# [PROJECT_NAME] Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds sequentially through phases. Each phase produces a deployable increment.

**Project**: [PROJECT_NAME] - [PROJECT_DESCRIPTION]
**Created**: [CREATED_DATE]
**Schema Version**: 2.1 (ABBC numbering)
**Status**: [PROJECT_STATUS]

---

## Phase Numbering (v2.1)

Phases use **ABBC** format:
- **A** = Milestone (0-9) - Major version or project stage
- **BB** = Phase (01-99) - Sequential work within milestone
- **C** = Hotfix (0-9) - Insert slot (0 = main phase, 1-9 = hotfixes/inserts)

**Examples**:
- `0010` = Milestone 0, Phase 01, no hotfix
- `0021` = Hotfix 1 inserted after Phase 02
- `1010` = Milestone 1, Phase 01, no hotfix

This allows inserting urgent work without renumbering existing phases.

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | [PHASE_0010_NAME] | ⬜ Not Started | [PHASE_0010_GATE] |
| 0020 | [PHASE_0020_NAME] | ⬜ Not Started | [PHASE_0020_GATE] |
| 0030 | [PHASE_0030_NAME] | ⬜ Not Started | **USER GATE**: [PHASE_0030_GATE] |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Milestone 0: Foundation

### 0010 - [PHASE_0010_NAME]

**Goal**: [PHASE_0010_GOAL]

**Scope**:
- [PHASE_0010_SCOPE_ITEM_1]
- [PHASE_0010_SCOPE_ITEM_2]
- [PHASE_0010_SCOPE_ITEM_3]

**Deliverables**:
- `[DELIVERABLE_PATH_1]` - [DELIVERABLE_DESCRIPTION_1]
- `[DELIVERABLE_PATH_2]` - [DELIVERABLE_DESCRIPTION_2]

**Verification Gate**:
- [VERIFICATION_CRITERION_1]
- [VERIFICATION_CRITERION_2]

**Estimated Complexity**: [COMPLEXITY_LEVEL] ([COMPLEXITY_JUSTIFICATION])

---

### 0020 - [PHASE_0020_NAME]

**Goal**: [PHASE_0020_GOAL]

<!-- Include this section if previous phase had deferred items targeting this phase -->
**Deferred from Previous Phases** (see `specs/0010-[name]/checklists/deferred.md`):
- [DEFERRED_ITEM_1]
- [DEFERRED_ITEM_2]

**Scope**:
- [PHASE_0020_SCOPE_ITEM_1]
- [PHASE_0020_SCOPE_ITEM_2]

**Deliverables**:
- `[DELIVERABLE_PATH]` - [DELIVERABLE_DESCRIPTION]

**Verification Gate**:
- [VERIFICATION_CRITERION]

**Estimated Complexity**: [COMPLEXITY_LEVEL]

---

### 0030 - [PHASE_0030_NAME]

**Goal**: [PHASE_0030_GOAL] - POC to verify core functionality.

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

## Milestone 1: [MILESTONE_NAME]

### 1010 - [PHASE_1010_NAME]

<!-- Add more phase sections as needed -->

---

## Backlog

Deferred phases waiting for future prioritization.

| Phase | Name | Deferred Date | Reason |
|-------|------|---------------|--------|
| - | - | - | - |

---

## Verification Gates Summary

| Gate | Phase | What User Verifies |
|------|-------|-------------------|
| **Gate 1** | 0030 | [GATE_1_DESCRIPTION] |
| **Gate 2** | NNNN | [GATE_2_DESCRIPTION] |

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
4. Items not assigned to a specific phase go to Backlog section above

---

## How to Use This Document

### Starting a Phase
```
/speckit.orchestrate
```
Or manually:
```
/speckit.specify "Phase NNNN - [Phase Name]"
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Note completion date
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases
Use SpecKit commands:
```bash
# Insert a phase after 0020
speckit roadmap insert --after 0020 "New Phase Name"

# Defer a phase to backlog
speckit roadmap defer 0040

# Restore from backlog
speckit roadmap restore 0040 --after 0030
```

### Migrating from v2.0
If you have a 3-digit phase roadmap:
```bash
speckit migrate roadmap
```
This converts 001→0010, 002→0020, etc.

---

## Notes

- [PROJECT_SPECIFIC_NOTE_1]
- [PROJECT_SPECIFIC_NOTE_2]
