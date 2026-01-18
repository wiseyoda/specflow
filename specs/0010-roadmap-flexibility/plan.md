# Implementation Plan: Roadmap Flexibility

**Phase**: 0010-roadmap-flexibility
**Created**: 2026-01-10
**Status**: Draft

## Technical Context

### Tech Stack (from memory/tech-stack.md)
- **Shell**: Bash 3.2+ (POSIX-compliant)
- **JSON**: jq 1.6+
- **Validation**: shellcheck
- **Testing**: Custom test-runner.sh

### Constitution Alignment
- **Principle II (POSIX Bash)**: All new scripts use POSIX-compliant bash
- **Principle III (CLI Over Direct Edits)**: New commands follow existing patterns
- **Principle V (Helpful Errors)**: All errors include actionable guidance

### Existing Patterns
- Scripts follow `specflow-<name>.sh` naming
- Source `lib/common.sh` and `lib/json.sh`
- Support `--help` and `--json` flags
- Use `log_*` functions for output
- Exit codes: 0=success, 1=error, 2=warning

---

## Architecture Overview

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| `scripts/bash/specflow-roadmap.sh` | MODIFY | Add insert, defer, restore commands |
| `scripts/bash/specflow-migrate.sh` | CREATE | New script for 2.0→2.1 migration |
| `templates/roadmap-template.md` | MODIFY | Update with 4-digit ABBC numbering |
| `bin/specflow` | MODIFY | Add migrate subcommand routing |

### Command Structure

```text
specflow roadmap insert --after <phase> "<name>"   # NEW
specflow roadmap defer <phase> [--force]           # NEW
specflow roadmap restore <phase> [--after <phase>] # NEW
specflow migrate roadmap                           # NEW (separate script)
```

---

## Phase 1: Parser Updates

### Goal
Update `specflow-roadmap.sh` to support 4-digit phase numbers and add helper functions for the new commands.

### Changes

1. **Update `parse_phase_table()`**
   - Change regex from `[0-9]{3}` to `[0-9]{3,4}` to support both formats
   - Add format detection (3-digit vs 4-digit)

2. **Add phase number utilities**
   ```bash
   # Get decade for a phase (e.g., 0025 → 002)
   get_phase_decade() { ... }

   # Get next available number in decade
   get_next_in_decade() { ... }

   # Validate phase number format
   validate_phase_number() { ... }
   ```

3. **Update status_to_emoji() and emoji_to_status()**
   - Already works, no changes needed

---

## Phase 2: Insert Command

### Goal
Implement `specflow roadmap insert --after <phase> "<name>"` with interactive content prompts.

### Implementation

1. **Parse arguments**
   - `--after <phase>`: Required, target phase number
   - `<name>`: Required, new phase name
   - `--non-interactive`: Optional, skip prompts (use placeholders)

2. **Calculate new phase number**
   ```bash
   # Example: insert after 0020
   # - If 0021 doesn't exist → use 0021
   # - If 0021 exists, check 0022, 0023...
   # - If 0029 exists → error (decade full)
   ```

3. **Interactive prompts** (unless `--non-interactive`)
   ```bash
   read -p "Phase Goal: " goal
   read -p "Verification Gate: " gate
   echo "Enter scope items (blank line to finish):"
   while read -r scope_item && [[ -n "$scope_item" ]]; do
     scope_items+=("$scope_item")
   done
   ```

4. **Update ROADMAP.md**
   - Add row to Phase Overview table (after target phase)
   - Add phase section (after target phase section)
   - Use atomic write (temp file + mv)

---

## Phase 3: Defer Command

### Goal
Implement `specflow roadmap defer <phase>` to move phases to Backlog section.

### Implementation

1. **Parse arguments**
   - `<phase>`: Required, phase number to defer
   - `--force`: Optional, allow deferring in-progress phases

2. **Validation**
   - Check phase exists in active table
   - Check if phase is in progress (require `--force`)

3. **Create/find Backlog section**
   ```bash
   # If no Backlog section exists, create one:
   ## Backlog

   | Phase | Name | Original Date | Reason |
   |-------|------|---------------|--------|
   ```

