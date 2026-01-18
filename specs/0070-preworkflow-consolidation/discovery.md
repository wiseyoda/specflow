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
| `/specflow.start` | ~400 | 3/10 | Smart router to other commands |
| `/specflow.init` | ~385 | 6/10 | 12-phase discovery interview |
| `/specflow.constitution` | ~270 | 5/10 | Constitution creation/update |
| `/specflow.memory` | ~790 | 8/10 | Memory doc lifecycle (verify, reconcile, generate, promote) |
| `/specflow.memory-init` | ~30 | 1/10 | DEPRECATED - redirects to `memory generate` |
| `/specflow.roadmap` | ~405 | 5/10 | Create/update ROADMAP.md |
| `/specflow.phase` | ~340 | 4/10 | Convert PDRs to ROADMAP phases |

### Proposed Command Structure (3 commands)

| Command | Role | Frequency |
|---------|------|-----------|
| `/specflow.init` | Complete project setup (interview → constitution → memory → roadmap) | One-time |
| `/specflow.memory` | Health checks: verify, reconcile, promote (remove generate) | Ad hoc utility |
| `/specflow.roadmap` | Roadmap ops: update, add-pdr, renumber | Ad hoc utility |

### Deprecated Commands (4)

| Command | Replacement | Action Needed |
|---------|-------------|---------------|
| `/specflow.start` | `/specflow.orchestrate` | Create deprecation stub |
| `/specflow.constitution` | `/specflow.init` | Create deprecation stub |
| `/specflow.memory-init` | `/specflow.memory generate` | Already deprecated - DELETE |
| `/specflow.phase` | `/specflow.roadmap add-pdr` | Create deprecation stub |

---

## Key Findings

### 1. `/specflow.init` Analysis

**Current behavior**:
- Runs 12-phase discovery interview
- Creates `.specify/discovery/` artifacts
- Has `export` subcommand to generate memory documents
- Ends with handoff to `/specflow.constitution` or `/specflow.roadmap`

**Required changes**:
- Absorb constitution creation (currently separate command)
- Absorb memory document generation (currently via `export` → separate constitution step)
- Absorb initial roadmap creation
- Result: Single command takes project from zero to ready-for-orchestrate

**Flow after consolidation**:
```
/specflow.init
├── 1. Discovery Interview (12 phases) → .specify/discovery/
├── 2. Constitution Generation → .specify/memory/constitution.md
├── 3. Memory Document Generation → .specify/memory/*.md
└── 4. Initial Roadmap Creation → ROADMAP.md
→ Project ready for /specflow.orchestrate
```

### 2. `/specflow.memory` Analysis

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

### 3. `/specflow.roadmap` Analysis

**Current behavior**:
- Creates ROADMAP.md from discovery/memory context
- Phases are created in `.specify/phases/*.md`
- Uses CLI commands for roadmap operations

**Required changes**:
- Add `add-pdr` subcommand (absorb `/specflow.phase` functionality)
- Keep existing roadmap creation/update logic

**After consolidation**:
```
/specflow.roadmap [create]     # Create initial roadmap (or update existing)
/specflow.roadmap add-pdr      # Convert PDRs to phases (from /specflow.phase)
/specflow.roadmap update       # Update phase status
/specflow.roadmap renumber     # Already exists in CLI
```

### 4. `/specflow.phase` Analysis

**Current behavior**:
- Lists available PDRs from `.specify/memory/pdrs/`
- User selects which PDRs to convert
- Synthesizes phase content from PDR fields
- Updates ROADMAP.md with new phases
- Marks PDRs as processed

**This is really a roadmap operation** - PDR conversion adds phases to the roadmap.
Should become `/specflow.roadmap add-pdr`.

### 5. Deprecation Stubs

Commands to deprecate:
1. **`/specflow.start`**: Router that's no longer needed
   - Message: "Use /specflow.orchestrate to continue development"

2. **`/specflow.constitution`**: Absorbed into init
   - Message: "Use /specflow.init for initial setup"

3. **`/specflow.phase`**: Absorbed into roadmap
   - Message: "Use /specflow.roadmap add-pdr to convert PDRs to phases"

4. **`/specflow.memory-init`**: Already shows deprecation notice
   - Action: DELETE file entirely (30 lines)

---

## Integration Points

### Files That Reference Deprecated Commands

Need to search for and update references to:
- `/specflow.start`
- `/specflow.constitution`
- `/specflow.memory-init`
- `/specflow.phase`

Locations to check:
- `CLAUDE.md` (project instructions)
- Other command files (handoffs)
- Documentation in `docs/`
- Phase files in `.specify/phases/`

### CLI Dependencies

Commands use these CLI operations:
```bash
specflow scaffold          # Create project structure
specflow state get/set     # State management
specflow doctor            # Project health
specflow roadmap           # ROADMAP operations
specflow pdr               # PDR operations (used by /specflow.phase)
specflow phase             # Phase operations
```

---

## User Clarifications

### Init Idempotency Behavior

**Question**: Should the expanded `/specflow.init` skip steps if artifacts exist?

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

1. **Should `/specflow.phase` be absorbed into roadmap or kept separate?**
   → Absorb into `/specflow.roadmap` as `add-pdr` subcommand

2. **What happens to `promote` and `clean` from memory command?**
   → Keep `promote` (useful). Remove `clean` (rarely used).

3. **How to handle backwards compatibility for deleted commands?**
   → Keep stub commands with deprecation notices pointing to replacements

---

## Implementation Strategy

### Phase 1: Create Deprecation Stubs
- Replace `/specflow.start` with deprecation stub
- Replace `/specflow.constitution` with deprecation stub
- Replace `/specflow.phase` with deprecation stub
- Delete `/specflow.memory-init` (already deprecated)

### Phase 2: Expand `/specflow.init`
- Add constitution generation step
- Add memory document generation step
- Add initial roadmap creation step
- Update documentation and handoffs

### Phase 3: Reduce `/specflow.memory`
- Remove `generate` subcommand section
- Update help text and documentation
- Ensure verify/reconcile/promote still work

### Phase 4: Expand `/specflow.roadmap`
- Add `add-pdr` subcommand (move logic from `/specflow.phase`)
- Update help text and documentation

### Phase 5: Update Documentation
- Update CLAUDE.md command documentation
- Update docs/commands-analysis.md
- Update any handoffs referencing old commands

---

## Verification Criteria

From PDR acceptance criteria:
1. [x] `/specflow.init` runs complete setup: interview → constitution → memory docs → roadmap
2. [x] `/specflow.start` shows deprecation notice, suggests using `/specflow.orchestrate`
3. [x] `/specflow.constitution` shows deprecation notice, suggests using `/specflow.init`
4. [x] `/specflow.memory-init` deleted (already deprecated)
5. [x] `/specflow.memory` reduced to: verify, reconcile, promote (no generate)
6. [x] `/specflow.phase` shows deprecation notice, suggests using `/specflow.roadmap add-pdr`
7. [x] `/specflow.roadmap` gains `add-pdr` subcommand (absorbs phase functionality)
8. [x] All documentation updated to reflect new command structure
9. [x] Existing projects continue to work without changes
