#!/usr/bin/env bash
#
# speckit-context.sh - Get current feature context
#
# Replaces check-prerequisites.sh with a proper CLI command.
# Detects the current feature based on branch name and returns
# paths and available documents.
#
# Usage:
#   speckit context              Show current feature context
#   speckit context --json       Output as JSON
#   speckit context --require-spec   Require spec.md to exist
#   speckit context --require-plan   Require plan.md to exist
#   speckit context --require-tasks  Require tasks.md to exist
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit context - Get current feature context

USAGE:
    speckit context [options]

DESCRIPTION:
    Detects the current feature from git branch name (NNN-feature-name pattern)
    and returns paths to feature artifacts and available documents.

OPTIONS:
    --json              Output in JSON format
    --require-spec      Require spec.md to exist (exit 1 if missing)
    --require-plan      Require plan.md to exist (exit 1 if missing)
    --require-tasks     Require tasks.md to exist (exit 1 if missing)
    --include-tasks     Include tasks.md in available docs (default, for compatibility)
    --paths-only        Output only path variables (minimal output)
    --quiet, -q         Suppress non-essential output
    -h, --help          Show this help

OUTPUTS:
    Text mode:
        FEATURE_DIR: /path/to/specs/NNN-feature-name
        BRANCH: NNN-feature-name
        PHASE: NNN
        AVAILABLE_DOCS:
          ✓ spec.md
          ✓ plan.md
          ✗ tasks.md
          ...

    JSON mode:
        {
          "feature_dir": "/path/to/specs/NNN-feature-name",
          "branch": "NNN-feature-name",
          "phase": "NNN",
          "docs": {
            "spec": true,
            "plan": true,
            "tasks": false,
            ...
          },
          "available_docs": ["spec.md", "plan.md", ...]
        }

