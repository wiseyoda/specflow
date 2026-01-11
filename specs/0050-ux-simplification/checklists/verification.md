# Verification Checklist: UX Simplification

**Phase**: 0050
**Created**: 2026-01-11
**Purpose**: Post-completion verification for `/speckit.verify`

---

## Gate Requirements (Must Pass)

### G1: Orphaned Scripts Cleanup
- [ ] `.specify/scripts/bash/` directory does not exist
- [ ] No duplicate `common.sh` files in repository
- [ ] All scripts in `scripts/bash/` are referenced in `bin/speckit`

### G2: Slash Command Removal
- [ ] `commands/speckit.issue.md` file deleted
- [ ] `speckit issue` CLI remains functional
- [ ] No references to `/speckit.issue` in documentation

### G3: Memory Command Consolidation
- [ ] `/speckit.memory generate` produces expected output
- [ ] `/speckit.memory-init` errors with clear message pointing to new command
- [ ] No confusion between memory commands in documentation

### G4: Entry Point Consolidation
- [ ] All 11 slash commands have "Continue Later" handoff to `/speckit.start`
- [ ] `README.md` prominently recommends `/speckit.start`
- [ ] `bin/speckit --help` mentions `/speckit.start`

### G5: UI Design Artifacts
- [ ] `templates/ui-design-template.md` exists
- [ ] `/speckit.specify` detects UI keywords in phase scope
- [ ] UI phases auto-create `ui/design.md`
- [ ] `/speckit.plan` verifies design.md for UI phases

### G6: CLAUDE.md Split
- [ ] SpecKit section in CLAUDE.md ≤15 lines
- [ ] `.specify/USAGE.md` template exists with full reference
- [ ] `speckit claude-md merge` produces minimal output

### G7: State Derivation
- [ ] `speckit status --json` derives step completion from artifacts
- [ ] State recovery works with outdated state file

---

## Functional Verification

### FV1: Commands Still Work
- [ ] `speckit issue create "test"` works
- [ ] `speckit issue list` works
- [ ] `speckit memory generate` works (if applicable)
- [ ] `speckit status` works
- [ ] `speckit claude-md merge` works

### FV2: Documentation Accuracy
- [ ] `docs/cli-reference.md` - accurate, no /speckit.issue
- [ ] `docs/slash-commands.md` - accurate, /speckit.start prominent
- [ ] `docs/integration-guide.md` - workflow examples work
- [ ] `docs/project-structure.md` - matches actual structure
- [ ] `docs/configuration.md` - accurate
- [ ] `docs/troubleshooting.md` - current diagnostics
- [ ] `docs/templates.md` - includes ui-design-template
- [ ] `docs/COMMAND-AUDIT.md` - updated statuses

### FV3: Handoff Verification (spot check)
- [ ] `/speckit.verify` shows "Continue Later" option
- [ ] `/speckit.merge` shows "Continue Later" option
- [ ] `/speckit.specify` shows "Continue Later" option

---

## Constitution Compliance

### CC1: Principle VII - Three-Line Output Rule
- [ ] Any new CLI output follows 3-line rule
- [ ] Status/result on line 1
- [ ] Key data on line 2
- [ ] Next step hint on line 3

### CC2: Principle V - Helpful Error Messages
- [ ] Deprecation error for memory-init includes next steps
- [ ] All error messages are actionable

### CC3: Principle II - POSIX Compliance
- [ ] Modified bash scripts pass shellcheck
- [ ] No bash 4.0+ specific features without fallback

---

## Regression Testing

### RT1: Existing Workflows
- [ ] `speckit scaffold` still works
- [ ] `speckit state` commands still work
- [ ] `speckit roadmap` commands still work
- [ ] Full orchestration workflow functional

### RT2: No Breaking Changes
- [ ] Existing state files still valid
- [ ] No migration required
- [ ] All existing features preserved

---

## Verification Summary

| Category | Items | Required to Pass |
|----------|-------|------------------|
| Gate Requirements | 7 | All |
| Functional Verification | 3 groups | All |
| Constitution Compliance | 3 | All |
| Regression Testing | 2 | All |

**Phase Complete When**: All gate requirements pass and no critical regressions found.
