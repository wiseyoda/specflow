# Implementation Plan: Integration Options

**Phase**: 0040
**Created**: 2026-01-11
**Spec**: spec.md

---

## Technical Context

### Existing Infrastructure

**specflow-detect.sh** (scripts/bash/specflow-detect.sh)
- Already has `detect_docs()` function (lines 218-293)
- Detects: docs/, ADR directories, OpenAPI files, .github/
- Supports `--json` output
- Will extend this with `--docs` flag enhancements

**No existing import command** - specflow-import.sh needs to be created.

### Architecture Approach

1. **Extend detect** - Add more granular documentation detection
2. **Create import command** - New script for ADR import
3. **Index generation** - Create adr-index.md from imported ADRs
4. **Documentation** - Add integration guide to docs/

---

## Tech Stack

- **Language**: Bash (POSIX-compliant)
- **Dependencies**: jq (JSON processing), git (path resolution)
- **Testing**: tests/test-*.sh pattern
- **Style**: Follows existing scripts/bash/*.sh conventions

---

## Implementation Phases

### Phase 1: Enhanced Detection (US1)

**Files to modify**:
- `scripts/bash/specflow-detect.sh`

**Changes**:
1. Add `--docs` alias for `--check docs`
2. Enhance ADR detection patterns:
   - `adr/`, `adrs/`, `docs/adr/`, `docs/decisions/`
   - File patterns: `001-*.md`, `ADR-001-*.md`, `NNNN-*.md`
3. Add explicit counts for each doc type
4. Add suggested import commands in output

**Detection patterns to add**:
```
ADR Directories:
  adr/, adrs/, ADR/, ADRs/
  docs/adr/, docs/adrs/, docs/ADR/
  docs/decisions/, doc/decisions/
  architecture/decisions/

ADR Files (within directories):
  [0-9][0-9][0-9]-*.md
  ADR-[0-9][0-9][0-9]-*.md
  [0-9][0-9][0-9][0-9]-*.md (4-digit)

Other Docs:
  ARCHITECTURE.md, architecture.md
  CONTRIBUTING.md, contributing.md
  DESIGN.md, design.md
```

### Phase 2: ADR Import (US2)

**New file**: `scripts/bash/specflow-import.sh`

**Command structure**:
```bash
specflow import adrs <path>     # Import ADRs from path
specflow import adrs --help     # Show help
specflow import adrs --dry-run  # Preview without importing
```

**Implementation steps**:
1. Validate source path exists and contains ADR-like files
2. Create `.specify/memory/adrs/` if not exists
3. Copy ADR files preserving names
4. Generate `adr-index.md` with:
   - Title (extracted from first H1)
   - Status (if present in ADR)
   - Date (from filename or metadata)
   - Superseded info (if present)
5. Report summary

**Error handling**:
- Source path doesn't exist → error with suggestion
- No ADR files found → warning with detection help
- Target already exists → prompt for overwrite or skip
- File copy fails → log error, continue with others

### Phase 3: Reference Integration (US3)

**Approach**: Handled by import command automatically.
- Import creates `adr-index.md` in memory/
- Memory documents can reference `./adrs/NNN-name.md`
- No automatic constitution.md modification

### Phase 4: Documentation (US4)

**New file**: `docs/integration-guide.md`

**Content outline**:
1. Overview - When to use integration features
2. Detection - `specflow detect --docs` walkthrough
3. ADR Import - `specflow import adrs` walkthrough
4. Manual Integration - How to reference existing docs
5. Examples - Common scenarios

**Also update**: `README.md` with brief mention and link

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `scripts/bash/specflow-detect.sh` | Modify | Add --docs alias, enhance ADR detection |
| `scripts/bash/specflow-import.sh` | Create | New import command |
| `bin/specflow` | Modify | Add import command routing |
| `docs/integration-guide.md` | Create | Integration documentation |
| `README.md` | Modify | Add integration section |
| `tests/test-detect.sh` | Modify | Add tests for --docs |
| `tests/test-import.sh` | Create | Tests for import command |

---

## Data Model

### ADR Index File (.specify/memory/adr-index.md)

```markdown
# Architecture Decision Records

Imported from: `<original-path>`
Import date: YYYY-MM-DD
Total ADRs: N

## Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| 001 | [Title from ADR](./adrs/001-title.md) | Accepted | 2024-01-15 |
| 002 | [Another Decision](./adrs/002-another.md) | Superseded by 005 | 2024-02-20 |

## Notes

- ADRs are imported as-is, preserving original format
- Status extracted from ADR metadata if present
- Superseded relationships noted when detectable
```

---

## Testing Strategy

### Detection Tests (tests/test-detect.sh)
- Create temp directory with various doc patterns
- Test `specflow detect --docs` finds them
- Test JSON output structure

### Import Tests (tests/test-import.sh)
- Test import from directory with ADRs
- Test --dry-run doesn't modify
- Test handles missing source gracefully
- Test creates adr-index.md
- Test preserves original filenames
- Test handles existing target directory

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| User imports to wrong location | Confirm import path, show preview |
| Overwriting existing ADRs | Check for existing, prompt or use --force |
| Malformed ADR files | Parse gracefully, include in index with warning |
| Very large number of ADRs | Progress indicator, batch processing |

---

## Constitution Compliance

Per `.specify/memory/constitution.md`:
- **POSIX-compliant bash**: No `declare -A`, use portable constructs
- **Three-line output**: Summary first, details below
- **CLI conventions**: --help, --json, exit codes
- **Non-destructive**: Never modify source files
