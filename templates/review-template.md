---
version: '1.0'
description: 'Code review findings template - tracks systematic review findings for triage'
---

# Code Review: [DATE]

**Reviewed By**: [AUTHOR]
**Scope**: [SCOPE]
**Categories Reviewed**: [COUNT]

---

## Summary

| Category | Findings | Approved | Deferred |
|----------|----------|----------|----------|
| Best Practices | 0 | 0 | 0 |
| Refactoring | 0 | 0 | 0 |
| Hardening | 0 | 0 | 0 |
| Missing Features | 0 | 0 | 0 |
| Orphaned Code | 0 | 0 | 0 |
| Over-Engineering | 0 | 0 | 0 |
| Outdated Docs | 0 | 0 | 0 |
| **Total** | **0** | **0** | **0** |

---

## Rating Scale Reference

| Rating | Effort | Impact | Severity |
|--------|--------|--------|----------|
| 1 | Trivial (<30 min) | Minimal improvement | Suggestion |
| 2 | Small (30 min - 2 hr) | Minor improvement | Low priority |
| 3 | Moderate (2-8 hr) | Moderate improvement | Medium priority |
| 4 | Significant (1-3 days) | Significant improvement | High priority |
| 5 | Major (>3 days) | Critical improvement | Blocking issue |

---

## Approved Findings

<!-- Findings approved for implementation in the review phase -->

| ID | Category | File(s) | Effort | Impact | Severity | Finding | Recommendation |
|----|----------|---------|--------|--------|----------|---------|----------------|
| [ID] | [CATEGORY] | [FILES] | [1-5] | [1-5] | [1-5] | [FINDING] | [RECOMMENDATION] |

---

## Deferred Findings

<!-- Findings deferred to backlog for future consideration -->

| ID | Category | File(s) | Effort | Impact | Severity | Finding | Recommendation |
|----|----------|---------|--------|--------|----------|---------|----------------|
| [ID] | [CATEGORY] | [FILES] | [1-5] | [1-5] | [1-5] | [FINDING] | [RECOMMENDATION] |

---

## Review Constraints Applied

- Full codebase review (no incremental mode)
- Does NOT propose brand new features
- Does NOT break existing functionality without confirmation
- Focus on refinement and technical debt reduction

---

## Category Definitions

| Code | Category | Focus |
|------|----------|-------|
| BP | Best Practices | Coding standards violations, anti-patterns, inconsistencies |
| RF | Refactoring | Code duplication, complex functions, poor structure |
| HD | Hardening | Error handling gaps, input validation, security issues |
| MF | Missing Features | TODOs, FIXMEs, stub functions, incomplete implementations |
| OC | Orphaned Code | Unused exports, dead code, unreferenced files |
| OE | Over-Engineering | Excessive abstraction, unused flexibility, premature optimization |
| OD | Outdated Docs | Stale comments, README mismatches, incorrect examples |

---

## Cross-References

- **Phase Created**: [PHASE_NUMBER] - Code Review [DATE]
- **Phase Directory**: `.specify/phases/[PHASE_DIR]/`
- **ROADMAP.md**: Phase entry added
- **Backlog**: Deferred items added with review date reference

---

## How to Use This Document

### For Implementation
1. Run `/specflow.orchestrate` to build spec/plan/tasks from approved findings
2. Each approved finding becomes a requirement in the spec
3. Related findings are grouped into implementation tasks

### For Future Reviews
1. Check deferred items before next review
2. Items may have been resolved or become more urgent
3. Reference this document in subsequent reviews

### For Backlog Management
1. Deferred items are added to ROADMAP.md backlog
2. Run `/specflow.backlog` to triage deferred items into phases
3. Items include the review date for tracking
