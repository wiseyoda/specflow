#!/usr/bin/env bash
#
# speckit-scaffold.sh - Create SpecKit project structure
#
# Usage:
#   speckit scaffold              Create .specify/ structure
#   speckit scaffold --force      Recreate (overwrites existing)
#   speckit scaffold --status     Check what exists
#   speckit scaffold --safe       Preview changes without writing
#   speckit scaffold --type TYPE  Force specific project type
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"
source "${SCRIPT_DIR}/lib/detection.sh"

# =============================================================================
# Constants
# =============================================================================

# Use centralized path helper from common.sh
SPECKIT_SYSTEM_DIR="$(get_speckit_system_dir)"
readonly SPECKIT_SYSTEM_DIR

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit scaffold - Create SpecKit project structure

USAGE:
    speckit scaffold [options]

OPTIONS:
    --force             Overwrite existing files
    --safe              Preview what would be created (no changes made)
    --status            Show what exists vs what's needed
    --type TYPE         Force project type (typescript, javascript, python,
                        rust, go, bash, generic). Auto-detected if not set.
    --skip-templates    Don't copy templates
    --skip-scripts      Don't copy scripts
    --json              Output in JSON format
    -h, --help          Show this help

PROJECT DETECTION:
    SpecKit auto-detects your project type and customizes templates:
    - tsconfig.json       → TypeScript
    - package.json        → JavaScript/Node.js
    - Cargo.toml          → Rust
    - go.mod              → Go
    - pyproject.toml      → Python
    - *.sh files          → Bash/Shell
    - (none)              → Generic

CREATES:
    .specify/
    ├── discovery/
    │   ├── context.md
    │   ├── state.md
    │   └── decisions.md
    ├── memory/
    │   ├── constitution.md  (customized for project type)
    │   ├── tech-stack.md    (customized for project type)
    │   └── adrs/
    ├── templates/
    ├── scripts/
    │   └── bash/
    ├── archive/
    └── orchestration-state.json

    specs/                  (feature specifications)

EXAMPLES:
    speckit scaffold            # Create structure (auto-detect type)
    speckit scaffold --safe     # Preview changes without writing
    speckit scaffold --type python  # Force Python templates
    speckit scaffold --status   # Check what exists
    speckit scaffold --force    # Recreate everything
EOF
}

# =============================================================================
# Safe Mode Preview
# =============================================================================

