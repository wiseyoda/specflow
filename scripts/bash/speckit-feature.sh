#!/usr/bin/env bash
#
# speckit-feature.sh - Feature operations
#
# Usage:
#   speckit feature create <phase> <name>    Create new feature directory
#   speckit feature list                     List all features
#   speckit feature status                   Show feature status summary
#

set -euo pipefail
shopt -s extglob  # Required for extended glob patterns

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit feature - Feature operations

USAGE:
    speckit feature <command> [options]

COMMANDS:
    create <phase> <name>   Create new feature directory structure
                            Phase: 0010, 0020, etc. (4-digit ABBC format)
                            Name: kebab-case name (e.g., "user-auth")

    list                    List all features in specs/

    status                  Show feature status summary (with doc counts)

OPTIONS:
    --json              Output in JSON format
    --template <file>   Use custom spec template
    --no-branch         Don't create git branch
    -h, --help          Show this help

EXAMPLES:
    speckit feature create 0010 project-setup
    speckit feature create 0020 core-engine --no-branch
    speckit feature list
    speckit feature list --json
    speckit feature status
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get specs directory
get_specs_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/specs"
}

# Normalize phase number to 4 digits (ABBC format)
normalize_phase() {
  local phase="$1"
  # Strip all leading zeros to avoid octal interpretation
  local stripped="${phase##+(0)}"
  stripped="${stripped:-0}"  # Default to 0 if all zeros
  # Remove leading zeros using shell arithmetic
  stripped=$((10#$phase))
  printf "%04d" "$stripped" 2>/dev/null || echo "$phase"
}

# Validate feature name (kebab-case)
validate_feature_name() {
  local name="$1"
  if [[ ! "$name" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]]; then
    log_error "Invalid feature name: $name"
    log_info "Use kebab-case: lowercase letters, numbers, and hyphens"
    log_info "Examples: user-auth, core-engine, api-endpoints"
    return 1
  fi
  return 0
}

# Get spec template path
get_spec_template() {
  local system_dir
  system_dir="$(get_speckit_system_dir)"

  # Check project-specific template first
  local project_template
  project_template="$(get_specify_dir)/templates/spec-template.md"
  if [[ -f "$project_template" ]]; then
    echo "$project_template"
    return
  fi

  # Fall back to system template
  local system_template="${system_dir}/templates/spec-template.md"
  if [[ -f "$system_template" ]]; then
    echo "$system_template"
    return
  fi

  echo ""
}

# =============================================================================
# Commands
# =============================================================================

cmd_create() {
  local phase=""
  local name=""
  local create_branch=true
  local template=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --no-branch)
        create_branch=false
        shift
        ;;
      --template)
        template="$2"
        shift 2
        ;;
      -*)
        log_error "Unknown option: $1"
        exit 1
        ;;
      *)
        if [[ -z "$phase" ]]; then
          phase="$1"
        elif [[ -z "$name" ]]; then
          name="$1"
        else
          log_error "Too many arguments"
          exit 1
        fi
        shift
        ;;
    esac
  done

  # Validate inputs
  if [[ -z "$phase" ]] || [[ -z "$name" ]]; then
    log_error "Phase and name are required"
    echo "Usage: speckit feature create <phase> <name>"
    echo "Example: speckit feature create 0010 project-setup"
    exit 1
  fi

  # Normalize phase
  phase=$(normalize_phase "$phase")

  # Validate name
  if ! validate_feature_name "$name"; then
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local specs_dir
  specs_dir="$(get_specs_dir)"
  local feature_dir="${specs_dir}/${phase}-${name}"

  # Check if feature already exists
  if [[ -d "$feature_dir" ]]; then
    log_error "Feature directory already exists: $feature_dir"
    exit 1
  fi

  # Check if another feature with same phase exists
  local existing=""
  if [[ -d "$specs_dir" ]]; then
    existing=$(find "$specs_dir" -maxdepth 1 -type d -name "${phase}-*" 2>/dev/null | head -1 || true)
  fi
  if [[ -n "$existing" ]]; then
    log_error "A feature with phase $phase already exists: $existing"
    log_info "Choose a different phase number"
    exit 1
  fi

  # Three-line rule: Status will be shown after completion
  # Create directory structure
  ensure_dir "$feature_dir"
  ensure_dir "${feature_dir}/checklists"
  ensure_dir "${feature_dir}/contracts"

  # Get template
  if [[ -z "$template" ]]; then
    template=$(get_spec_template)
  fi

  # Create initial spec.md
  if [[ -n "$template" ]] && [[ -f "$template" ]]; then
    # Use template, replacing placeholders
    sed -e "s/{{PHASE}}/${phase}/g" \
        -e "s/{{NAME}}/${name}/g" \
        -e "s/{{DATE}}/$(current_date)/g" \
        -e "s/{{FEATURE_NAME}}/${phase}-${name}/g" \
        "$template" > "${feature_dir}/spec.md"
    print_status ok "Created spec.md from template"
  else
    # Create minimal spec.md
    cat > "${feature_dir}/spec.md" << EOF
# ${phase} - ${name}

> Feature specification

## Overview

[Describe the feature here]

## User Stories

### Story 1: [Story Name]

**As a** [user type]
**I want to** [action]
**So that** [benefit]

#### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes

[Add technical considerations]

## Out of Scope

- [What is NOT included in this feature]

---

