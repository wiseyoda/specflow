#!/usr/bin/env bash
#
# speckit-scaffold.sh - Create SpecKit project structure
#
# Usage:
#   speckit scaffold              Create .specify/ structure
#   speckit scaffold --force      Recreate (overwrites existing)
#   speckit scaffold --status     Check what exists
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Constants
# =============================================================================

readonly SPECKIT_SYSTEM_DIR="${HOME}/.claude/speckit-system"

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
    --status            Show what exists vs what's needed
    --skip-templates    Don't copy templates
    --skip-scripts      Don't copy scripts
    --json              Output in JSON format
    -h, --help          Show this help

CREATES:
    .specify/
    ├── discovery/
    │   ├── context.md
    │   ├── state.md
    │   └── decisions.md
    ├── memory/
    │   └── adrs/
    ├── templates/
    ├── scripts/
    │   └── bash/
    ├── archive/
    └── orchestration-state.json

    specs/                  (feature specifications)

EXAMPLES:
    speckit scaffold            # Create structure
    speckit scaffold --status   # Check what exists
    speckit scaffold --force    # Recreate everything
EOF
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
# Commands
# =============================================================================

# Show status of what exists
cmd_status() {
  local repo_root
  repo_root="$(get_repo_root)"
  local specify_dir="${repo_root}/.specify"

  print_header "SpecKit Project Status"

  # Check directories
  print_section "Directories"

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
      print_status "ok" "$dir/"
    else
      print_status "pending" "$dir/ (missing)"
    fi
  done

  # Check files
  print_section "Files"

  local files=(
    ".specify/discovery/context.md"
    ".specify/discovery/state.md"
    ".specify/discovery/decisions.md"
    ".specify/orchestration-state.json"
  )

  for file in "${files[@]}"; do
    local full_path="${repo_root}/${file}"
    if [[ -f "$full_path" ]]; then
      print_status "ok" "$file"
    else
      print_status "pending" "$file (missing)"
    fi
  done

  # Check templates
  print_section "Templates"
  local template_dir="${specify_dir}/templates"
  if [[ -d "$template_dir" ]]; then
    local count
    count=$(find "$template_dir" -name "*.md" -o -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
    print_status "ok" "$count template(s) in .specify/templates/"
  else
    print_status "pending" "No templates copied yet"
  fi

  # Check scripts
  print_section "Scripts"
  local scripts_dir="${specify_dir}/scripts/bash"
  if [[ -d "$scripts_dir" ]]; then
    local count
    count=$(find "$scripts_dir" -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
    print_status "ok" "$count script(s) in .specify/scripts/bash/"
  else
    print_status "pending" "No scripts copied yet"
  fi

  echo ""
}

# Create scaffold
cmd_scaffold() {
  local force="${1:-}"
  local skip_templates="${2:-}"
  local skip_scripts="${3:-}"

  local repo_root
  repo_root="$(get_repo_root)"
  local specify_dir="${repo_root}/.specify"

  # Check if already exists
  if [[ -d "$specify_dir" ]] && [[ "$force" != "true" ]]; then
    log_warn ".specify/ directory already exists"
    log_info "Use --force to overwrite, or --status to see what exists"
    exit 0
  fi

  log_step "Creating SpecKit project structure"

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

  echo ""
  log_success "SpecKit project structure created!"
  echo ""
  echo "Next steps:"
  echo "  1. Run /speckit.init to start the requirements interview"
  echo "  2. Or run /speckit.roadmap to create a project roadmap"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
  local force="false"
  local skip_templates="false"
  local skip_scripts="false"
  local status_only="false"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force|-f)
        force="true"
        shift
        ;;
      --status|-s)
        status_only="true"
        shift
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
    cmd_scaffold "$force" "$skip_templates" "$skip_scripts"
  fi
}

main "$@"