cmd_scaffold_preview() {
  local repo_root="$1"
  local project_type="$2"
  local project_type_name="$3"
  local specify_dir="${repo_root}/.specify"

  # Track what would be created/modified
  local would_create=()
  local would_modify=()
  local would_skip=()

  # Check directories
  local dirs=(
    ".specify"
    ".specify/discovery"
    ".specify/memory"
    ".specify/memory/adrs"
    ".specify/templates"
    ".specify/scripts"
    ".specify/scripts/bash"
    ".specify/archive"
    "specs"
  )

  for dir in "${dirs[@]}"; do
    local full_path="${repo_root}/${dir}"
    if [[ -d "$full_path" ]]; then
      would_skip+=("$dir/ (exists)")
    else
      would_create+=("$dir/")
    fi
  done

  # Check files
  local files=(
    ".specify/discovery/context.md"
    ".specify/discovery/state.md"
    ".specify/discovery/decisions.md"
    ".specify/orchestration-state.json"
    ".specify/manifest.json"
    ".specify/memory/constitution.md"
    ".specify/memory/tech-stack.md"
  )

  for file in "${files[@]}"; do
    local full_path="${repo_root}/${file}"
    if [[ -f "$full_path" ]]; then
      would_skip+=("$file (exists)")
    else
      would_create+=("$file")
    fi
  done

  # Three-Line Rule: Summary first
  local create_count=${#would_create[@]}
  local skip_count=${#would_skip[@]}
  echo -e "${BLUE}INFO${RESET}: Preview for $project_type_name project"
  echo "  Would create: $create_count items, skip: $skip_count items"
  echo ""

  # Details (line 4+)
  if [[ $create_count -gt 0 ]]; then
    echo "Would create:"
    for item in "${would_create[@]}"; do
      echo "  + $item"
    done
    echo ""
  fi

  if [[ $skip_count -gt 0 ]]; then
    echo "Would skip:"
    for item in "${would_skip[@]}"; do
      echo "  - $item"
    done
    echo ""
  fi

  echo "Run 'speckit scaffold' to apply changes."
  echo "Run 'speckit scaffold --force' to overwrite existing files."
}

# =============================================================================
# Templates
# =============================================================================

# Context template
create_context_template() {
  cat << 'EOF'
# Project Context

## Project Identity
| Field | Value |
|-------|-------|
| **Project Name** | (TBD - set in Phase 0) |
| **One-line Description** | (TBD) |
| **Project Type** | (TBD) |
| **Target Users** | (TBD) |
| **Stage** | (TBD - greenfield/brownfield/rewrite) |
| **Criticality** | (TBD - prototype/internal/production/mission-critical) |

## Relevance Filters
(Set after Phase 0 - marks which phases to emphasize/skip)

## Constraints & Givens
(Populated during interview)

## Reference Materials
(Documents, code, prototypes mentioned during discovery)
EOF
}

# State template
create_state_template() {
  local timestamp
  timestamp="$(iso_timestamp)"

  cat << EOF
# Interview State

## Session Info
| Field | Value |
|-------|-------|
| **Started** | $timestamp |
| **Current Phase** | 0 |
| **Current Question** | 1 |
| **Total Decisions** | 0 |

## Phase Progress
| Phase | Status | Decisions | Memory Docs Affected |
|-------|--------|-----------|---------------------|
| 0: Discovery | pending | 0 | context.md |
| 1: Problem & Vision | pending | 0 | constitution.md |
| 2: Users & Stakeholders | pending | 0 | glossary.md, ux-patterns.md |
| 3: Functional | pending | 0 | api-standards.md, glossary.md |
| 4: Non-Functional | pending | 0 | constitution.md, security-checklist.md |
| 5: Architecture | pending | 0 | tech-stack.md, coding-standards.md, adrs/ |
| 6: Errors & Recovery | pending | 0 | security-checklist.md, api-standards.md |
| 7: UX | pending | 0 | design-system.md, ux-patterns.md |
| 8: Operations | pending | 0 | performance-budgets.md |
| 9: Testing | pending | 0 | testing-strategy.md |
| 10: Evolution | pending | 0 | constitution.md |
| 11: Memory Bootstrap | pending | 0 | All memory docs |

## Contradictions
(populated if conflicts detected)

## Open Questions
(populated during interview)
EOF
}

# Decisions template
create_decisions_template() {
  cat << 'EOF'
# Requirements Decisions Log

> Decisions captured during `/speckit.init` interview. These feed into memory document generation.

## Decision Index
| ID | Phase | Title | Confidence | Memory Doc Impact |
|----|-------|-------|------------|-------------------|

## Progress
- **Decisions Made**: 0
- **Open Questions**: 0
- **Contradictions**: 0

---
<!-- Decisions appended below -->
EOF
}

# =============================================================================
# Project-Type-Specific Templates
# =============================================================================

# Generate constitution.md based on project type
create_constitution_for_type() {
  local project_type="$1"
  local project_type_name
  project_type_name=$(get_project_type_name "$project_type")

  cat << EOF
# Project Constitution

> Core principles and governance for this project. All implementation decisions must align with these principles.

**Version**: 1.0.0
**Created**: $(date +%Y-%m-%d)
**Status**: ACTIVE
**Project Type**: $project_type_name

---

## Preamble

This constitution defines the fundamental principles guiding development of this project.

---

## Core Principles

EOF

  # Language-specific principles
  case "$project_type" in
    typescript)
      cat << 'EOF'
### I. Type Safety First
All code uses TypeScript with strict mode enabled.
- **Rationale**: Type errors caught at compile time, not runtime
- **Implications**: `strict: true` in tsconfig, no `any` without justification

### II. Test-Driven Development
Write tests before implementation where practical.
- **Rationale**: Tests document behavior and prevent regressions
- **Implications**: Vitest/Jest for unit tests, high coverage goals

### III. Modern JavaScript
Use latest stable ECMAScript features.
- **Rationale**: Cleaner code, better performance
- **Implications**: ESNext target, ESM modules preferred
EOF
      ;;
    javascript)
      cat << 'EOF'
### I. Clean JavaScript
Write readable, maintainable JavaScript.
- **Rationale**: Code is read more often than written
- **Implications**: ESLint rules, consistent style, clear naming

### II. Test Coverage
Maintain comprehensive test coverage.
- **Rationale**: Confidence in changes, documentation of behavior
- **Implications**: Jest/Vitest, integration tests for key flows

### III. Dependency Management
Minimal, audited dependencies.
- **Rationale**: Security, bundle size, maintainability
- **Implications**: npm audit, regular updates, justify additions
EOF
      ;;
    python)
      cat << 'EOF'
