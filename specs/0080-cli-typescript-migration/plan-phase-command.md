# Implementation Plan: Phase Command & Merge Refactor

> Adds `specflow phase` smart command and streamlines `/flow.merge`

---

## Summary

| What | Why |
|------|-----|
| Add `specflow phase` CLI command | Manage phase lifecycle (open/close/update) from CLI |
| Refactor `/flow.merge` | Simplify to git operations + CLI calls |
| Clean up `.specify/` structure | Remove unused `issues/`, clarify backlog handling |

---

## Part 1: `specflow phase` Command

### 1.1 Command Design

```bash
specflow phase                     # Show current phase (alias for phase status)
specflow phase status              # Current phase info
specflow phase open [number]       # Start a phase
specflow phase close               # Close current phase
specflow phase close --dry-run     # Show what would happen
specflow phase --json              # JSON output for all subcommands
```

### 1.2 Subcommand: `phase status`

**Purpose**: Return current phase info (lighter than `specflow status`)

**Output**:
```json
{
  "phase": {
    "number": "0080",
    "name": "cli-typescript-migration",
    "status": "in_progress",
    "branch": "0080-cli-typescript-migration"
  },
  "artifacts": {
    "specDir": "specs/0080-cli-typescript-migration",
    "phaseFile": ".specify/phases/0080-cli-typescript-migration.md",
    "hasSpec": true,
    "hasPlan": true,
    "hasTasks": true
  }
}
```

### 1.3 Subcommand: `phase open [number]`

**Purpose**: Start a new phase

**Operations**:
1. Read ROADMAP.md to find phase by number (or next pending if no number)
2. Create git branch: `{number}-{name}`
3. Initialize orchestration state
4. Update ROADMAP.md status → "In Progress"
5. Create phase file in `.specify/phases/` if not exists

**Output**:
```json
{
  "action": "opened",
  "phase": {
    "number": "0081",
    "name": "phase-command",
    "branch": "0081-phase-command"
  },
  "message": "Phase 0081 started"
}
```

### 1.4 Subcommand: `phase close`

**Purpose**: Complete and archive current phase

**Operations**:
1. Update ROADMAP.md status → "Complete"
2. Archive phase details to `.specify/history/HISTORY.md`
3. Delete phase file from `.specify/phases/`
4. Scan for deferred items in `specs/<phase>/checklists/deferred.md`
5. Prompt about backlog items (or auto-handle with flag)
6. Reset orchestration state

**Output**:
```json
{
  "action": "closed",
  "phase": {
    "number": "0080",
    "name": "cli-typescript-migration"
  },
  "archived": true,
  "deferredItems": {
    "count": 2,
    "withTarget": 1,
    "toBacklog": 1
  },
  "nextPhase": {
    "number": "0081",
    "name": "phase-command"
  },
  "message": "Phase 0080 complete. 2 items deferred."
}
```

**Deferred Item Handling**:
- Items with target phase → stay in deferred.md, noted for future phase
- Items without target → append to project `BACKLOG.md`

---

## Part 2: File Structure

### 2.1 New Files

```
packages/cli/src/
├── commands/
│   └── phase/
│       ├── index.ts          # phase command with subcommands
│       ├── status.ts         # phase status
│       ├── open.ts           # phase open
│       └── close.ts          # phase close
└── lib/
    ├── roadmap.ts            # (exists) add updatePhaseStatus()
    ├── history.ts            # (new) archive to HISTORY.md
    └── backlog.ts            # (new) handle backlog items
```

### 2.2 Modify Existing

```
packages/cli/src/
├── index.ts                  # Add phaseCommand
└── lib/
    └── roadmap.ts            # Add phase status update function
```

---

## Part 3: Refactor `/flow.merge`

### 3.1 New Flow

```
1. Pre-flight checks
   - Verify on feature branch
   - Check for uncommitted changes

2. Close phase via CLI
   specflow phase close

3. Git operations
   - Push branch
   - Create PR (or use existing)
   - Merge PR (unless --pr-only)

4. Switch to main
   - git checkout main
   - git pull
   - Delete local branch

5. Done (clean state)
```

### 3.2 Updated `/flow.merge` Command

```markdown
## Execution

### 1. Pre-flight
- Verify on feature branch
- Check for uncommitted changes

### 2. Close Phase
specflow phase close --json

### 3. Commit Phase Closure
git add ROADMAP.md .specify/
git commit -m "chore: complete phase {number}"

### 4. Push & PR
git push -u origin $BRANCH
gh pr create --title "Phase {number}: {name}" ...

### 5. Merge (unless --pr-only)
gh pr merge --squash --delete-branch

### 6. Switch to Main
git checkout main && git pull
```

---

## Part 4: Clean Up `.specify/` Structure

### 4.1 Remove Unused

```bash
# Delete empty/unused directory
rm -rf .specify/issues/
```

### 4.2 Clarify Templates

| Template | Purpose | When Used |
|----------|---------|-----------|
| `deferred-template.md` | Phase-level deferrals with target | Created by `/flow.verify` |
| `backlog-template.md` | Project-level backlog | Created by `phase close` if needed |

### 4.3 Add Project BACKLOG.md

When `phase close` finds deferred items without targets, append to `BACKLOG.md` at project root (create from template if doesn't exist).

---

## Part 5: Implementation Tasks

### Phase 1: Core Infrastructure

- [ ] T001: Create `packages/cli/src/lib/history.ts` - archive functions
- [ ] T002: Create `packages/cli/src/lib/backlog.ts` - backlog functions
- [ ] T003: Extend `packages/cli/src/lib/roadmap.ts` - add `updatePhaseStatus()`

### Phase 2: Phase Command

- [ ] T004: Create `commands/phase/index.ts` - command structure
- [ ] T005: Implement `commands/phase/status.ts`
- [ ] T006: Implement `commands/phase/open.ts`
- [ ] T007: Implement `commands/phase/close.ts`
- [ ] T008: Add phase command to CLI index
- [ ] T009: Write tests for phase command

### Phase 3: Flow.merge Refactor

- [ ] T010: Rewrite `commands/flow.merge.md` to use CLI
- [ ] T011: Test full merge workflow

### Phase 4: Cleanup

- [ ] T012: Delete `.specify/issues/` directory
- [ ] T013: Update/clarify template documentation

---

## Part 6: Output Examples

### `specflow phase` (no args)

```
Phase 0080: cli-typescript-migration
Status: In Progress
Branch: 0080-cli-typescript-migration
```

### `specflow phase close`

```
Closing phase 0080...
✓ Updated ROADMAP.md
✓ Archived to HISTORY.md
✓ Reset orchestration state

2 deferred items found:
  → 1 targeted to Phase 0082
  → 1 added to BACKLOG.md

Phase 0080 complete.
Next: Phase 0081 (phase-command)
```

### `specflow phase close --json`

```json
{
  "action": "closed",
  "phase": { "number": "0080", "name": "cli-typescript-migration" },
  "archived": true,
  "deferredItems": { "count": 2, "withTarget": 1, "toBacklog": 1 },
  "nextPhase": { "number": "0081", "name": "phase-command" }
}
```

---

## Dependencies

- Existing `lib/roadmap.ts` for ROADMAP parsing
- Existing `lib/state.ts` for state operations
- Existing `lib/context.ts` for project context

---

## Success Criteria

1. `specflow phase close` handles all phase close-out operations
2. `/flow.merge` is under 100 lines (currently 576 → target ~80)
3. Clean working directory after merge (no uncommitted changes)
4. Deferred items properly routed to targets or backlog
5. All operations have `--json` output for slash command consumption
