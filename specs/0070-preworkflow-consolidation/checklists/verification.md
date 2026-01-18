# Verification Checklist: Pre-Workflow Commands Consolidation

**Phase**: 0070-preworkflow-consolidation
**Created**: 2026-01-17
**Verified**: 2026-01-17
**Purpose**: Post-completion verification

---

## Deprecation Stubs

### V-100: `/speckit.start` Deprecation

- [x] V-101: File `commands/speckit.start.md` exists and is <50 lines (29 lines)
- [x] V-102: Running `/speckit.start` displays deprecation notice
- [x] V-103: Deprecation notice mentions `/speckit.orchestrate` as replacement
- [x] V-104: File has `description: DEPRECATED` in frontmatter

### V-200: `/speckit.constitution` Deprecation

- [x] V-201: File `commands/speckit.constitution.md` exists and is <50 lines (32 lines)
- [x] V-202: Running `/speckit.constitution` displays deprecation notice
- [x] V-203: Deprecation notice mentions `/speckit.init` as replacement
- [x] V-204: File has `description: DEPRECATED` in frontmatter

### V-300: `/speckit.phase` Deprecation

- [x] V-301: File `commands/speckit.phase.md` exists and is <50 lines (32 lines)
- [x] V-302: Running `/speckit.phase` displays deprecation notice
- [x] V-303: Deprecation notice mentions `/speckit.roadmap add-pdr` as replacement
- [x] V-304: File has `description: DEPRECATED` in frontmatter

### V-400: `/speckit.memory-init` Deletion

- [x] V-401: File `commands/speckit.memory-init.md` does NOT exist

---

## Init Expansion

### V-500: One-Command Setup Flow

- [x] V-501: `/speckit.init` command includes `.specify/` structure creation
- [x] V-502: Interview artifacts step documented in `.specify/discovery/`
- [x] V-503: Constitution step creates `.specify/memory/constitution.md`
- [x] V-504: Memory docs step creates tech-stack.md, etc.
- [x] V-505: Roadmap step creates ROADMAP.md at project root

### V-600: Smart Idempotency

- [x] V-601: Init checks for placeholder patterns before skipping constitution
- [x] V-602: Init regenerates if template placeholders detected
- [x] V-603: Init checks ROADMAP exists and has phases before skipping
- [x] V-604: Skip messages documented (e.g., "✓ Constitution exists (X principles). Skipping...")

### V-700: Pre-flight Checks

- [x] V-701: Pre-flight check section warns if orchestration in progress
- [x] V-702: Warning message is clear about why init cannot proceed
- [x] V-703: `--force` flag documented in argument routing

---

## Memory Reduction

### V-800: Generate Subcommand Removed

- [x] V-801: File `commands/speckit.memory.md` does NOT contain "## Generate Subcommand" section
- [x] V-802: Argument routing table lists "generate" as DEPRECATED
- [x] V-803: Generate Deprecation section shows helpful message about `/speckit.init`

### V-900: Existing Functions Preserved

- [x] V-901: `/speckit.memory` (default) still runs verification flow
- [x] V-902: `--reconcile` flag still documented
- [x] V-903: `--promote` flag still documented

---

## Roadmap Expansion

### V-1000: add-pdr Subcommand

- [x] V-1001: Argument routing table includes `add-pdr` option
- [x] V-1002: Add PDR Subcommand section documents listing PDRs
- [x] V-1003: Section documents converting specific PDR to phase
- [x] V-1004: Section documents marking PDR as processed
- [x] V-1005: Section documents ROADMAP.md phase numbering

### V-1100: Existing Functions Preserved

- [x] V-1101: Empty argument still triggers full roadmap generation
- [x] V-1102: "Other text" in routing still uses as project description

---

## Documentation

### V-1200: CLAUDE.md Updates

- [x] V-1201: v2.2 Key Changes section documents 3 active pre-workflow commands
- [x] V-1202: v2.2 section explicitly lists deprecated commands
- [x] V-1203: v2.2 section notes deprecation stubs

### V-1300: commands-analysis.md Updates

- [x] V-1301: Pre-Workflow Commands section shows 3 active + 3 deprecated + 1 deleted
- [x] V-1302: Line counts updated (~600 init, ~750 memory, ~650 roadmap)
- [x] V-1303: Workflow sequence diagram shows: init → memory → roadmap

### V-1400: Cross-References

- [x] V-1401: No command file has handoff to deprecated command (verified with grep)
- [x] V-1402: All 6 handoffs updated to use `speckit.orchestrate`

---

## Success Criteria

### SC-001: Command Count

- [x] Pre-workflow active commands = 3 (init, memory, roadmap)
- [x] Deprecation stubs = 3 (start, constitution, phase)
- [x] Deleted = 1 (memory-init)

### SC-002: Single-Command Setup

- [x] `/speckit.init` documented with full 4-step flow (discovery → constitution → memory → roadmap)

### SC-003: Deprecation Guidance

- [x] All 3 deprecated commands have deprecation notices
- [x] All notices point to correct replacement commands

### SC-004: Backwards Compatibility

- [x] Existing projects work unchanged (no breaking changes to active commands)
- [x] Memory verify/reconcile/promote preserved
- [x] Roadmap generation preserved

### SC-005: No Functionality Lost

- [x] Constitution creation available via `/speckit.init` (Step 2)
- [x] Memory generation available via `/speckit.init` (Step 3)
- [x] PDR conversion available via `/speckit.roadmap add-pdr`
- [x] Memory verify/reconcile/promote all preserved

---

## Summary

| Category | Total | Checked |
|----------|-------|---------|
| Deprecation Stubs | 13 | 13 |
| Init Expansion | 11 | 11 |
| Memory Reduction | 6 | 6 |
| Roadmap Expansion | 7 | 7 |
| Documentation | 7 | 7 |
| Success Criteria | 13 | 13 |
| **Total** | **57** | **57** |

**Status**: ✅ ALL VERIFICATIONS PASSED