### I. Type Hints
Use type hints for all public APIs.
- **Rationale**: Better tooling, documentation, error prevention
- **Implications**: mypy validation, typed function signatures

### II. Test-Driven Development
Write tests with pytest before implementation.
- **Rationale**: Tests document behavior and prevent regressions
- **Implications**: pytest with fixtures, high coverage goals

### III. Pythonic Code
Follow PEP 8 and Python idioms.
- **Rationale**: Consistency, readability, community standards
- **Implications**: ruff for linting and formatting
EOF
      ;;
    rust)
      cat << 'EOF'
### I. Safe Rust
No `unsafe` blocks without documented justification.
- **Rationale**: Memory safety is Rust's core value
- **Implications**: Prefer safe abstractions, document unsafe usage

### II. Error Handling
Use Result<T, E> for fallible operations.
- **Rationale**: Explicit error handling, no hidden panics
- **Implications**: Avoid unwrap() in library code, use ? operator

### III. Idiomatic Rust
Follow Rust API guidelines and idioms.
- **Rationale**: Consistency, interoperability, community standards
- **Implications**: clippy lints, rustfmt, ownership patterns
EOF
      ;;
    go)
      cat << 'EOF'
### I. Simplicity
Write simple, idiomatic Go.
- **Rationale**: Go prioritizes clarity over cleverness
- **Implications**: gofmt, golangci-lint, minimal abstractions

### II. Error Handling
Handle errors explicitly at every level.
- **Rationale**: Errors are values, handle them properly
- **Implications**: No ignored error returns, wrap with context

### III. Testing
Comprehensive tests with table-driven patterns.
- **Rationale**: Built-in testing is powerful, use it fully
- **Implications**: go test, testify assertions, benchmarks
EOF
      ;;
    bash)
      cat << 'EOF'
### I. POSIX Compliance
All scripts are POSIX-compliant bash.
- **Rationale**: Portability across macOS and Linux
- **Implications**: No bash 4.0+ features without fallbacks, shellcheck

### II. CLI Best Practices
Support --help and --json flags on all commands.
- **Rationale**: Discoverability and scripting support
- **Implications**: Consistent option parsing, documented exit codes

### III. Helpful Errors
Every error provides context and suggests next steps.
- **Rationale**: Users shouldn't guess what went wrong
- **Implications**: All errors include actionable guidance
EOF
      ;;
    *)
      cat << 'EOF'
### I. Code Quality
Maintain high code quality standards.
- **Rationale**: Quality code is easier to maintain
- **Implications**: Linting, formatting, code review

