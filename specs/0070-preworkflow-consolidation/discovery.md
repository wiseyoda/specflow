# Discovery: Pre-Workflow Commands Consolidation

**Phase**: 0070-preworkflow-consolidation
**Created**: 2026-01-17
**Status**: In Progress

---

## Executive Summary

This phase consolidates 7 pre-workflow commands into 3, with clear separation between one-time setup and ongoing utilities. The goal is to reduce user confusion about which commands to run and when.

---

## Codebase Examination Findings

### Current Command Structure (7 commands)

| Command | Lines | Complexity | Current Role |
|---------|-------|------------|--------------|
| `/speckit.start` | ~400 | 3/10 | Smart router to other commands |
| `/speckit.init` | ~385 | 6/10 | 12-phase discovery interview |
| `/speckit.constitution` | ~270 | 5/10 | Constitution creation/update |
| `/speckit.memory` | ~790 | 8/10 | Memory doc lifecycle (verify, reconcile, generate, promote) |
| `/speckit.memory-init` | ~30 | 1/10 | DEPRECATED - redirects to `memory generate` |
| `/speckit.roadmap` | ~405 | 5/10 | Create/update ROADMAP.md |
| `/speckit.phase` | ~340 | 4/10 | Convert PDRs to ROADMAP phases |

### Proposed Command Structure (3 commands)

| Command | Role | Frequency |
|---------|------|-----------|
| `/speckit.init` | Complete project setup (interview → constitution → memory → roadmap) | One-time |
| `/speckit.memory` | Health checks: verify, reconcile, promote (remove generate) | Ad hoc utility |
| `/speckit.roadmap` | Roadmap ops: update, add-pdr, renumber | Ad hoc utility |

### Deprecated Commands (4)

| Command | Replacement | Action Needed |
|---------|-------------|---------------|
| `/speckit.start` | `/speckit.orchestrate` | Create deprecation stub |
| `/speckit.constitution` | `/speckit.init` | Create deprecation stub |
| `/speckit.memory-init` | `/speckit.memory generate` | Already deprecated - DELETE |
| `/speckit.phase` | `/speckit.roadmap add-pdr` | Create deprecation stub |

---

## Key Findings

### 1. `/speckit.init` Analysis

**Current behavior**:
- Runs 12-phase discovery interview
- Creates `.specify/discovery/` artifacts
- Has `export` subcommand to generate memory documents
- Ends with handoff to `/speckit.constitution` or `/speckit.roadmap`

**Required changes**:
- Absorb constitution creation (currently separate command)
- Absorb memory document generation (currently via `export` → separate constitution step)
- Absorb initial roadmap creation
- Result: Single command takes project from zero to ready-for-orchestrate

**Flow after consolidation**:
```
/speckit.init
├── 1. Discovery Interview (12 phases) → .specify/discovery/
├── 2. Constitution Generation → .specify/memory/constitution.md
├── 3. Memory Document Generation → .specify/memory/*.md
└── 4. Initial Roadmap Creation → ROADMAP.md
→ Project ready for /speckit.orchestrate
```

### 2. `/speckit.memory` Analysis

**Current subcommands/functionality**:
- Default behavior: Verify documents, detect errant files, analyze quality
- `--reconcile`: Detect drift against ROADMAP.md and codebase
- `--promote`: Surface decisions from completed specs
- `generate [doc]`: Create memory docs from codebase analysis

**PDR decision**: Remove `generate` subcommand
- Rationale: Generation is part of initial setup (handled by expanded init)
- Projects don't need to regenerate memory docs after initial setup
- If regeneration needed, can be done manually or via init re-run

**Remaining functionality**:
- `verify` (default): Check document quality, structure, compliance
- `reconcile`: Detect drift against ROADMAP and codebase
- `promote`: Surface decisions from completed specs to memory

### 3. `/speckit.roadmap` Analysis

**Current behavior**:
- Creates ROADMAP.md from discovery/memory context
- Phases are created in `.specify/phases/*.md`
- Uses CLI commands for roadmap operations

**Required changes**:
- Add `add-pdr` subcommand (absorb `/speckit.phase` functionality)
- Keep existing roadmap creation/update logic

**After consolidation**:
```
/speckit.roadmap [create]     # Create initial roadmap (or update existing)
/speckit.roadmap add-pdr      # Convert PDRs to phases (from /speckit.phase)
/speckit.roadmap update       # Update phase status
/speckit.roadmap renumber     # Already exists in CLI
```

