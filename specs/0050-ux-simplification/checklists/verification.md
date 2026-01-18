# Verification Checklist: UX Simplification

**Phase**: 0050
**Created**: 2026-01-11
**Purpose**: Post-completion verification for `/specflow.verify`

---

## Gate Requirements (Must Pass)

### G1: Orphaned Scripts Cleanup
- [ ] `.specify/scripts/bash/` directory does not exist
- [ ] No duplicate `common.sh` files in repository
- [ ] All scripts in `scripts/bash/` are referenced in `bin/specflow`

### G2: Slash Command Removal
- [ ] `commands/specflow.issue.md` file deleted
- [ ] `specflow issue` CLI remains functional
- [ ] No references to `/specflow.issue` in documentation

### G3: Memory Command Consolidation
- [ ] `/specflow.memory generate` produces expected output
- [ ] `/specflow.memory-init` errors with clear message pointing to new command
- [ ] No confusion between memory commands in documentation

### G4: Entry Point Consolidation
- [ ] All 11 slash commands have "Continue Later" handoff to `/specflow.start`
- [ ] `README.md` prominently recommends `/specflow.start`
- [ ] `bin/specflow --help` mentions `/specflow.start`

### G5: UI Design Artifacts
- [ ] `templates/ui-design-template.md` exists
- [ ] `/specflow.specify` detects UI keywords in phase scope
- [ ] UI phases auto-create `ui/design.md`
- [ ] `/specflow.plan` verifies design.md for UI phases

### G6: CLAUDE.md Split
- [ ] SpecFlow section in CLAUDE.md ≤15 lines
- [ ] `.specify/USAGE.md` template exists with full reference
- [ ] `specflow claude-md merge` produces minimal output

### G7: State Derivation
- [ ] `specflow status --json` derives step completion from artifacts
- [ ] State recovery works with outdated state file

---

## Functional Verification

### FV1: Commands Still Work
- [ ] `specflow issue create "test"` works
- [ ] `specflow issue list` works
- [ ] `specflow memory generate` works (if applicable)
- [ ] `specflow status` works
- [ ] `specflow claude-md merge` works

### FV2: Documentation Accuracy
- [ ] `docs/cli-reference.md` - accurate, no /specflow.issue
- [ ] `docs/slash-commands.md` - accurate, /specflow.start prominent
- [ ] `docs/integration-guide.md` - workflow examples work
- [ ] `docs/project-structure.md` - matches actual structure
- [ ] `docs/configuration.md` - accurate
- [ ] `docs/troubleshooting.md` - current diagnostics
- [ ] `docs/templates.md` - includes ui-design-template
- [ ] `docs/COMMAND-AUDIT.md` - updated statuses

### FV3: Handoff Verification (spot check)
- [ ] `/specflow.verify` shows "Continue Later" option
- [ ] `/specflow.merge` shows "Continue Later" option
- [ ] `/specflow.specify` shows "Continue Later" option

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
- [ ] `specflow scaffold` still works
- [ ] `specflow state` commands still work
- [ ] `specflow roadmap` commands still work
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