### II. Testing
Comprehensive test coverage.
- **Rationale**: Tests prevent regressions
- **Implications**: Unit and integration tests

### III. Documentation
Document public APIs and complex logic.
- **Rationale**: Code should be understandable
- **Implications**: Comments for non-obvious code
EOF
      ;;
  esac

  cat << 'EOF'

---

## Governance

### Decision Making
- Architecture decisions documented in ADRs
- Principle changes require documented rationale

### Enforcement
- All code passes linting
- All tests pass before merge
- Code review required

---

## Amendment Process

1. Propose change with rationale
2. Document impact on existing code
3. Update version number and changelog
EOF
}

# Generate tech-stack.md based on project type
create_tech_stack_for_type() {
  local project_type="$1"
  local project_type_name
  project_type_name=$(get_project_type_name "$project_type")

  cat << EOF
# Tech Stack

> Approved technologies and versions for this project.

**Last Updated**: $(date +%Y-%m-%d)
**Project Type**: $project_type_name

---

## Core Technologies

EOF

  case "$project_type" in
    typescript)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| TypeScript | 5.x | Primary language | Strict mode enabled |
| Node.js | 20.x+ | Runtime | LTS version |
| pnpm | 8.x+ | Package manager | Preferred over npm |

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | Latest | Unit testing |
| Testing Library | Latest | Component testing |

## Code Quality

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Formatting |
| tsc | Type checking |
EOF
      ;;
    javascript)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Node.js | 20.x+ | Runtime | LTS version |
| npm/pnpm | Latest | Package manager | |

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Jest/Vitest | Latest | Testing framework |

## Code Quality

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Formatting |
EOF
      ;;
    python)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Python | 3.11+ | Primary language | Type hints required |
| uv | Latest | Package manager | Fast, recommended |

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| pytest | Latest | Testing framework |
| pytest-cov | Latest | Coverage reporting |

## Code Quality

| Tool | Purpose |
|------|---------|
| ruff | Linting and formatting |
| mypy | Type checking |
EOF
      ;;
    rust)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Rust | Stable | Primary language | Edition 2021+ |
| Cargo | Built-in | Build/package manager | |

## Testing

| Technology | Purpose |
|------------|---------|
| cargo test | Built-in testing |
| cargo bench | Benchmarking |

## Code Quality

| Tool | Purpose |
|------|---------|
| rustfmt | Formatting |
| clippy | Linting |
EOF
      ;;
    go)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Go | 1.21+ | Primary language | Modules enabled |

## Testing

| Technology | Purpose |
|------------|---------|
| go test | Built-in testing |
| testify | Assertions (optional) |

## Code Quality

| Tool | Purpose |
|------|---------|
| gofmt | Formatting |
| golangci-lint | Linting |
| go vet | Static analysis |
EOF
      ;;
    bash)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Bash | 3.2+ | Shell scripting | POSIX-compliant |
| jq | 1.6+ | JSON processing | Required |
| git | 2.x | Version control | Required |

## Testing

| Technology | Purpose |
|------------|---------|
| bash | Custom test runner |
| assert functions | In-script assertions |

## Code Quality

| Tool | Purpose |
|------|---------|
| shellcheck | Linting |
| bash -n | Syntax checking |
EOF
      ;;
    *)
      cat << 'EOF'
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| (TBD) | - | Primary language | Customize this section |

## Testing

| Technology | Purpose |
|------------|---------|
| (TBD) | Testing framework |

## Code Quality

| Tool | Purpose |
|------|---------|
| (TBD) | Linting |
| (TBD) | Formatting |
EOF
      ;;
  esac

  cat << 'EOF'

---

## Adding New Technologies

Before adding a new dependency:
1. Check constitution alignment
2. Verify it works on target platforms
3. Document in this file with rationale
EOF
}

# =============================================================================
# Commands
# =============================================================================

