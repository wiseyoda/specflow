# Requirements Checklist: SpecFlow Rebrand

## Functional Requirements

### Binary & CLI
- [ ] FR-001: CLI binary named `specflow`
- [ ] FR-002: CLI responds to all subcommands
- [ ] FR-003: Internal script references use `specflow`

### Slash Commands
- [ ] FR-004: 10 active commands renamed to `/flow.*`
- [ ] FR-005: Command files named `flow.*.md`
- [ ] FR-006: Internal references use `/flow.*` syntax

### File System Paths
- [ ] FR-007: Install directory is `~/.claude/specflow-system/`
- [ ] FR-008: User config directory is `~/.specflow/`
- [ ] FR-009: Project directory remains `.specify/`

### Environment Variables
- [ ] FR-010: All env vars renamed `SPECKIT_*` → `SPECFLOW_*`

### Scripts
- [ ] FR-011: Scripts renamed `speckit-*.sh` → `specflow-*.sh`
- [ ] FR-012: Script internal references updated

### Documentation
- [ ] FR-013: README.md uses SpecFlow branding
- [ ] FR-014: CLAUDE.md references `/flow.*` commands
- [ ] FR-015: All docs/*.md use SpecFlow branding
- [ ] FR-016: All memory documents use SpecFlow branding

### Clean Break
- [ ] FR-017: Deprecated command files deleted
- [ ] FR-018: No deprecation stubs
- [ ] FR-019: Repository renamed to `specflow`

## Success Criteria

- [ ] SC-001: grep for "speckit" returns 0 results
- [ ] SC-002: `specflow help` displays correctly
- [ ] SC-003: All `/flow.*` commands load
- [ ] SC-004: install.sh works with new paths
- [ ] SC-005: Repo URL is wiseyoda/specflow
