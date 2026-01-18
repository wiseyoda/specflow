# Verification Checklist: Workflow Consolidation

**Phase**: 0072
**Purpose**: Verify phase completion before merge

---

## Functional Verification

### Design Command Core (FR-001 to FR-003)
- [ ] `/speckit.design` produces discovery.md
- [ ] `/speckit.design` produces spec.md
- [ ] `/speckit.design` produces plan.md
- [ ] `/speckit.design` produces tasks.md
- [ ] `/speckit.design` produces checklists/implementation.md
- [ ] `/speckit.design` produces checklists/verification.md
- [ ] Clarifying questions appear inline with context

### Cascade Flags (FR-004 to FR-007)
- [ ] `--spec` regenerates: spec, plan, tasks, checklists
- [ ] `--spec` preserves: discovery.md
- [ ] `--plan` regenerates: plan, tasks, checklists
- [ ] `--plan` preserves: discovery.md, spec.md
- [ ] `--tasks` regenerates: tasks, checklists
- [ ] `--tasks` preserves: discovery.md, spec.md, plan.md
- [ ] `--checklist` regenerates: checklists only
- [ ] `--checklist` preserves: all other artifacts

### Resumability (FR-008, FR-008a)
- [ ] Interrupted design can be resumed
- [ ] Discovery re-runs when design resumes (not skipped)

### Orchestrate (FR-009 to FR-012)
- [ ] Status shows 4 steps (design, analyze, implement, verify)
- [ ] Step indices are 0, 1, 2, 3
- [ ] Old state (indices 0-8) migrates to new indices
- [ ] `skip-to design` works
- [ ] `skip-to analyze` works
- [ ] `skip-to implement` works
- [ ] `skip-to verify` works

### Roadmap Backlog (FR-013, FR-014)
- [ ] `/speckit.roadmap backlog` lists backlog items
- [ ] `--auto` flag auto-assigns items
- [ ] `--dry-run` previews without changes

### Deprecation (FR-015 to FR-017)
- [ ] `/speckit.specify` shows deprecation message
- [ ] `/speckit.clarify` shows deprecation message
- [ ] `/speckit.plan` shows deprecation message
- [ ] `/speckit.tasks` shows deprecation message
- [ ] `/speckit.checklist` shows deprecation message
- [ ] `/speckit.backlog` shows deprecation message
- [ ] Each stub mentions correct replacement command

### Documentation (FR-018, FR-019)
- [ ] CLAUDE.md references 4-step workflow
- [ ] docs/commands-analysis.md shows 6 active commands

---

## Success Criteria Verification

### SC-001: Command Count
- [ ] Active workflow commands = 6 (orchestrate, design, analyze, implement, verify, merge)
- [ ] Deprecated workflow commands = 6 (specify, clarify, plan, tasks, checklist, backlog)

### SC-002: Design Produces All Artifacts
- [ ] Single `/speckit.design` run produces 5+ files

### SC-003: Both Checklist Types
- [ ] implementation.md created
- [ ] verification.md created

### SC-004: Deprecation Guidance
- [ ] All deprecated commands have clear "use X instead" message

### SC-005: No Breaking Changes
- [ ] Existing projects with old state still work
- [ ] Migration path available for all users

### SC-006: Step Indices Match
- [ ] State file shows indices 0-3 for design/analyze/implement/verify

---

## Constitution Compliance

### Principle I: Developer Experience First
- [ ] Fewer commands to remember
- [ ] Clear workflow progression

### Principle V: Helpful Error Messages
- [ ] Deprecation messages explain what to use instead
- [ ] Migration guidance is actionable

### Principle VII: Three-Line Output Rule
- [ ] Design command output puts key info in first 3 lines
- [ ] Status/result visible without scrolling

---

## Backward Compatibility

- [ ] Projects with old 9-step state continue to work
- [ ] No data loss during state migration
- [ ] Users can still find deprecated command documentation
