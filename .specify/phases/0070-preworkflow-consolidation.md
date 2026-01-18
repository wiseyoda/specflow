---
phase: 0070
name: preworkflow-consolidation
status: not_started
created: 2026-01-17
pdr: pdr-preworkflow-consolidation.md
---

### 0070 - Pre-Workflow Commands Consolidation

**Goal**: Reduce 7 pre-workflow commands to 3, with clear separation between one-time setup and ongoing utilities.

**Scope**:
- Consolidate `/speckit.init` to handle complete project setup flow
- Reduce `/speckit.memory` to verify/reconcile/promote (remove generate)
- Add `add-pdr` subcommand to `/speckit.roadmap` (absorb phase functionality)
- Deprecate: start, constitution, memory-init, phase
- Update all documentation

**Commands Before → After**:

| Before | After |
|--------|-------|
| start, init, constitution, memory, memory-init, roadmap, phase | init, memory, roadmap |

**User Stories**:
1. As a new user, I run `/speckit.init` and my project is fully set up for development
2. As a maintainer, I run `/speckit.memory verify` to check document health
3. As a developer with PDRs, I run `/speckit.roadmap add-pdr` to add phases
4. As an existing user, I see deprecation notices guiding me to new commands

**Deliverables**:
- [ ] `/speckit.init` expanded: interview → constitution → memory → roadmap
- [ ] `/speckit.memory` reduced: remove `generate`, keep verify/reconcile/promote
- [ ] `/speckit.roadmap` expanded: add `add-pdr` subcommand
- [ ] Deprecation stubs for: start, constitution, phase
- [ ] Delete `/speckit.memory-init` (already deprecated)
- [ ] Updated `docs/commands-analysis.md`
- [ ] Updated CLAUDE.md command documentation

**Verification Gate**: Technical
- New project setup works with single `/speckit.init` command
- Deprecated commands show helpful redirect messages
- Existing projects continue to work
- No functionality lost in consolidation

**Estimated Complexity**: Medium