# Show status of what exists
cmd_status() {
  local repo_root
  repo_root="$(get_repo_root)"
  local specify_dir="${repo_root}/.specify"

  # Collect counts
  local dirs_ok=0
  local dirs_missing=0
  local files_ok=0
  local files_missing=0
  local template_count=0
  local script_count=0

  # Check directories
  local dirs=(
    ".specify"
    ".specify/discovery"
    ".specify/memory"
    ".specify/memory/adrs"
    ".specify/templates"
    ".specify/scripts"
    ".specify/scripts/bash"
    ".specify/archive"
    "specs"
  )

  local missing_dirs=()
  for dir in "${dirs[@]}"; do
    if [[ -d "${repo_root}/${dir}" ]]; then
      ((dirs_ok++)) || true
    else
      ((dirs_missing++)) || true
      missing_dirs+=("$dir/")
    fi
  done

  # Check files
  local files=(
    ".specify/discovery/context.md"
    ".specify/discovery/state.md"
    ".specify/discovery/decisions.md"
    ".specify/orchestration-state.json"
    ".specify/manifest.json"
  )

  local missing_files=()
  for file in "${files[@]}"; do
    if [[ -f "${repo_root}/${file}" ]]; then
      ((files_ok++)) || true
    else
      ((files_missing++)) || true
      missing_files+=("$file")
    fi
  done

  # Count templates and scripts
  if [[ -d "${specify_dir}/templates" ]]; then
    template_count=$(find "${specify_dir}/templates" -name "*.md" -o -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
  fi
  if [[ -d "${specify_dir}/scripts/bash" ]]; then
    script_count=$(find "${specify_dir}/scripts/bash" -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
  fi

  # Three-Line Rule: Summary first
  local total_missing=$((dirs_missing + files_missing))
  if [[ $total_missing -eq 0 ]]; then
    echo -e "${GREEN}OK${RESET}: SpecKit project fully initialized"
    echo "  Dirs: $dirs_ok, Files: $files_ok, Templates: $template_count, Scripts: $script_count"
  else
    echo -e "${YELLOW}WARN${RESET}: SpecKit project incomplete"
    echo "  Missing: $dirs_missing dirs, $files_missing files"
    echo ""
    # Details (line 4+)
    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
      echo "Missing directories:"
      for item in "${missing_dirs[@]}"; do
        echo "  - $item"
      done
    fi
    if [[ ${#missing_files[@]} -gt 0 ]]; then
      echo "Missing files:"
      for item in "${missing_files[@]}"; do
        echo "  - $item"
      done
    fi
    echo ""
    echo "Run 'speckit scaffold' to create missing items."
  fi
}

# Create scaffold
cmd_scaffold() {
  local force="${1:-false}"
  local skip_templates="${2:-false}"
  local skip_scripts="${3:-false}"
  local safe_mode="${4:-false}"
  local project_type="${5:-}"

  local repo_root
  repo_root="$(get_repo_root)"
  local specify_dir="${repo_root}/.specify"

  # Auto-detect project type if not specified
  if [[ -z "$project_type" ]]; then
    project_type=$(detect_project_type "$repo_root")
  fi
  local project_type_name
  project_type_name=$(get_project_type_name "$project_type")

  # Safe mode: preview only
  if [[ "$safe_mode" == "true" ]]; then
    cmd_scaffold_preview "$repo_root" "$project_type" "$project_type_name"
    return 0
  fi

  # Check if already exists
  if [[ -d "$specify_dir" ]] && [[ "$force" != "true" ]]; then
    log_warn ".specify/ directory already exists"
    log_info "Use --force to overwrite, or --status to see what exists"
    exit 0
  fi

  # Three-line rule: Status comes from print_status below
  log_info "Project type: $project_type_name"

  # Create directories
  local dirs=(
    ".specify/discovery"
    ".specify/memory/adrs"
    ".specify/templates"
    ".specify/scripts/bash"
    ".specify/archive"
    "specs"
  )

  for dir in "${dirs[@]}"; do
    local full_path="${repo_root}/${dir}"
    ensure_dir "$full_path"
    log_debug "Created: $dir/"
  done

  print_status "ok" "Created directory structure"

  # Create discovery files
  local context_file="${specify_dir}/discovery/context.md"
  local state_file="${specify_dir}/discovery/state.md"
  local decisions_file="${specify_dir}/discovery/decisions.md"

  if [[ ! -f "$context_file" ]] || [[ "$force" == "true" ]]; then
    create_context_template > "$context_file"
    log_debug "Created: context.md"
  fi

  if [[ ! -f "$state_file" ]] || [[ "$force" == "true" ]]; then
    create_state_template > "$state_file"
    log_debug "Created: state.md"
  fi

  if [[ ! -f "$decisions_file" ]] || [[ "$force" == "true" ]]; then
    create_decisions_template > "$decisions_file"
    log_debug "Created: decisions.md"
  fi

  print_status "ok" "Created discovery files"

  # Create memory documents with project-type-specific content
  local constitution_file="${specify_dir}/memory/constitution.md"
  local tech_stack_file="${specify_dir}/memory/tech-stack.md"

  if [[ ! -f "$constitution_file" ]] || [[ "$force" == "true" ]]; then
    create_constitution_for_type "$project_type" > "$constitution_file"
    log_debug "Created: constitution.md ($project_type_name)"
  fi

  if [[ ! -f "$tech_stack_file" ]] || [[ "$force" == "true" ]]; then
    create_tech_stack_for_type "$project_type" > "$tech_stack_file"
    log_debug "Created: tech-stack.md ($project_type_name)"
  fi

  print_status "ok" "Created memory documents for $project_type_name"

  # Initialize state file
  local json_state_file="${specify_dir}/orchestration-state.json"
  if [[ ! -f "$json_state_file" ]] || [[ "$force" == "true" ]]; then
    # Use speckit-state.sh to create it
    bash "${SCRIPT_DIR}/speckit-state.sh" init --force 2>/dev/null || {
      # Fallback if state script fails
      local timestamp
      timestamp="$(iso_timestamp)"
      cat > "$json_state_file" << EOF
{
  "version": "2.0",
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
  },
  "project": {
    "name": null,
    "description": null,
    "type": null,
    "criticality": null
  },
  "interview": {
    "status": "not_started",
    "current_phase": 0,
    "current_question": 0,
    "decisions_count": 0,
    "phases": {},
    "started_at": null,
    "completed_at": null
  },
  "orchestration": {
    "phase_number": null,
    "phase_name": null,
    "branch": null,
    "step": null,
    "status": "not_started",
    "steps": {
      "specify": { "status": "pending", "completed_at": null, "artifacts": [] },
      "clarify": { "status": "pending", "completed_at": null, "artifacts": [] },
      "plan": { "status": "pending", "completed_at": null, "artifacts": [] },
      "tasks": { "status": "pending", "completed_at": null, "artifacts": [] },
      "analyze": { "status": "pending", "completed_at": null, "artifacts": [] },
      "checklist": { "status": "pending", "completed_at": null, "artifacts": [] },
      "implement": { "status": "pending", "completed_at": null, "tasks_completed": 0, "tasks_total": 0, "artifacts": [] },
      "verify": { "status": "pending", "completed_at": null, "artifacts": [] }
    }
  },
  "history": [],
  "last_updated": "$timestamp"
}
EOF
    }
    log_debug "Created: orchestration-state.json"
  fi

  print_status "ok" "Created state file"

  # Initialize version manifest
  local manifest_file="${specify_dir}/manifest.json"
  if [[ ! -f "$manifest_file" ]] || [[ "$force" == "true" ]]; then
    bash "${SCRIPT_DIR}/speckit-manifest.sh" init 2>/dev/null || {
      log_warn "Could not initialize manifest.json (non-critical)"
    }
    if [[ -f "$manifest_file" ]]; then
      print_status "ok" "Created version manifest"
    fi
  fi

  # Copy templates
  if [[ "$skip_templates" != "true" ]]; then
    local src_templates="${SPECKIT_SYSTEM_DIR}/templates"
    local dst_templates="${specify_dir}/templates"

    if [[ -d "$src_templates" ]]; then
      local copied=0
      # Use find to handle globs safely
      while IFS= read -r -d '' file; do
        if [[ -f "$file" ]]; then
          local filename
          filename=$(basename "$file")
          local dst_file="${dst_templates}/${filename}"

          # Copy with -n (no clobber) unless force
          if [[ "$force" == "true" ]] || [[ ! -f "$dst_file" ]]; then
            cp "$file" "$dst_file"
            ((copied++)) || true
          fi
        fi
      done < <(find "$src_templates" -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -print0 2>/dev/null)
      if [[ $copied -gt 0 ]]; then
        print_status "ok" "Copied $copied template(s)"
      else
        print_status "skip" "Templates already exist (use --force to overwrite)"
      fi
    else
      print_status "warn" "No user-scope templates found"
    fi
  fi

  # Copy scripts
  if [[ "$skip_scripts" != "true" ]]; then
    local src_scripts="${SPECKIT_SYSTEM_DIR}/scripts/bash"
    local dst_scripts="${specify_dir}/scripts/bash"

    if [[ -d "$src_scripts" ]]; then
      local copied=0
      # Use find to handle globs safely
      while IFS= read -r -d '' file; do
        if [[ -f "$file" ]]; then
          local filename
          filename=$(basename "$file")
          local dst_file="${dst_scripts}/${filename}"

          # Copy with -n (no clobber) unless force
          if [[ "$force" == "true" ]] || [[ ! -f "$dst_file" ]]; then
            cp "$file" "$dst_file"
            chmod +x "$dst_file"
            ((copied++)) || true
          fi
        fi
      done < <(find "$src_scripts" -maxdepth 1 -name "*.sh" -print0 2>/dev/null)
      if [[ $copied -gt 0 ]]; then
        print_status "ok" "Copied $copied script(s)"
      else
        print_status "skip" "Scripts already exist (use --force to overwrite)"
      fi
    else
      print_status "warn" "No user-scope scripts found"
    fi
  fi

  # Summary output (first 3 lines are user-critical)
  print_summary "ok" \
    "Created SpecKit project structure for $project_type_name" \
    "Created .specify/, specs/, memory docs" \
    "Run /speckit.init or /speckit.roadmap to continue"
}

# =============================================================================
# Main
# =============================================================================

main() {
  local force="false"
  local safe_mode="false"
  local skip_templates="false"
  local skip_scripts="false"
  local status_only="false"
  local project_type=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force|-f)
        force="true"
        shift
        ;;
      --safe)
        safe_mode="true"
        shift
        ;;
      --status|-s)
        status_only="true"
        shift
        ;;
      --type)
        if [[ -z "${2:-}" ]]; then
          log_error "--type requires a value"
          exit 1
        fi
        project_type="$2"
        if ! is_valid_project_type "$project_type"; then
          log_error "Invalid project type: $project_type"
          log_info "Valid types: typescript, javascript, python, rust, go, bash, generic"
          exit 1
        fi
        shift 2
        ;;
      --skip-templates)
        skip_templates="true"
        shift
        ;;
      --skip-scripts)
        skip_scripts="true"
        shift
        ;;
      --json)
        enable_json_output
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  # Validate we're in a git repo
  validate_context

  if [[ "$status_only" == "true" ]]; then
    cmd_status
  else
    cmd_scaffold "$force" "$skip_templates" "$skip_scripts" "$safe_mode" "$project_type"
  fi
}

main "$@"
