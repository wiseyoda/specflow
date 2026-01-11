# Requirements Checklist: UX Simplification

**Phase**: 0050
**Status**: Draft
**Created**: 2026-01-11

---

## Functional Requirements

### FR-001: Orphaned Script Cleanup
- [ ] Delete `.specify/scripts/bash/setup-plan.sh`
- [ ] Delete `.specify/scripts/bash/update-agent-context.sh`
- [ ] Delete `.specify/scripts/bash/create-new-feature.sh`
- [ ] Delete `.specify/scripts/bash/common.sh`
- [ ] Delete `.specify/scripts/bash/` directory (should be empty)

### FR-002: Slash Command Removal
- [ ] Delete `commands/speckit.issue.md`
- [ ] Verify `speckit issue` CLI remains functional
- [ ] Document CLI usage in appropriate locations

### FR-003: Memory Command Consolidation
- [ ] Update `commands/speckit.memory.md` to handle `generate` subcommand
- [ ] Update `commands/speckit.memory-init.md` with deprecation notice
- [ ] Ensure `/speckit.memory generate` works correctly

### FR-004: Entry Point Consolidation
- [ ] Update `README.md` to recommend `/speckit.start`
- [ ] Update `bin/speckit` help text to recommend `/speckit.start`
- [ ] Update all slash command handoffs (10 commands)

### FR-005: Documentation Split
- [ ] Create `.specify/USAGE.md` with full CLI reference
- [ ] Update `CLAUDE.md` to minimal section (≤15 lines)
- [ ] Update `speckit claude-md merge` command for minimal approach

### FR-006: docs/ Folder Updates
- [ ] Update `docs/cli-reference.md`
- [ ] Update `docs/slash-commands.md`
- [ ] Update `docs/integration-guide.md`
- [ ] Verify `docs/project-structure.md` accuracy
- [ ] Verify `docs/configuration.md` accuracy
- [ ] Update `docs/troubleshooting.md`
- [ ] Verify `docs/templates.md` accuracy
- [ ] Update or archive `docs/COMMAND-AUDIT.md`

### FR-007: State Derivation
- [ ] Update `scripts/bash/speckit-status.sh` for artifact-based derivation
- [ ] Verify `speckit status --json` reports derived state
- [ ] Test recovery with outdated state file

### FR-008: UI Design Artifacts
- [ ] Add UI detection logic to `/speckit.specify`
- [ ] Create `templates/ui-design-template.md`
- [ ] Auto-create `specs/XXXX/ui/design.md` for UI phases
- [ ] Add design verification to `/speckit.plan`

---

## Non-Functional Requirements

### NFR-001: Backward Compatibility
- [ ] Existing workflows continue to work
- [ ] Existing state files remain valid
- [ ] No migration required for users

### NFR-002: Constitution Compliance
- [ ] POSIX-compliant bash (Principle II)
- [ ] CLI over direct edits (Principle III)
- [ ] Helpful error messages (Principle V)
- [ ] Three-line output rule (Principle VII)

### NFR-003: Documentation Quality
- [ ] All updated docs are accurate
- [ ] No stale references to removed commands
- [ ] Clear deprecation notices where applicable

---

## Verification Criteria

### VC-001: Gate Check
- [ ] 0 scripts in `.specify/scripts/bash/`
- [ ] `/speckit.issue` slash command removed
- [ ] `/speckit.memory generate` works
- [ ] Documentation recommends `/speckit.start`
- [ ] `speckit status --json` derives from artifacts
- [ ] UI phases get `ui/design.md`
- [ ] CLAUDE.md section ≤15 lines
- [ ] `.specify/USAGE.md` exists
