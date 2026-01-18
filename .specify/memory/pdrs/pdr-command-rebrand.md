# PDR: Command Rebrand to Flow

<!--
  IMPORTANT: This document captures PRODUCT requirements, not TECHNICAL requirements.
  Focus on WHAT the feature should do and WHY it matters.
  Do NOT include: architecture, code structure, implementation details, or technology choices.
-->

**PDR ID**: `pdr-command-rebrand`
**Created**: 2026-01-17
**Author**: Agent (with user input)
**Status**: Approved
**Priority**: P1

---

## Problem Statement

**The Problem**: All commands currently use the `/specflow.*` prefix, which ties the tool to the "SpecFlow" brand. This is confusing because:
1. The tool has evolved beyond extending SpecFlow - it replaces the workflow entirely
2. "SpecFlow" implies a toolkit addon, not a complete AI-native development flow
3. The branding doesn't convey the agentic, workflow-driven nature of the tool

**Who is affected**: All users, all documentation, all references across the codebase.

**Current workaround**: None - the naming is baked into every command and document.

**Why now**: After consolidating pre-workflow (0070) and workflow (0072) commands, we'll have a clean, minimal command set. This is the right time to rebrand before more documentation and integrations are built.

---

## Desired Outcome

**After this feature ships, users will be able to**:
- Use `/flow.*` commands that clearly convey workflow-driven, AI-native development
- Find consistent naming across all documentation, CLAUDe.md, and the website
- Understand the tool as a complete development flow, not a toolkit addon

**The experience should feel**: Modern, AI-native, workflow-oriented

---

## User Stories

### Story 1: Intuitive Command Discovery
**As a** new user,
**I want to** see commands prefixed with `/flow`,
**So that** I immediately understand this is about development workflows, not a toolkit.

**Value**: Clear mental model from first interaction.

---

### Story 2: Consistent Documentation
**As a** user reading documentation,
**I want to** see `/flow.*` commands everywhere (docs, CLAUDE.md, website),
**So that** I'm never confused by outdated `/specflow.*` references.

**Value**: Professional, polished experience with no legacy cruft.

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| Command prefix | All commands use `/flow.*` | Grep for `/specflow` returns 0 results |
| Documentation | All docs updated | Manual review of all .md files |
| CLAUDE.md | Updated with new commands | File review |
| Website/dashboard | Updated references | UI review |
| Backwards compat | Old commands show deprecation | Test deprecated commands |

---

## Constraints

- **Must**: Update ALL command files in `commands/`
- **Must**: Update ALL documentation references
- **Must**: Update CLAUDE.md with new command names
- **Must**: Rename CLI binary from `specflow` to `specflow`
- **Must**: Rename GitHub repository to `specflow`
- **Must**: Update all CLI scripts to use new binary name
- **Must**: Clean break - no deprecation stubs or legacy references
- **Must Not**: Leave any `/specflow.*` references in active code/docs

---

## Non-Goals

- **Not solving**: Command consolidation (handled by 0070 and 0072)
- **Not solving**: New functionality - this is purely a rename/rebrand

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| Phase 0070 | Blocking | Pre-workflow consolidation must complete first | Not Started |
| Phase 0072 | Blocking | Workflow consolidation must complete first | Not Started |

---

## Open Questions

- [x] Should the CLI binary also be renamed from `specflow` to `flow`? → **Answer**: Rename to `specflow`
- [x] How long should deprecation stubs exist before removal? → **Answer**: Remove completely. No deprecation stubs, clean break.
- [x] Should we update the GitHub repo name? → **Answer**: Yes. Rename to `specflow`. Brand: "SpecFlow (Agentic Orchestration based on SpecFlow)"

---

## Acceptance Criteria

1. [ ] GitHub repository renamed to `specflow`
2. [ ] CLI binary renamed from `specflow` to `specflow`
3. [ ] All command files renamed from `specflow.*.md` to `flow.*.md`
4. [ ] All command content updated to reference `/flow.*` instead of `/specflow.*`
5. [ ] All bash scripts updated: `bin/specflow` → `bin/specflow`, all internal references
6. [ ] CLAUDE.md updated with new command names, binary name, and branding
7. [ ] `docs/commands-analysis.md` updated with new names
8. [ ] All memory documents updated if they reference commands
9. [ ] Dashboard/website references updated
10. [ ] README and installation docs updated with new branding
11. [ ] No grep results for `specflow` in active code/documentation
12. [ ] install.sh updated for new binary name

---

## Related PDRs

- `pdr-preworkflow-consolidation` - Must complete first (establishes 3 pre-workflow commands)
- `pdr-workflow-consolidation` - Must complete first (establishes 6 workflow commands)

---

## Command Mapping

### Final Command Set (after 0070, 0072, and 0076)

| Old Name | New Name | Role |
|----------|----------|------|
| `/specflow.init` | `/flow.init` | Complete project setup |
| `/specflow.memory` | `/flow.memory` | Memory health: verify, reconcile, promote |
| `/specflow.roadmap` | `/flow.roadmap` | Roadmap ops: update, add-pdr, backlog |
| `/specflow.orchestrate` | `/flow.orchestrate` | Master workflow controller |
| `/specflow.design` | `/flow.design` | Create all design artifacts |
| `/specflow.analyze` | `/flow.analyze` | Pre-implement alignment check |
| `/specflow.implement` | `/flow.implement` | Execute tasks |
| `/specflow.verify` | `/flow.verify` | Post-implement completion check |
| `/specflow.merge` | `/flow.merge` | Git operations |
| `/specflow.review` | `/flow.review` | Code review |

**Total: 10 commands** (down from 20)

### Removed Commands

| Command | Reason |
|---------|--------|
| `/specflow.start` | Deprecated in 0070, absorbed into init |
| `/specflow.constitution` | Deprecated in 0070, absorbed into init |
| `/specflow.memory-init` | Already deprecated, deleted in 0070 |
| `/specflow.phase` | Deprecated in 0070, absorbed into roadmap |
| `/specflow.specify` | Deprecated in 0072, absorbed into design |
| `/specflow.clarify` | Deprecated in 0072, inline in orchestrate |
| `/specflow.plan` | Deprecated in 0072, absorbed into design |
| `/specflow.tasks` | Deprecated in 0072, absorbed into design |
| `/specflow.checklist` | Deprecated in 0072, absorbed into design |
| `/specflow.backlog` | Deprecated in 0072, moved to roadmap subcommand |
| `/specflow.taskstoissues` | Removed in 0072, rarely used |

---

## Files to Update

### Command Files (rename and update content)
- `commands/specflow.*.md` → `commands/flow.*.md`
- `commands/utilities/` → evaluate if still needed

### Documentation
- `CLAUDE.md` - Command references
- `docs/commands-analysis.md` - Full command inventory
- `README.md` - Installation and usage examples
- `.specify/memory/*.md` - Any command references

### Website/Dashboard
- Any UI components showing command names
- Help text and tooltips

---

## Notes

### Brand Identity

**SpecFlow** - Agentic Orchestration based on SpecFlow

The `/flow.*` prefix conveys:
- **Workflow-driven**: Development as a structured flow of phases
- **AI-native**: Designed for agentic coding from the ground up
- **Action-oriented**: Each command represents a clear step in the flow

The `specflow` CLI name:
- Combines "spec" (spec-driven) with "flow" (workflow)
- Clear lineage to SpecFlow while signaling evolution
- Easy to type, memorable

### Migration Strategy

Clean break, no deprecation period:
1. Rename repository and CLI in one release
2. Delete all old command files
3. Update all documentation simultaneously
4. Users on old version continue working; new installs get SpecFlow

