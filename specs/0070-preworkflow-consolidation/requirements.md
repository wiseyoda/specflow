# Requirements Checklist: Pre-Workflow Commands Consolidation

**Phase**: 0070-preworkflow-consolidation
**Created**: 2026-01-17
**Status**: Tracking

---

## Functional Requirements

### FR-100: Init Command Expansion

- [ ] FR-101: `/speckit.init` runs complete setup flow: interview → constitution → memory docs → roadmap
- [ ] FR-102: `/speckit.init` is idempotent - detects completed steps and skips them
- [ ] FR-103: `/speckit.init` detects template placeholders vs completed content
- [ ] FR-104: `/speckit.init` preserves existing completed artifacts
- [ ] FR-105: `/speckit.init` provides `--force` flag to regenerate all artifacts

### FR-200: Deprecation Stubs

- [ ] FR-201: `/speckit.start` displays deprecation notice → `/speckit.orchestrate`
- [ ] FR-202: `/speckit.constitution` displays deprecation notice → `/speckit.init`
- [ ] FR-203: `/speckit.phase` displays deprecation notice → `/speckit.roadmap add-pdr`
- [ ] FR-204: `/speckit.memory-init` file deleted
- [ ] FR-205: All deprecation stubs are minimal (<50 lines)

### FR-300: Memory Command Reduction

- [ ] FR-301: `/speckit.memory` supports `verify` functionality
- [ ] FR-302: `/speckit.memory` supports `reconcile` functionality
- [ ] FR-303: `/speckit.memory` supports `promote` functionality
- [ ] FR-304: `/speckit.memory` does NOT include `generate` subcommand
- [ ] FR-305: Attempting `generate` shows helpful message about `/speckit.init`

### FR-400: Roadmap Command Expansion

- [ ] FR-401: `/speckit.roadmap` supports `add-pdr` as subcommand (first positional arg)
- [ ] FR-402: `add-pdr` lists available PDRs when none specified
- [ ] FR-403: `add-pdr` accepts PDR filename as second positional argument
- [ ] FR-404: `add-pdr` marks PDRs as processed after conversion
- [ ] FR-405: Existing roadmap functionality continues working
- [ ] FR-406: Argument routing documented in table format

### FR-500: Documentation Updates

- [ ] FR-501: CLAUDE.md updated with new command structure
- [ ] FR-502: docs/commands-analysis.md updated with new command inventory
- [ ] FR-503: Command handoffs referencing deprecated commands updated
- [ ] FR-504: Workflow diagrams reflect new 3-command pre-workflow structure

---

## Success Criteria

- [ ] SC-001: Pre-workflow command count = 3 active + 3 deprecation stubs
- [ ] SC-002: `/speckit.init` sets up project from zero to ready-for-orchestrate
- [ ] SC-003: All deprecated commands show helpful redirect messages
- [ ] SC-004: Existing projects continue to work without changes
- [ ] SC-005: No functionality lost in consolidation

---

## Summary

| Category | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| FR-100 Init | 5 | 0 | 5 |
| FR-200 Deprecation | 5 | 0 | 5 |
| FR-300 Memory | 5 | 0 | 5 |
| FR-400 Roadmap | 6 | 0 | 6 |
| FR-500 Documentation | 4 | 0 | 4 |
| Success Criteria | 5 | 0 | 5 |
| **Total** | **30** | **0** | **30** |
