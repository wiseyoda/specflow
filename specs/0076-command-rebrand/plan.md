# Implementation Plan: SpecFlow Rebrand

## Technical Context

**Goal**: Complete rebrand from SpecKit to SpecFlow across all files
**Scope**: Binary, commands, scripts, documentation, paths, environment variables
**Approach**: Batch rename and content replacement with verification at each stage

## Constitution Compliance Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✅ | New naming is clearer (SpecFlow, /flow.*) |
| II. POSIX-Compliant Bash | ✅ | Script changes maintain POSIX compliance |
| III. CLI Over Direct Edits | ✅ | Continuing to use CLI patterns |
| IV. Simplicity Over Cleverness | ✅ | Straightforward rename operations |
| V. Helpful Error Messages | ✅ | Error messages will use new branding |
| VI. Graceful Degradation | ✅ | No functional changes |
| VII. Three-Line Output Rule | ✅ | Output patterns maintained |

**No constitution violations detected.**

## Implementation Phases

### Phase 1: Bash Scripts (Foundation)

**Why first**: Scripts are sourced by other scripts; must be renamed before binary update.

1. Rename `scripts/bash/speckit-*.sh` → `specflow-*.sh`
2. Update source statements in all scripts
3. Update double-source guards (`SPECKIT_*_LOADED` → `SPECFLOW_*_LOADED`)
4. Update function names that include "speckit"
5. Update internal references

**Files affected**: 24 bash scripts + 4 library files

### Phase 2: Binary (CLI Entry Point)

**Why second**: After scripts renamed, binary can reference new script names.

1. Rename `bin/speckit` → `bin/specflow`
2. Update internal references to script paths
3. Update help text and branding
4. Update version output

**Files affected**: 1 file

### Phase 3: Slash Commands (User-Facing)

**Why third**: Core user interaction point, depends on scripts being renamed.

1. Create new `commands/flow.*.md` files with updated content
2. Update all internal references from `/speckit.*` to `/flow.*`
3. Delete deprecated command files (speckit.start, speckit.constitution, etc.)
4. Delete old `speckit.*.md` files after new files verified

**Files affected**: 20 command files (11 active → renamed including utility, 9 deprecated → deleted)

### Phase 4: Install Script

**Why fourth**: Installation paths depend on new naming conventions.

1. Update `SPECKIT_HOME` → `SPECFLOW_HOME`
2. Update paths: `~/.claude/speckit-system` → `~/.claude/specflow-system`
3. Update `~/.speckit/` → `~/.specflow/`
4. Update command file patterns
5. Update binary name references

**Files affected**: 1 file (install.sh)

### Phase 5: Documentation

**Why fifth**: Documentation references all other components.

1. Update README.md - branding, URLs, examples
2. Update CLAUDE.md - command references, binary name
3. Update all docs/*.md files
4. Update memory documents (.specify/memory/*.md)
5. Update templates if they reference speckit

**Files affected**: ~15+ markdown files

### Phase 6: Verification & Cleanup

1. Run `grep -r "speckit" --include="*.sh" --include="*.md" .`
2. Exclude `.specify/history/` and archive directories
3. Fix any remaining references
4. Test `specflow help`, `specflow doctor`
5. Test all `/flow.*` commands load

### Phase 7: Repository Rename (Manual)

**Why last**: Most disruptive, requires GitHub web interface.

**Steps to rename repository:**
1. Go to https://github.com/wiseyoda/claude-speckit-orchestration/settings
2. Scroll to "Repository name" section
3. Enter `specflow` as the new name
4. Click "Rename"
5. Update local remote: `git remote set-url origin git@github.com:wiseyoda/specflow.git`
6. Verify with: `git remote -v`

**Note**: GitHub will automatically redirect old URLs for a period of time.

## Key File Mappings

### Script Renames
| Old | New |
|-----|-----|
| speckit-state.sh | specflow-state.sh |
| speckit-doctor.sh | specflow-doctor.sh |
| speckit-context.sh | specflow-context.sh |
| ... (24 total) | ... |

### Command Renames
| Old | New |
|-----|-----|
| speckit.init.md | flow.init.md |
| speckit.orchestrate.md | flow.orchestrate.md |
| speckit.design.md | flow.design.md |
| speckit.analyze.md | flow.analyze.md |
| speckit.implement.md | flow.implement.md |
| speckit.verify.md | flow.verify.md |
| speckit.merge.md | flow.merge.md |
| speckit.memory.md | flow.memory.md |
| speckit.roadmap.md | flow.roadmap.md |
| speckit.review.md | flow.review.md |

### Deprecated Commands (Delete)
- speckit.start.md
- speckit.constitution.md
- speckit.phase.md
- speckit.specify.md
- speckit.clarify.md
- speckit.plan.md
- speckit.tasks.md
- speckit.checklist.md
- speckit.backlog.md

### Path Changes
| Old | New |
|-----|-----|
| ~/.claude/speckit-system/ | ~/.claude/specflow-system/ |
| ~/.speckit/ | ~/.specflow/ |
| bin/speckit | bin/specflow |

### Environment Variable Changes
| Old | New |
|-----|-----|
| SPECKIT_HOME | SPECFLOW_HOME |
| SPECKIT_DEBUG | SPECFLOW_DEBUG |
| SPECKIT_VERSION | SPECFLOW_VERSION |
| SPECKIT_*_LOADED | SPECFLOW_*_LOADED |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Missing a reference | Comprehensive grep verification after each phase |
| Breaking scripts mid-rename | Rename files first, then update contents |
| install.sh fails | Test on clean system before repo rename |
| User confusion | Clear upgrade instructions in README |

## Dependencies

- Phase 2 depends on Phase 1 (binary references scripts)
- Phase 3-5 can partially parallelize but order preferred for testing
- Phase 6 depends on all prior phases
- Phase 7 depends on Phase 6 verification passing

## Rollback Strategy

If issues found:
1. Git revert all changes
2. Keep both `speckit` and `specflow` temporarily
3. Debug and fix issues
4. Re-attempt clean break