**Created**: $(current_date)
**Status**: Draft
EOF
    print_status ok "Created minimal spec.md"
  fi

  # Create .gitkeep files for empty directories
  touch "${feature_dir}/checklists/.gitkeep"
  touch "${feature_dir}/contracts/.gitkeep"

  # Create git branch if requested
  if $create_branch; then
    local branch_name="${phase}-${name}"
    if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
      log_warn "Branch ${branch_name} already exists"
    else
      git checkout -b "${branch_name}"
      print_status ok "Created and switched to branch: ${branch_name}"
    fi
  fi

  # Update state file if it exists
  local state_file
  state_file="$(get_state_file)"
  if [[ -f "$state_file" ]]; then
    # Update current phase info
    json_set_string "$state_file" ".orchestration.current_phase" "${phase}"
    json_set_string "$state_file" ".orchestration.current_feature" "${phase}-${name}"
    print_status ok "Updated state file"
  fi

  echo ""
  log_success "Feature created: ${phase}-${name}"
  echo ""
  echo "Feature directory: $feature_dir"
  echo ""
  echo "Next steps:"
  echo "  1. Edit spec.md to define the feature"
  echo "  2. Run /speckit.specify to elaborate the spec"
  echo "  3. Run /speckit.plan to create implementation plan"

  if is_json_output; then
    cat << EOF
{
  "feature_dir": "$feature_dir",
  "phase": "$phase",
  "name": "$name",
  "branch": "${phase}-${name}",
  "created": true
}
EOF
  fi
}

cmd_list() {
  local specs_dir
  specs_dir="$(get_specs_dir)"

  if [[ ! -d "$specs_dir" ]]; then
    if is_json_output; then
      echo '{"features": [], "count": 0}'
    else
      log_info "No specs/ directory found"
    fi
    exit 0
  fi

  local features=()
  while IFS= read -r -d '' dir; do
    local name
    name=$(basename "$dir")
    features+=("$name")
  done < <(find "$specs_dir" -maxdepth 1 -type d \( -name "[0-9][0-9][0-9]-*" -o -name "[0-9][0-9][0-9][0-9]-*" \) -print0 | sort -z)

  if is_json_output; then
    local json_array="[]"
    for feat in "${features[@]}"; do
      json_array=$(echo "$json_array" | jq --arg f "$feat" '. + [$f]')
    done
    echo "{\"features\": $json_array, \"count\": ${#features[@]}}"
  else
    # Three-Line Rule: Summary first
    if [[ ${#features[@]} -eq 0 ]]; then
      echo -e "${YELLOW}WARN${RESET}: No features found"
      echo "  Path: specs/"
    else
      echo -e "${BLUE}INFO${RESET}: ${#features[@]} feature(s)"
      echo ""
      # Details (line 3+)
      for feat in "${features[@]}"; do
        echo "  $feat"
      done
    fi
  fi
}

cmd_status() {
  local specs_dir
  specs_dir="$(get_specs_dir)"

  if [[ ! -d "$specs_dir" ]]; then
    if is_json_output; then
      echo '{"features": [], "count": 0}'
    else
      log_info "No specs/ directory found"
    fi
    exit 0
  fi

  if is_json_output; then
    local features="[]"
    while IFS= read -r -d '' dir; do
      local name
      name=$(basename "$dir")
      local has_spec="false"
      local has_plan="false"
      local has_tasks="false"

      [[ -f "${dir}/spec.md" ]] && has_spec="true"
      [[ -f "${dir}/plan.md" ]] && has_plan="true"
      [[ -f "${dir}/tasks.md" ]] && has_tasks="true"

      features=$(echo "$features" | jq \
        --arg name "$name" \
        --argjson spec "$has_spec" \
        --argjson plan "$has_plan" \
        --argjson tasks "$has_tasks" \
        '. + [{"name": $name, "has_spec": $spec, "has_plan": $plan, "has_tasks": $tasks}]')
    done < <(find "$specs_dir" -maxdepth 1 -type d \( -name "[0-9][0-9][0-9]-*" -o -name "[0-9][0-9][0-9][0-9]-*" \) -print0 | sort -z)

    echo "{\"features\": $features}"
  else
    # Three-Line Rule: Count features first
    local feature_count
    feature_count=$(find "$specs_dir" -maxdepth 1 -type d \( -name "[0-9][0-9][0-9]-*" -o -name "[0-9][0-9][0-9][0-9]-*" \) 2>/dev/null | wc -l | tr -d ' ')
    echo -e "${BLUE}INFO${RESET}: $feature_count feature(s) in specs/"
    echo ""
    # Details (line 3+)
    printf "%-30s %-10s %-10s %-10s\n" "FEATURE" "SPEC" "PLAN" "TASKS"
    printf "%-30s %-10s %-10s %-10s\n" "-------" "----" "----" "-----"

    while IFS= read -r -d '' dir; do
      local name
      name=$(basename "$dir")
      local spec_status="✗"
      local plan_status="✗"
      local tasks_status="✗"

      [[ -f "${dir}/spec.md" ]] && spec_status="✓"
      [[ -f "${dir}/plan.md" ]] && plan_status="✓"
      [[ -f "${dir}/tasks.md" ]] && tasks_status="✓"

      printf "%-30s %-10s %-10s %-10s\n" "$name" "$spec_status" "$plan_status" "$tasks_status"
    done < <(find "$specs_dir" -maxdepth 1 -type d \( -name "[0-9][0-9][0-9]-*" -o -name "[0-9][0-9][0-9][0-9]-*" \) -print0 | sort -z)
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  parse_common_flags "$@"
  set -- "${REMAINING_ARGS[@]:-}"

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local command="$1"
  shift

  case "$command" in
    create)
      cmd_create "$@"
      ;;
    list|ls)
      cmd_list
      ;;
    status|st)
      cmd_status
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'speckit feature --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