4. **Move phase**
   - Remove from Phase Overview table
   - Remove phase section (### NNNN - Name)
   - Add to Backlog table with original number preserved
   - Move section content to end of Backlog section

---

## Phase 4: Restore Command

### Goal
Implement `specflow roadmap restore <phase>` with smart renumbering.

### Implementation

1. **Parse arguments**
   - `<phase>`: Required, phase number in backlog
   - `--after <phase>`: Optional, position after which to restore
   - `--as <number>`: Optional, explicit target number

2. **Smart restore logic**
   ```bash
   if [[ -n "$as_number" ]]; then
     target_number="$as_number"
   elif [[ -z "$after_phase" ]]; then
     # Try original number first
     if ! phase_exists "$original_number"; then
       target_number="$original_number"
     else
       # Find next in original decade
       target_number=$(get_next_in_decade "$original_number")
     fi
   else
     # Insert after specified phase
     target_number=$(get_next_in_decade "$after_phase")
   fi
   ```

3. **Update ROADMAP.md**
   - Remove from Backlog table and section
   - Add to Phase Overview table at correct position
   - Add phase section at correct position

---

## Phase 5: Migration Script

### Goal
Create `specflow-migrate.sh` for 2.0→2.1 roadmap format conversion.

### Implementation

1. **Format detection**
   ```bash
   detect_roadmap_format() {
     # Check if any phases use 3-digit format
     if grep -qE '^\|\s*[0-9]{3}\s*\|' "$roadmap_path"; then
       if grep -qE '^\|\s*[0-9]{4}\s*\|' "$roadmap_path"; then
         echo "mixed"
       else
         echo "2.0"
       fi
     else
       echo "2.1"
     fi
   }
   ```

2. **Migration logic**
   ```bash
   # Convert 001 → 0010, 002 → 0020, etc.
   # Pattern: NNN → N00N * 10 (so 001→0010, 012→0120)
   # Actually: NNN → NNN0 then reformat to NNNN
   # 001 → 0010, 002 → 0020, 010 → 0100, 012 → 0120

   migrate_phase_number() {
     local old="$1"
     # Remove leading zeros, multiply by 10, pad to 4 digits
     local num=$((10#$old * 10))
     printf "%04d" "$num"
   }
   ```

3. **Update references**
   - Update Phase Overview table
   - Update phase section headers (### NNN → ### NNNN)
   - Update state file if exists (`.specify/orchestration-state.json`)
   - Update any branch references in text

4. **Safety features**
   - Backup original file before migration
   - Dry-run mode (`--dry-run`) to preview changes
   - Rollback on error

---

## Phase 6: Template Updates

### Goal
Update `templates/roadmap-template.md` with 4-digit ABBC examples.

### Changes

1. **Update Phase Overview example**
   ```markdown
   | Phase | Name | Status | Verification Gate |
   |-------|------|--------|-------------------|
   | 0010 | Foundation | ⬜ Not Started | Core structure works |
   | 0020 | Core Features | ⬜ Not Started | Features accessible |
   ```

2. **Update phase section examples**
   - Change `### 001` to `### 0010`
   - Add note about numbering scheme

3. **Add Backlog section template**
   ```markdown
   ## Backlog

   Deferred phases waiting for future prioritization.

   | Phase | Name | Deferred Date | Reason |
   |-------|------|---------------|--------|
   ```

---

## Testing Strategy

### Unit Tests

| Test | Command | Expected |
|------|---------|----------|
| Insert basic | `insert --after 0020 "Test"` | Creates 0021 |
| Insert conflict | `insert --after 0020 "Test"` (0021 exists) | Creates 0022 |
| Insert decade full | `insert --after 0020 "Test"` (0020-0029 used) | Error message |
| Defer basic | `defer 0040` | Moves to Backlog |
| Defer in-progress | `defer 0010` | Error (needs --force) |
| Restore basic | `restore 0040` | Restores original number |
| Restore conflict | `restore 0040` (0040 exists) | Smart renumber |
| Migrate 2.0 | `migrate roadmap` | 001→0010, 002→0020 |
| Migrate 2.1 | `migrate roadmap` | No changes, info message |

### Integration Tests

1. Full insert-defer-restore cycle
2. Migration + insert workflow
3. Multi-phase operations

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | Automatic backup, dry-run mode |
| Regex edge cases | Medium | Medium | Comprehensive test suite |
| Unicode emoji handling | Low | Low | Already working in existing code |

---

## Dependencies

### Internal
- `lib/common.sh` - Logging, paths
- `lib/json.sh` - State file updates (for migration)

### External
- `jq` - JSON processing
- `sed` - In-place file editing
- `grep` - Pattern matching

---

## Implementation Order

1. **Phase 1**: Parser updates (foundation for all commands)
2. **Phase 5**: Migration script (enables clean testing on 2.1 format)
3. **Phase 2**: Insert command (most requested feature)
4. **Phase 3**: Defer command (works with insert)
5. **Phase 4**: Restore command (completes defer workflow)
6. **Phase 6**: Template updates (documentation)

This order allows testing each command on a clean 2.1-format roadmap.
