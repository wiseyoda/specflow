# Requirements Checklist: Code Review Findings

**Phase**: 0041 - Code Review Findings
**Created**: 2026-01-11
**Total Requirements**: 36 (mapped from review findings)

## Best Practices (BP) - 6 items

- [ ] **FR-BP001**: Remove unsafe eval() in check-prerequisites.sh:82
- [ ] **FR-BP002**: Upgrade check-prerequisites.sh:22 to `set -euo pipefail`
- [ ] **FR-BP003**: Remove jq debug leftover in specflow-state.sh:624
- [ ] **FR-BP004**: Quote parameter expansion in specflow-context.sh:307
- [ ] **FR-BP005**: Add comment for magic number in specflow-roadmap.sh:743
- [ ] **FR-BP006**: Add input validation error check in specflow-feature.sh:71-80

## Refactoring (RF) - 7 items

- [ ] **FR-RF001**: Extract cmd_migrate() (395 lines) and cmd_infer() (188 lines) into smaller functions
- [ ] **FR-RF002**: Simplify registry clean in specflow-state.sh:604-645 to single jq approach
- [ ] **FR-RF003**: Extract duplicate registry manipulation patterns to helpers
- [ ] **FR-RF004**: Use state machine pattern for state inference in specflow-state.sh:1318
- [ ] **FR-RF005**: Make scaffold path logic data-driven in specflow-scaffold.sh:770-957
- [ ] **FR-RF006**: Create shared validation lib for phase validation regex
- [ ] **FR-RF007**: Add error handling on external commands in specflow-import.sh

## Hardening (HD) - 4 items

- [ ] **FR-HD001**: Sanitize user input before jq/grep in specflow-state.sh, specflow-roadmap.sh
- [ ] **FR-HD002**: Add trap cleanup for temp files in specflow-state.sh, specflow-roadmap.sh
- [ ] **FR-HD003**: Add require_* checks for external dependencies in specflow-roadmap.sh
- [ ] **FR-HD004**: Use grep -F or escape variables in specflow-roadmap.sh patterns

## Missing Features (MF) - 3 items

- [ ] **FR-MF001**: Validate non-placeholder goals in specflow-roadmap.sh:626 insert mode
- [ ] **FR-MF002**: Extend specflow-gate.sh:363 to support pytest, go test, bats
- [ ] **FR-MF003**: Add backlog priority tracking/sorting to specflow-roadmap.sh:1156

## Orphaned Code (OC) - 4 items

- [ ] **FR-OC001**: Delete legacy check-prerequisites.sh (both instances)
- [ ] **FR-OC002**: Update specflow.specify.md:57-60 from create-new-feature.sh to specflow feature create
- [ ] **FR-OC003**: Remove legacy init-*.md references from CLAUDE.md:83
- [ ] **FR-OC004**: Inline/delete unused helpers (escape_for_sed, today_date) in specflow-roadmap.sh

## Over-Engineering (OE) - 4 items

- [ ] **FR-OE001**: (DEFERRED) Migrate phase data to JSON state - high effort architectural change
- [ ] **FR-OE002**: (DEFERRED) Split specflow-state.sh into state.sh + registry.sh - high effort
- [ ] **FR-OE003**: Store status as text, convert to emoji for display only
- [ ] **FR-OE004**: Use validation config file for check_sections() parameters

## Outdated Docs (OD) - 8 items

- [ ] **FR-OD001**: Replace YOUR_USERNAME placeholder in README.md:3 badge
- [ ] **FR-OD002**: Replace YOUR_USERNAME placeholders in README.md:29,63,326 install commands
- [ ] **FR-OD003**: Fix ROADMAP.md:33-40 status icons to match legend
- [ ] **FR-OD004**: Add lib/json.sh and lib/detection.sh to CLAUDE.md:29-45 architecture diagram
- [ ] **FR-OD005**: Update specflow.specify.md:57-60 to reference specflow feature create
- [ ] **FR-OD006**: (DEFERRED) Split specflow.memory.md - low impact, works as-is
- [ ] **FR-OD007**: Add "Customizing Templates" section to README.md
- [ ] **FR-OD008**: Update README.md:328-337 to match actual CLI syntax

---

## Summary

| Category | Total | Implemented | Deferred |
|----------|-------|-------------|----------|
| Best Practices | 6 | 0 | 0 |
| Refactoring | 7 | 0 | 0 |
| Hardening | 4 | 0 | 0 |
| Missing Features | 3 | 0 | 0 |
| Orphaned Code | 4 | 0 | 0 |
| Over-Engineering | 4 | 0 | 2 |
| Outdated Docs | 8 | 0 | 1 |
| **Total** | **36** | **0** | **3** |

**Net Implementation Required**: 33 findings
