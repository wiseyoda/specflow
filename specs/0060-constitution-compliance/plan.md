# Implementation Plan: Constitution Compliance Remediation

**Phase**: 0060
**Created**: 2026-01-11
**Status**: Draft

---

## Technical Context

### Architecture Overview

SpecFlow is a bash-based CLI framework with:
- **Entry point**: `bin/specflow` (dispatcher)
- **Core scripts**: `scripts/bash/specflow-*.sh` (individual commands)
- **Libraries**: `scripts/bash/lib/{common,json,detection}.sh`
- **Slash commands**: `commands/specflow.*.md` (Claude Code prompts)
- **Templates**: `templates/` (canonical location)

### Current State Analysis

| Area | Status | Key Findings |
|------|--------|--------------|
| bin/specflow | Needs fix | 'phase' incorrectly listed as slash-only command |
| common.sh | Needs extension | Has `get_specflow_system_dir()`, needs `get_specflow_registry()` |
| Hardcoded paths | 5 files | Need to use common.sh helpers |
| Three-line rule | 26 violations | All CLI scripts need refactoring |
| Templates | Duplicate dir | `.specify/templates/` should be deleted |
| Slash commands | 18 issues | References to deprecated scripts |

---

## Constitution Compliance Check

| Principle | Plan Compliance | Notes |
|-----------|-----------------|-------|
| I. Developer Experience First | ✅ | Three-line output improves UX |
| II. POSIX-Compliant Bash | ✅ | Adding platform detection for sed -i |
| III. CLI Over Direct Edits | ✅ | Updating slash commands to use CLI |
| IV. Simplicity Over Cleverness | ✅ | Using existing patterns |
| V. Helpful Error Messages | ✅ | No changes to error handling |
| VI. Graceful Degradation | ✅ | No changes to degradation |
| VII. Three-Line Output Rule | ✅ | Primary focus of this phase |

---

## Implementation Approach

### Phase 1: Critical Fixes (Blocking Issues)

**1.1 Fix LIB008 - bin/specflow command routing**
- Remove 'phase' from slash-command warning list (line 337)
- 'phase' is a valid CLI command (specflow-phase.sh exists)

**1.2 Remove duplicate templates directory**
- Delete `.specify/templates/` entirely
- `templates/` is the canonical source

### Phase 2: Foundation Updates (common.sh)

**2.1 Add missing path helpers**
```bash
get_specflow_registry() {
  echo "${HOME}/.specflow/registry.json"
}
```

**2.2 Add three-line output helper**
```bash
# print_summary - Three-line rule compliant output
# Usage: print_summary "status" "message" ["detail"] ["next"]
# Line 1: STATUS: message
# Line 2: detail (if provided)
# Line 3: next step hint (if provided)
print_summary() {
  local status="$1"  # ok|error|warn|info
  local message="$2"
  local detail="${3:-}"
  local next="${4:-}"

  case "$status" in
    ok)    echo -e "${GREEN}OK${RESET}: ${message}" ;;
    error) echo -e "${RED}ERROR${RESET}: ${message}" ;;
    warn)  echo -e "${YELLOW}WARN${RESET}: ${message}" ;;
    info)  echo -e "${BLUE}INFO${RESET}: ${message}" ;;
  esac

  [[ -n "$detail" ]] && echo "  $detail"
  [[ -n "$next" ]] && echo "  Next: $next"
}
```

### Phase 3: Hardcoded Path Remediation

Update 5 files to use common.sh helpers:
1. `specflow-doctor.sh` - Use `get_specflow_system_dir()`
2. `specflow-detect.sh` - Use `get_specflow_system_dir()`
3. `specflow-state.sh` - Use `get_specflow_registry()`
4. `specflow-templates.sh` - Use `get_specflow_system_dir()`
5. `specflow-scaffold.sh` - Use `get_specflow_system_dir()`

### Phase 4: Three-Line Rule Compliance

Refactor 26 functions across 16 scripts. Pattern:

**Before:**
```bash
cmd_validate() {
  log_step "Validating..."
  # ... validation logic
  print_status ok "Valid"
}
```

**After:**
```bash
cmd_validate() {
  # Validation logic first (quiet)
  local result="..."
  local count="..."

  # Three-line output at end
  print_summary "ok" "$count items validated" \
    "File: $filepath" \
    "Run specflow X to continue"
}
```

Scripts to update:
- specflow-detect.sh (1 function)
- specflow-gate.sh (1 function)
- specflow-lessons.sh (2 functions)
- specflow-import.sh (1 function)
- specflow-context.sh (1 function)
- specflow-git.sh (1 function)
- specflow-manifest.sh (1 function)
- specflow-reconcile.sh (3 functions)
- specflow-templates.sh (3 functions)
- specflow-phase.sh (1 function)
- specflow-roadmap.sh (2 functions)
- specflow-memory.sh (3 functions)
- specflow-migrate.sh (1 function)
- specflow-pdr.sh (1 function)
- specflow-scaffold.sh (1 function)
- specflow-state.sh (3 functions)

### Phase 5: POSIX Compliance Fixes

**5.1 Platform detection for sed -i**
```bash
# Add to common.sh
sed_in_place() {
  local file="$1"
  shift
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@" "$file"
  else
    sed -i "$@" "$file"
  fi
}
```

**5.2 Fix extglob usage**
- Add `shopt -s extglob` where pattern matching is used

### Phase 6: Library File Fixes

**6.1 json.sh improvements**
- Add double-source guard
- Fix unquoted jq interpolations (lines 84, 217)

**6.2 specflow-issue.sh arithmetic fix**
- Change `((count++))` to `((count++)) || true`

