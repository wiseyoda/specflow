---
phase: 0076
name: command-rebrand
status: not_started
created: 2026-01-17
pdr: pdr-command-rebrand.md
---

### 0076 - Rebrand to SpecFlow

**Goal**: Complete rebrand from SpecFlow to **SpecFlow** (Agentic Orchestration based on SpecFlow). Rename CLI, commands, repository, and all documentation. Clean break with no deprecation stubs.

**Scope**:
- Rename GitHub repository to `specflow`
- Rename CLI binary from `specflow` to `specflow`
- Rename all command files from `specflow.*.md` to `flow.*.md`
- Update all command content to reference `/flow.*`
- Update all bash scripts (`bin/specflow` → `bin/specflow`)
- Update CLAUDE.md with new branding and command names
- Update all documentation (README, commands-analysis, memory docs)
- Update dashboard/website references
- Update install.sh for new binary name
- Clean break: delete all old files, no deprecation stubs

**Commands After Rebrand**:

| New Name | Role |
|----------|------|
| `/flow.init` | Complete project setup |
| `/flow.memory` | Memory health: verify, reconcile, promote |
| `/flow.roadmap` | Roadmap ops: update, add-pdr, backlog |
| `/flow.orchestrate` | Master workflow controller |
| `/flow.design` | Create all design artifacts |
| `/flow.analyze` | Pre-implement alignment check |
| `/flow.implement` | Execute tasks |
| `/flow.verify` | Post-implement completion check |
| `/flow.merge` | Git operations |
| `/flow.review` | Code review |

**Total: 10 commands** (down from original 20)

**User Stories**:
1. As a new user, I run `specflow` CLI and see `/flow.*` commands - immediately clear it's workflow-driven
2. As a documentation reader, I see consistent SpecFlow branding everywhere
3. As a developer, I type `specflow` instead of `specflow` - shorter mental model

**Deliverables**:
- [ ] Rename GitHub repository to `specflow`
- [ ] Rename `bin/specflow` → `bin/specflow`
- [ ] Update all bash scripts to reference `specflow` binary
- [ ] Rename all `commands/specflow.*.md` → `commands/flow.*.md`
- [ ] Update all command file content to reference `/flow.*`
- [ ] Update CLAUDE.md: branding, commands, binary name
- [ ] Update `docs/commands-analysis.md`
- [ ] Update README.md with SpecFlow branding
- [ ] Update install.sh for new binary name
- [ ] Update any memory documents with command/binary references
- [ ] Update dashboard/website references
- [ ] Delete all old `specflow.*` files (clean break)
- [ ] Verify: `grep -r "specflow" .` returns 0 results in active code

**Verification Gate**: Technical
- `specflow help` works
- All commands accessible via `/flow.*` prefix
- No `specflow` references in active code/documentation
- Dashboard/website shows SpecFlow branding

**Dependencies**:
- Phase 0070 (Pre-Workflow Consolidation) - must complete first
- Phase 0072 (Workflow Consolidation) - must complete first

**Estimated Complexity**: Medium (lots of files, but straightforward renames)