EXAMPLES:
    speckit context
    speckit context --json
    speckit context --require-plan --json
    speckit context --require-tasks
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Extract phase number from branch name (e.g., "001-feature-name" -> "001", "0010-feature" -> "0010")
get_phase_from_branch() {
  local branch="$1"
  # Support both 3-digit (NNN-) and 4-digit (NNNN-) phase numbers
  if [[ "$branch" =~ ^([0-9]{3,4})- ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

# Find feature directory from phase number
find_feature_dir() {
  local phase="$1"
  local repo_root
  repo_root="$(get_repo_root)"
  local specs_dir="${repo_root}/specs"

  if [[ ! -d "$specs_dir" ]]; then
    echo ""
    return
  fi

  # Find directory matching NNN-*
  local feature_dir
  feature_dir=$(find "$specs_dir" -maxdepth 1 -type d -name "${phase}-*" 2>/dev/null | head -1)

  echo "$feature_dir"
}

# Document existence variables (set by check_docs)
# Using individual variables instead of associative arrays for bash 3.x compatibility
DOC_SPEC="false"
DOC_PLAN="false"
DOC_TASKS="false"
DOC_RESEARCH="false"
DOC_DATA_MODEL="false"
DOC_CONTRACTS="false"
DOC_QUICKSTART="false"
DOC_CHECKLISTS="false"

# Check which documents exist in feature directory
# Sets global DOC_* variables
check_docs() {
  local feature_dir="$1"

  # Reset all to false
  DOC_SPEC="false"
  DOC_PLAN="false"
  DOC_TASKS="false"
  DOC_RESEARCH="false"
  DOC_DATA_MODEL="false"
  DOC_CONTRACTS="false"
  DOC_QUICKSTART="false"
  DOC_CHECKLISTS="false"

  # Check each document type
  [[ -f "${feature_dir}/spec.md" ]] && DOC_SPEC="true"
  [[ -f "${feature_dir}/plan.md" ]] && DOC_PLAN="true"
  [[ -f "${feature_dir}/tasks.md" ]] && DOC_TASKS="true"
  [[ -f "${feature_dir}/research.md" ]] && DOC_RESEARCH="true"
  [[ -f "${feature_dir}/data-model.md" ]] && DOC_DATA_MODEL="true"
  [[ -d "${feature_dir}/contracts" ]] && [[ -n "$(ls -A "${feature_dir}/contracts" 2>/dev/null)" ]] && DOC_CONTRACTS="true"
  [[ -f "${feature_dir}/quickstart.md" ]] && DOC_QUICKSTART="true"
  [[ -d "${feature_dir}/checklists" ]] && [[ -n "$(ls -A "${feature_dir}/checklists" 2>/dev/null)" ]] && DOC_CHECKLISTS="true"

  # Ensure function returns 0 (set -e would exit on last command's non-zero return)
  return 0
}

# =============================================================================
# Main Command
# =============================================================================

cmd_context() {
  local require_spec=false
  local require_plan=false
  local require_tasks=false
  local include_tasks=false  # No-op, tasks always included, kept for compatibility
  local paths_only=false
  local quiet=false

  # Parse options
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --require-spec)
        require_spec=true
        shift
        ;;
      --require-plan)
        require_plan=true
        shift
        ;;
      --require-tasks)
        require_tasks=true
        shift
        ;;
      --include-tasks)
        include_tasks=true  # No-op, kept for backward compatibility
        shift
        ;;
      --paths-only)
        paths_only=true
        shift
        ;;
      --quiet|-q)
        quiet=true
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  # Validate we're in a git repo
  if ! is_git_repo; then
    if is_json_output; then
      echo '{"error": "Not in a git repository"}'
    else
      log_error "Not in a git repository"
    fi
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"

  # Get current branch
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

  if [[ -z "$branch" ]]; then
    if is_json_output; then
      echo '{"error": "Could not determine current branch"}'
    else
      log_error "Could not determine current branch"
    fi
    exit 1
  fi

  # Extract phase number
  local phase
  phase=$(get_phase_from_branch "$branch")

  if [[ -z "$phase" ]]; then
    if is_json_output; then
      echo "{\"error\": \"Branch '$branch' does not match feature branch pattern (NNN-name or NNNN-name)\", \"branch\": \"$branch\"}"
    else
      log_error "Branch '$branch' does not match feature branch pattern (NNN-name or NNNN-name)"
      log_info "Feature branches should be named: 001-project-setup, 0010-core-engine, etc."
    fi
    exit 1
  fi

  # Find feature directory
  local feature_dir
  feature_dir=$(find_feature_dir "$phase")

  if [[ -z "$feature_dir" ]] || [[ ! -d "$feature_dir" ]]; then
    if is_json_output; then
      echo "{\"error\": \"No feature directory found for phase $phase\", \"phase\": \"$phase\", \"branch\": \"$branch\", \"specs_dir\": \"${repo_root}/specs\"}"
    else
      log_error "No feature directory found for phase $phase"
      log_info "Expected directory: specs/${phase}-*"
      log_info "Create with: /speckit.specify or speckit feature create"
    fi
    exit 1
  fi

  # Check available documents (sets DOC_* global variables)
  check_docs "$feature_dir"

  # Check requirements
  if $require_spec && [[ "$DOC_SPEC" == "false" ]]; then
    if is_json_output; then
      echo "{\"error\": \"spec.md not found\", \"feature_dir\": \"$feature_dir\"}"
    else
      log_error "spec.md not found in $feature_dir"
      log_info "Run /speckit.specify to create the specification"
    fi
    exit 1
  fi

  if $require_plan && [[ "$DOC_PLAN" == "false" ]]; then
    if is_json_output; then
      echo "{\"error\": \"plan.md not found\", \"feature_dir\": \"$feature_dir\"}"
    else
      log_error "plan.md not found in $feature_dir"
      log_info "Run /speckit.plan to create the implementation plan"
    fi
    exit 1
  fi

  if $require_tasks && [[ "$DOC_TASKS" == "false" ]]; then
    if is_json_output; then
      echo "{\"error\": \"tasks.md not found\", \"feature_dir\": \"$feature_dir\"}"
    else
      log_error "tasks.md not found in $feature_dir"
      log_info "Run /speckit.tasks to create the task list"
    fi
    exit 1
  fi

  # Build available docs list
  local available_docs=()
  [[ "$DOC_SPEC" == "true" ]] && available_docs+=("spec.md")
  [[ "$DOC_PLAN" == "true" ]] && available_docs+=("plan.md")
  [[ "$DOC_TASKS" == "true" ]] && available_docs+=("tasks.md")
  [[ "$DOC_RESEARCH" == "true" ]] && available_docs+=("research.md")
  [[ "$DOC_DATA_MODEL" == "true" ]] && available_docs+=("data-model.md")
  [[ "$DOC_CONTRACTS" == "true" ]] && available_docs+=("contracts/")
  [[ "$DOC_QUICKSTART" == "true" ]] && available_docs+=("quickstart.md")
  [[ "$DOC_CHECKLISTS" == "true" ]] && available_docs+=("checklists/")

  # Output results
  if is_json_output; then
    # Paths-only mode: minimal JSON output
    if $paths_only; then
      local available_json="[]"
      if [[ ${#available_docs[@]} -gt 0 ]]; then
        available_json=$(printf '"%s",' "${available_docs[@]}")
        available_json="[${available_json%,}]"
      fi
      cat << EOF
{
  "FEATURE_DIR": "$feature_dir",
  "AVAILABLE_DOCS": $available_json
}
EOF
    else
      # Full JSON output
      local docs_json
      docs_json=$(cat << EOF
{
  "spec": ${DOC_SPEC},
  "plan": ${DOC_PLAN},
  "tasks": ${DOC_TASKS},
  "research": ${DOC_RESEARCH},
  "data_model": ${DOC_DATA_MODEL},
  "contracts": ${DOC_CONTRACTS},
  "quickstart": ${DOC_QUICKSTART},
  "checklists": ${DOC_CHECKLISTS}
}
EOF
)

      local available_json="[]"
      if [[ ${#available_docs[@]} -gt 0 ]]; then
        available_json=$(printf '"%s",' "${available_docs[@]}")
        available_json="[${available_json%,}]"
      fi

      cat << EOF
{
  "feature_dir": "$feature_dir",
  "branch": "$branch",
  "phase": "$phase",
  "repo_root": "$repo_root",
  "docs": $docs_json,
  "available_docs": $available_json,
  "FEATURE_DIR": "$feature_dir",
  "AVAILABLE_DOCS": $available_json
}
EOF
    fi
  else
    # Text output
    if $paths_only; then
      # Minimal text output for paths-only mode
      echo "FEATURE_DIR: $feature_dir"
      if [[ ${#available_docs[@]} -gt 0 ]]; then
        echo "AVAILABLE_DOCS: ${available_docs[*]}"
      else
        echo "AVAILABLE_DOCS:"
      fi
    else
      if ! $quiet; then
        print_header "Feature Context"
        echo ""
      fi

      echo "FEATURE_DIR: $feature_dir"
      echo "BRANCH: $branch"
      echo "PHASE: $phase"
      echo ""

      if ! $quiet; then
        echo "AVAILABLE_DOCS:"
        [[ "$DOC_SPEC" == "true" ]] && print_status ok "spec.md" || print_status fail "spec.md"
        [[ "$DOC_PLAN" == "true" ]] && print_status ok "plan.md" || print_status fail "plan.md"
        [[ "$DOC_TASKS" == "true" ]] && print_status ok "tasks.md" || print_status fail "tasks.md"
        [[ "$DOC_RESEARCH" == "true" ]] && print_status ok "research.md" || print_status skip "research.md (optional)"
        [[ "$DOC_DATA_MODEL" == "true" ]] && print_status ok "data-model.md" || print_status skip "data-model.md (optional)"
        [[ "$DOC_CONTRACTS" == "true" ]] && print_status ok "contracts/" || print_status skip "contracts/ (optional)"
        [[ "$DOC_QUICKSTART" == "true" ]] && print_status ok "quickstart.md" || print_status skip "quickstart.md (optional)"
        [[ "$DOC_CHECKLISTS" == "true" ]] && print_status ok "checklists/" || print_status skip "checklists/ (optional)"
      fi
    fi
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  parse_common_flags "$@"
  set -- "${REMAINING_ARGS[@]:-}"

  # Check for help
  for arg in "$@"; do
    case "$arg" in
      help|--help|-h)
        show_help
        exit 0
        ;;
    esac
  done

  cmd_context "$@"
}

main "$@"