### Phase 7: Slash Command Updates

Update 7 slash commands to:
- Remove deprecated script references
- Use CLI commands instead of direct edits
- Reference existing CLI commands

| Command | Changes |
|---------|---------|
| specflow.specify.md | Remove setup-plan.sh reference |
| specflow.plan.md | Remove setup-plan.sh, update-agent-context.sh |
| specflow.verify.md | Use specflow tasks mark |
| specflow.backlog.md | Use specflow CLI |
| specflow.phase.md | Already updated |
| specflow.init.md | Use specflow state set |

### Phase 8: Template Standardization

Update 6 templates to 4-digit ABBC format:
- backlog-template.md
- deferred-template.md
- plan-template.md
- spec-template.md
- tasks-template.md
- openapi-template.yaml (remove project-specific references)

### Phase 9: Documentation Fixes

**9.1 README.md corrections**
- Fix --check description (verify installation, not run tests)
- Verify all doc links exist

---

## Dependency Order

```
Phase 1 (Critical Fixes)
    ↓
Phase 2 (Foundation - common.sh)
    ↓
Phase 3 (Hardcoded Paths) ← depends on Phase 2
    ↓
Phase 4 (Three-Line Rule) ← depends on Phase 2 (print_summary)
    ↓
Phase 5 (POSIX) ← depends on Phase 2 (sed_in_place)
    ↓
Phase 6 (Libraries)
    ↓
Phase 7 (Slash Commands)
    ↓
Phase 8 (Templates)
    ↓
Phase 9 (Documentation)
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking CLI behavior | High | Test each script after changes |
| Missing test coverage | Medium | Run existing tests, manual verification |
| Scope creep | Medium | Only fix documented issues |
| Pattern inconsistency | Low | Use print_summary consistently |

---

## Testing Strategy

1. **After Phase 1**: Verify `specflow phase` works
2. **After Phase 2**: Verify common.sh loads correctly
3. **After Phase 3**: Verify path resolution works
4. **After Phase 4**: Sample output verification for three-line rule
5. **After Phase 6**: Verify json.sh functions work
6. **After Phase 8**: Verify templates have correct format
7. **Final**: Run `./tests/test-runner.sh`

---

## Success Metrics

| Metric | Target | Verification |
|--------|--------|--------------|
| LIB008 fixed | `specflow phase` works | Manual test |
| Duplicate templates | 0 (deleted) | `ls .specify/templates/` fails |
| Hardcoded paths | 0 in scripts | `grep -r "HOME/.specflow"` returns common.sh only |
| Three-line compliant | 100% | Sample output checks |
| Slash command refs | All valid | Manual audit |
| Constitution score | 95%+ | Re-run compliance check |

---

## Files to Modify

### High Priority
| File | Changes |
|------|---------|
| bin/specflow | Remove 'phase' from slash-command list |
| scripts/bash/lib/common.sh | Add helpers |
| scripts/bash/specflow-detect.sh | Three-line + path |
| scripts/bash/specflow-doctor.sh | Path fix |
| scripts/bash/specflow-state.sh | Registry path + three-line |

### Medium Priority
| File | Changes |
|------|---------|
| scripts/bash/specflow-gate.sh | Three-line |
| scripts/bash/specflow-lessons.sh | Three-line + sed |
| scripts/bash/specflow-import.sh | Three-line |
| scripts/bash/specflow-context.sh | Three-line |
| scripts/bash/specflow-git.sh | Three-line |
| scripts/bash/specflow-manifest.sh | Three-line |
| scripts/bash/specflow-reconcile.sh | Three-line |
| scripts/bash/specflow-templates.sh | Three-line + path |
| scripts/bash/specflow-phase.sh | Three-line |
| scripts/bash/specflow-roadmap.sh | Three-line |
| scripts/bash/specflow-memory.sh | Three-line |
| scripts/bash/specflow-migrate.sh | Three-line |
| scripts/bash/specflow-pdr.sh | Three-line |
| scripts/bash/specflow-scaffold.sh | Three-line + path |

### Library Files
| File | Changes |
|------|---------|
| scripts/bash/lib/json.sh | Guards + escaping |
| scripts/bash/specflow-issue.sh | Arithmetic fix |
| scripts/bash/specflow-feature.sh | extglob |

### Slash Commands
| File | Changes |
|------|---------|
| commands/specflow.specify.md | Remove deprecated refs |
| commands/specflow.plan.md | Remove deprecated refs |
| commands/specflow.verify.md | Use CLI |
| commands/specflow.backlog.md | Use CLI |
| commands/specflow.init.md | Use CLI |

### Templates
| File | Changes |
|------|---------|
| templates/backlog-template.md | 4-digit |
| templates/deferred-template.md | 4-digit |
| templates/plan-template.md | 4-digit |
| templates/spec-template.md | 4-digit |
| templates/tasks-template.md | 4-digit |
| templates/openapi-template.yaml | Remove project refs |

### Documentation
| File | Changes |
|------|---------|
| README.md | Fix --check, verify links |

### Delete
| File | Reason |
|------|--------|
| .specify/templates/ | Duplicate, templates/ is canonical |

---

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| 1. Critical Fixes | 2 | 30 min |
| 2. Foundation | 3 | 1 hr |
| 3. Hardcoded Paths | 5 | 1 hr |
| 4. Three-Line Rule | 26 | 4 hr |
| 5. POSIX | 2 | 30 min |
| 6. Libraries | 4 | 1 hr |
| 7. Slash Commands | 5 | 1 hr |
| 8. Templates | 6 | 1 hr |
| 9. Documentation | 2 | 30 min |
| **Total** | **55** | **~10 hr** |
