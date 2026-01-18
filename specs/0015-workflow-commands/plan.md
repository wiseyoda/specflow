# Implementation Plan: Workflow Commands

**Branch**: `0015-workflow-commands` | **Date**: 2026-01-10 | **Spec**: spec.md
**Input**: Feature specification from `specs/0015-workflow-commands/spec.md`

## Summary

Add two slash commands (`/specflow.merge`, `/specflow.backlog`) and one CLI subcommand (`specflow roadmap backlog add`) to streamline end-of-phase workflows and continuous backlog management. The merge command automates git operations, state archival, and ROADMAP updates. The backlog commands enable quick capture and intelligent triage of work items.

## Technical Context

**Language/Version**: POSIX-compliant Bash 3.2+
**Primary Dependencies**: jq 1.6+, git 2.x
**Storage**: ROADMAP.md (markdown), orchestration-state.json (JSON)
**Testing**: Custom test-runner.sh with bash assertions
**Target Platform**: macOS and Linux
**Project Type**: CLI tool with Claude Code slash commands
**Constraints**: All scripts must pass shellcheck, support --help and --json flags

## Constitution Check

_GATE: Must pass before implementation._

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✅ Pass | Commands reduce manual steps from 6+ to 1 |
| II. POSIX-Compliant Bash | ✅ Pass | All scripts use POSIX syntax |
| III. CLI Over Direct Edits | ✅ Pass | Uses existing `specflow state archive`, adds new CLI commands |
| IV. Simplicity Over Cleverness | ✅ Pass | Builds on existing patterns (roadmap.sh, state.sh) |
| V. Helpful Error Messages | ✅ Pass | All commands include context and next steps |
| VI. Graceful Degradation | ✅ Pass | Git failures don't corrupt state; partial success allowed |

## Project Structure

### Documentation (this feature)

```text
specs/0015-workflow-commands/
├── spec.md              # Feature specification
├── plan.md              # This file
├── requirements.md      # Requirements checklist
└── tasks.md             # Generated task list
```

### Source Code Changes

```text
commands/
├── specflow.merge.md         # NEW: Slash command for phase completion
└── specflow.backlog.md       # NEW: Slash command for backlog triage

scripts/bash/
├── specflow-roadmap.sh       # MODIFY: Add backlog subcommand
└── lib/common.sh            # No changes needed

ROADMAP.md                   # RUNTIME: Updated by commands
.specify/orchestration-state.json  # RUNTIME: Updated by commands
```

**Structure Decision**: Follows existing SpecFlow patterns. Slash commands go in `commands/`, bash logic extends `specflow-roadmap.sh`.

## Implementation Approach

### Component 1: `/specflow.merge` Slash Command

**File**: `commands/specflow.merge.md`

A Claude Code slash command that orchestrates end-of-phase workflow:

1. **Pre-flight checks**:
   - Verify on feature branch (not main)
   - Check for uncommitted changes
   - Verify task completion status via `specflow tasks status`

2. **Git operations**:
   - Push current branch to origin
   - Create PR via `gh pr create` (if gh available) or show manual instructions
   - Merge PR via `gh pr merge` (default) or skip with `--pr-only`
   - Checkout main branch
   - Pull latest main
   - Delete feature branch locally and remote

3. **State operations**:
   - Run `specflow state archive` to archive phase
   - Run `specflow roadmap update {phase} complete` to update ROADMAP

4. **Backlog summary**:
   - Read ROADMAP.md Backlog section
   - Display summary of pending backlog items

**Flags**:
- `--pr-only`: Create PR but don't merge (for review workflow)
- `--force`: Skip task completion check
- `--dry-run`: Show what would happen without executing

### Component 2: `/specflow.backlog` Slash Command

**File**: `commands/specflow.backlog.md`

A Claude Code slash command that triages backlog items:

1. **Parse backlog**:
   - Read ROADMAP.md Backlog section
   - Extract items (format: `- [ ] Item description`)

2. **Analyze each item**:
   - Read each phase's Scope section
   - Match item keywords to phase scopes
   - Calculate confidence score

3. **Propose assignments**:
   - Display item → phase mapping with confidence
   - For low-confidence items, ask user to clarify or create new phase

4. **Update ROADMAP**:
   - Add assigned items to phase Scope sections
   - Remove from Backlog section
   - Create new phases for unassignable items (using `specflow roadmap insert`)

### Component 3: `specflow roadmap backlog add` CLI Subcommand

**File**: `scripts/bash/specflow-roadmap.sh` (extend)

Add `backlog` subcommand with `add` action:

```bash
specflow roadmap backlog add "My new idea"
specflow roadmap backlog list
specflow roadmap backlog clear  # For after triage
```

**Implementation**:
1. Locate Backlog section in ROADMAP.md
2. Create section if missing (with header and empty table)
3. Append item with timestamp
4. Support `--json` output

## Data Model

### Backlog Item (in ROADMAP.md)

```markdown
## Backlog

| Added | Item | Priority | Notes |
|-------|------|----------|-------|
| 2026-01-10 | Add dark mode support | - | |
| 2026-01-10 | Improve error messages | High | User feedback |
```

### Phase Assignment Result (runtime)

```json
{
  "item": "Add dark mode support",
  "assigned_phase": "0020",
  "phase_name": "Onboarding Polish",
  "confidence": 0.85,
  "matched_keywords": ["UI", "user experience"]
}
```

## Testing Strategy

### Unit Tests (bash)

Test file: `tests/test-roadmap-backlog.sh`

1. Test `backlog add` creates section if missing
2. Test `backlog add` appends to existing section
3. Test `backlog add` handles special characters
4. Test `backlog list` returns correct items
5. Test `backlog clear` removes items

### Integration Tests

1. Test `/specflow.merge` with mock git commands
2. Test `/specflow.backlog` with sample ROADMAP
3. Test full workflow: add → triage → verify

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Git push fails (network) | Catch error, preserve local state, suggest retry |
| PR merge conflict | Detect conflict, abort merge, show resolution steps |
| ROADMAP.md format varies | Parse flexibly, warn on unexpected format |
| Backlog section missing | Create section automatically |
| gh CLI not installed | Fall back to manual instructions |

## Dependencies

### External Commands

| Command | Required | Fallback |
|---------|----------|----------|
| git | Yes | Error with install instructions |
| jq | Yes | Error with install instructions |
| gh | No | Manual PR instructions |

### Existing SpecFlow Commands Used

- `specflow state archive` - Archive completed phase
- `specflow state get` - Read current state
- `specflow roadmap update` - Update phase status
- `specflow roadmap insert` - Create new phases
- `specflow tasks status` - Check task completion

## Implementation Order

1. **Phase 1 - CLI Foundation**: Add `specflow roadmap backlog` subcommand
2. **Phase 2 - Merge Command**: Create `/specflow.merge` slash command
3. **Phase 3 - Backlog Triage**: Create `/specflow.backlog` slash command
4. **Phase 4 - Polish**: Error handling, help text, edge cases