### 4. `/speckit.phase` Analysis

**Current behavior**:
- Lists available PDRs from `.specify/memory/pdrs/`
- User selects which PDRs to convert
- Synthesizes phase content from PDR fields
- Updates ROADMAP.md with new phases
- Marks PDRs as processed

**This is really a roadmap operation** - PDR conversion adds phases to the roadmap.
Should become `/speckit.roadmap add-pdr`.

### 5. Deprecation Stubs

Commands to deprecate:
1. **`/speckit.start`**: Router that's no longer needed
   - Message: "Use /speckit.orchestrate to continue development"

2. **`/speckit.constitution`**: Absorbed into init
   - Message: "Use /speckit.init for initial setup"

3. **`/speckit.phase`**: Absorbed into roadmap
   - Message: "Use /speckit.roadmap add-pdr to convert PDRs to phases"

4. **`/speckit.memory-init`**: Already shows deprecation notice
   - Action: DELETE file entirely (30 lines)

---

## Integration Points

### Files That Reference Deprecated Commands

Need to search for and update references to:
- `/speckit.start`
- `/speckit.constitution`
- `/speckit.memory-init`
- `/speckit.phase`

Locations to check:
- `CLAUDE.md` (project instructions)
- Other command files (handoffs)
- Documentation in `docs/`
- Phase files in `.specify/phases/`

### CLI Dependencies

Commands use these CLI operations:
```bash
speckit scaffold          # Create project structure
speckit state get/set     # State management
speckit doctor            # Project health
speckit roadmap           # ROADMAP operations
speckit pdr               # PDR operations (used by /speckit.phase)
speckit phase             # Phase operations
```

---

## User Clarifications

### Init Idempotency Behavior

**Question**: Should the expanded `/speckit.init` skip steps if artifacts exist?

**Answer**: Smart idempotency - check for completion, not just file existence.
- Template files (created by scaffold) should be detected and regenerated
- Properly completed artifacts should be preserved
- Detection logic needed to distinguish templates from completed docs

**Implementation approach**:
- Check for placeholder markers like `[PROJECT_NAME]`, `[PRINCIPLE_1]`, etc.
- Check for required sections being filled vs empty
- If file exists but appears to be template → regenerate
- If file exists and appears complete → skip with notice

---

## Open Questions Resolved by PDR

1. **Should `/speckit.phase` be absorbed into roadmap or kept separate?**
   → Absorb into `/speckit.roadmap` as `add-pdr` subcommand

2. **What happens to `promote` and `clean` from memory command?**
   → Keep `promote` (useful). Remove `clean` (rarely used).

3. **How to handle backwards compatibility for deleted commands?**
   → Keep stub commands with deprecation notices pointing to replacements

---

## Implementation Strategy

### Phase 1: Create Deprecation Stubs
- Replace `/speckit.start` with deprecation stub
- Replace `/speckit.constitution` with deprecation stub
- Replace `/speckit.phase` with deprecation stub
- Delete `/speckit.memory-init` (already deprecated)

### Phase 2: Expand `/speckit.init`
- Add constitution generation step
- Add memory document generation step
- Add initial roadmap creation step
- Update documentation and handoffs

### Phase 3: Reduce `/speckit.memory`
- Remove `generate` subcommand section
- Update help text and documentation
- Ensure verify/reconcile/promote still work

### Phase 4: Expand `/speckit.roadmap`
- Add `add-pdr` subcommand (move logic from `/speckit.phase`)
- Update help text and documentation

### Phase 5: Update Documentation
- Update CLAUDE.md command documentation
- Update docs/commands-analysis.md
- Update any handoffs referencing old commands

---

## Verification Criteria

From PDR acceptance criteria:
1. [x] `/speckit.init` runs complete setup: interview → constitution → memory docs → roadmap
2. [x] `/speckit.start` shows deprecation notice, suggests using `/speckit.orchestrate`
3. [x] `/speckit.constitution` shows deprecation notice, suggests using `/speckit.init`
4. [x] `/speckit.memory-init` deleted (already deprecated)
5. [x] `/speckit.memory` reduced to: verify, reconcile, promote (no generate)
6. [x] `/speckit.phase` shows deprecation notice, suggests using `/speckit.roadmap add-pdr`
7. [x] `/speckit.roadmap` gains `add-pdr` subcommand (absorbs phase functionality)
8. [x] All documentation updated to reflect new command structure
9. [x] Existing projects continue to work without changes
