#!/usr/bin/env bash
#
# specflow-reconcile.sh - Reconcile state file with actual file system
#
# Usage:
#   specflow reconcile                 Compare state with files
#   specflow reconcile --dry-run       Preview changes only
#   specflow reconcile --trust-files   Update state to match files
#   specflow reconcile --trust-state   Keep state, report differences
#
# This command helps when state and reality get out of sync.
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
specflow reconcile - Reconcile state file with file system

USAGE:
    specflow reconcile [options]

OPTIONS:
    --dry-run           Preview differences only, don't change anything
    --trust-files       Update state to match what files show
    --trust-state       Keep state values, just report differences
    --json              Output in JSON format
    -h, --help          Show this help

WHAT IT CHECKS:
    • Task completion (state vs tasks.md checkboxes)
    • Git branch (state vs current git branch)
    • Spec file existence (state says done vs files exist)
    • ROADMAP phase status consistency
    • Interview progress vs discovery files

EXAMPLES:
    specflow reconcile                  # Show differences
    specflow reconcile --dry-run        # Preview what would change
    specflow reconcile --trust-files    # Update state from files
EOF
}

# =============================================================================
# Comparison Functions
# =============================================================================

# POSIX-compatible storage (newline-delimited strings)
DIFFERENCES=""
FIXES=""

add_difference() {
  local area="$1"
  local state_value="$2"
  local file_value="$3"
  local description="$4"
  local entry="${area}|${state_value}|${file_value}|${description}"

  if [[ -n "$DIFFERENCES" ]]; then
    DIFFERENCES="${DIFFERENCES}"$'\n'"${entry}"
  else
    DIFFERENCES="${entry}"
  fi
}

add_fix() {
  if [[ -n "$FIXES" ]]; then
    FIXES="${FIXES}"$'\n'"$1"
  else
    FIXES="$1"
  fi
}

# Compare task completion
compare_tasks() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Three-line rule: Status output via print_status below

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file"
    return
  fi

  # Get tasks completed from state
  local state_completed
  state_completed=$(jq -r '.orchestration.progress.tasks_completed // 0' "$state_file" 2>/dev/null)
  local state_total
  state_total=$(jq -r '.orchestration.progress.tasks_total // 0' "$state_file" 2>/dev/null)

  # Find tasks.md file
  local current_phase
  current_phase=$(jq -r '.orchestration.phase.number // empty' "$state_file" 2>/dev/null)

  if [[ -z "$current_phase" ]]; then
    print_status skip "No active phase"
    return
  fi

  # Look for tasks.md in current phase
  local tasks_file
  tasks_file=$(find "${repo_root}/specs" -path "*${current_phase}*" -name "tasks.md" 2>/dev/null | head -1)

  if [[ -z "$tasks_file" || ! -f "$tasks_file" ]]; then
    print_status skip "No tasks.md for current phase"
    return
  fi

  # Count from file (grep -c exits 1 when no matches, so capture output first)
  local file_completed
  file_completed=$(grep -c '^\s*- \[x\]' "$tasks_file" 2>/dev/null) || file_completed=0
  local file_total
  file_total=$(grep -c '^\s*- \[' "$tasks_file" 2>/dev/null) || file_total=0

  if [[ "$state_completed" -eq "$file_completed" && "$state_total" -eq "$file_total" ]]; then
    print_status ok "Tasks: ${file_completed}/${file_total} (in sync)"
  else
    print_status warn "Tasks: state=${state_completed}/${state_total}, file=${file_completed}/${file_total}"
    add_difference "tasks" "${state_completed}/${state_total}" "${file_completed}/${file_total}" "Task completion mismatch"
  fi
}

# Compare git branch
compare_git_branch() {
  local state_file
  state_file="$(get_state_file)"

  # Three-line rule: Status output via print_status below

  if ! is_git_repo; then
    print_status skip "Not a git repository"
    return
  fi

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file"
    return
  fi

  local state_branch
  state_branch=$(jq -r '.orchestration.phase.branch // empty' "$state_file" 2>/dev/null)
  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

  if [[ -z "$state_branch" ]]; then
    print_status ok "No branch in state (none expected)"
  elif [[ "$state_branch" == "$current_branch" ]]; then
    print_status ok "Branch: ${current_branch} (in sync)"
  else
    print_status warn "Branch: state=${state_branch}, git=${current_branch}"
    add_difference "branch" "$state_branch" "$current_branch" "Git branch mismatch"
  fi
}

# Compare spec files existence
compare_specs() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Three-line rule: Status output via print_status below

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file"
    return
  fi

  # Check if specify step is complete (index > 0 means we've passed specify)
  local step_index
  step_index=$(jq -r '.orchestration.step.index // 0' "$state_file" 2>/dev/null)
  local current_phase
  current_phase=$(jq -r '.orchestration.phase.number // empty' "$state_file" 2>/dev/null)

  if [[ -z "$current_phase" ]]; then
    print_status skip "No active phase"
    return
  fi

  # Check if spec.md exists
  local spec_file
  spec_file=$(find "${repo_root}/specs" -path "*${current_phase}*" -name "spec.md" 2>/dev/null | head -1)

  if [[ "$step_index" -gt 0 ]]; then
    # We're past the specify step, so spec.md should exist
    if [[ -n "$spec_file" && -f "$spec_file" ]]; then
      print_status ok "Spec: exists (step ${step_index} past specify)"
    else
      print_status warn "Spec: past specify step but spec.md not found"
      add_difference "specify" "completed" "file missing" "Spec should exist but file missing"
    fi
  else
    # We're on specify step or earlier
    if [[ -n "$spec_file" && -f "$spec_file" ]]; then
      print_status ok "Spec: exists (step ${step_index})"
    else
      print_status ok "Spec: not yet created (step ${step_index})"
    fi
  fi
}

# Compare ROADMAP status
compare_roadmap() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Three-line rule: Status output via print_status below

  if [[ ! -f "${repo_root}/ROADMAP.md" ]]; then
    print_status skip "No ROADMAP.md"
    return
  fi

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file"
    return
  fi

  local orch_status
  orch_status=$(jq -r '.orchestration.phase.status // "not_started"' "$state_file" 2>/dev/null)
  local current_phase
  current_phase=$(jq -r '.orchestration.phase.number // empty' "$state_file" 2>/dev/null)

  if [[ -z "$current_phase" ]]; then
    print_status ok "No active phase in state"
    return
  fi

  # Check ROADMAP for phase status
  # Look for patterns in both table format (| 0170 | ... | ✅ Complete |)
  # and header format (## 0170 ... ✅)
  local roadmap_status="unknown"
  if grep -qE "^\|.*${current_phase}.*\|.*✅|^##.*${current_phase}.*✅" "${repo_root}/ROADMAP.md" 2>/dev/null; then
    roadmap_status="complete"
  elif grep -qE "^\|.*${current_phase}.*\|.*🔄|^\|.*${current_phase}.*\|.*In Progress|^##.*${current_phase}.*🔄" "${repo_root}/ROADMAP.md" 2>/dev/null; then
    roadmap_status="in_progress"
  elif grep -qE "^\|.*${current_phase}.*\||^##.*${current_phase}" "${repo_root}/ROADMAP.md" 2>/dev/null; then
    roadmap_status="pending"
  fi

  if [[ "$orch_status" == "in_progress" && "$roadmap_status" == "in_progress" ]]; then
    print_status ok "ROADMAP: Phase ${current_phase} in_progress (in sync)"
  elif [[ "$orch_status" == "completed" && "$roadmap_status" == "complete" ]]; then
    print_status ok "ROADMAP: Phase ${current_phase} complete (in sync)"
  elif [[ "$roadmap_status" == "unknown" ]]; then
    print_status warn "ROADMAP: Phase ${current_phase} status unknown"
  else
    print_status warn "ROADMAP: Phase ${current_phase} mismatch - state=${orch_status}, file=${roadmap_status}"
    add_difference "roadmap" "$orch_status" "$roadmap_status" "ROADMAP phase status mismatch"
  fi
}

# Compare interview progress
compare_interview() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Three-line rule: Status output via print_status below

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file"
    return
  fi

  local interview_status
  interview_status=$(jq -r '.interview.status // "not_started"' "$state_file" 2>/dev/null)
  local interview_phase
  interview_phase=$(jq -r '.interview.current_phase // 0' "$state_file" 2>/dev/null)

  # Check for discovery files
  local discovery_exists=false
  if [[ -f "${repo_root}/.specify/discovery/decisions.md" ]]; then
    discovery_exists=true
  fi

  # Check for memory documents (indicates completed interview)
  local memory_count=0
  if [[ -d "${repo_root}/.specify/memory" ]]; then
    memory_count=$(find "${repo_root}/.specify/memory" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [[ "$interview_status" == "completed" ]]; then
    if [[ $memory_count -gt 0 ]]; then
      print_status ok "Interview: completed (${memory_count} memory docs)"
    else
      print_status warn "Interview: state=completed but no memory docs found"
      add_difference "interview" "completed" "no memory docs" "Interview marked complete but no memory documents"
    fi
  elif [[ "$interview_status" == "in_progress" ]]; then
    if [[ "$discovery_exists" == "true" ]]; then
      print_status ok "Interview: in_progress (phase ${interview_phase})"
    else
      print_status warn "Interview: state=in_progress but no discovery files"
      add_difference "interview" "in_progress" "no discovery" "Interview in progress but no discovery files"
    fi
  else
    if [[ "$discovery_exists" == "true" ]]; then
      print_status warn "Interview: state=not_started but discovery files exist"
      add_difference "interview" "not_started" "discovery exists" "Discovery files exist but interview not started"
    else
      print_status ok "Interview: not_started (no discovery files)"
    fi
  fi
}

# =============================================================================
# Actions
# =============================================================================

apply_fixes() {
  local trust_mode="$1"
  local state_file
  state_file="$(get_state_file)"

  if [[ -z "$DIFFERENCES" ]]; then
    log_success "No differences found - state and files are in sync"
    return
  fi

  # Three-line rule: Status first, then details
  echo ""
  echo "Applying fixes..."
  echo ""

  while IFS= read -r diff; do
    [[ -z "$diff" ]] && continue
    IFS='|' read -r area state_value file_value description <<< "$diff"

    case "$area" in
      tasks)
        if [[ "$trust_mode" == "files" ]]; then
          local completed="${file_value%%/*}"
          local total="${file_value##*/}"
          json_set "$state_file" ".orchestration.progress.tasks_completed" "$completed"
          json_set "$state_file" ".orchestration.progress.tasks_total" "$total"
          log_success "Updated tasks to ${file_value}"
          add_fix "Updated task counts from files"
        else
          log_info "Would update tasks: ${state_value} → ${file_value}"
        fi
        ;;
      branch)
        if [[ "$trust_mode" == "files" ]]; then
          json_set_string "$state_file" ".orchestration.phase.branch" "$file_value"
          log_success "Updated branch to ${file_value}"
          add_fix "Updated branch from git"
        else
          log_info "Would update branch: ${state_value} → ${file_value}"
        fi
        ;;
      *)
        log_warn "Cannot auto-fix: $description"
        ;;
    esac
  done <<< "$DIFFERENCES"

  # Update timestamp
  if [[ "$trust_mode" == "files" ]]; then
    json_set_string "$state_file" ".last_updated" "$(iso_timestamp)"
  fi
}

show_summary() {
  # Three-line rule: Status first
  echo ""

  # Count differences and fixes (POSIX-compatible)
  local diff_count=0
  local fix_count=0
  if [[ -n "$DIFFERENCES" ]]; then
    diff_count=$(echo "$DIFFERENCES" | wc -l | tr -d ' ')
  fi
  if [[ -n "$FIXES" ]]; then
    fix_count=$(echo "$FIXES" | wc -l | tr -d ' ')
  fi

  if [[ $diff_count -eq 0 ]]; then
    log_success "State and files are in sync!"
    echo ""
    echo "No reconciliation needed."
  else
    log_warn "Found ${diff_count} difference(s):"
    echo ""

    while IFS= read -r diff; do
      [[ -z "$diff" ]] && continue
      IFS='|' read -r area state_value file_value description <<< "$diff"
      echo "  • ${description}"
      echo "    State: ${state_value}"
      echo "    Files: ${file_value}"
      echo ""
    done <<< "$DIFFERENCES"

    if [[ $fix_count -gt 0 ]]; then
      echo ""
      log_success "Applied ${fix_count} fix(es):"
      while IFS= read -r fix; do
        [[ -n "$fix" ]] && echo "  • $fix"
      done <<< "$FIXES"
    else
      echo "To fix, run:"
      echo "  specflow reconcile --trust-files    # Update state from files"
      echo "  specflow reconcile --trust-state    # Keep state, ignore differences"
    fi
  fi

  if is_json_output; then
    local diffs_json='[]'
    if [[ -n "$DIFFERENCES" ]]; then
      diffs_json=$(echo "$DIFFERENCES" | jq -R -s '
        split("\n") |
        map(select(. != "")) |
        map(split("|") | {area: .[0], state: .[1], files: .[2], description: .[3]})
      ')
    fi
    echo ""
    echo "{\"in_sync\": $(if [[ $diff_count -eq 0 ]]; then echo "true"; else echo "false"; fi), \"differences\": $diffs_json, \"fixes_applied\": ${fix_count}}"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  local dry_run=false
  local trust_mode=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        dry_run=true
        shift
        ;;
      --trust-files)
        trust_mode="files"
        shift
        ;;
      --trust-state)
        trust_mode="state"
        shift
        ;;
      --json)
        enable_json_output
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Run 'specflow reconcile --help' for usage"
        exit 1
        ;;
    esac
  done

  # Three-line rule: Skip decorative header, status comes from comparisons

  # Run comparisons
  compare_tasks
  echo ""
  compare_git_branch
  echo ""
  compare_specs
  echo ""
  compare_roadmap
  echo ""
  compare_interview

  # Apply fixes if requested
  if [[ "$trust_mode" == "files" && "$dry_run" == "false" ]]; then
    apply_fixes "files"
  elif [[ "$trust_mode" == "files" && "$dry_run" == "true" ]]; then
    echo ""
    log_info "Dry run - showing what would be fixed:"
    apply_fixes "dry-run"
  fi

  show_summary

  # Exit code based on differences
  if [[ -n "$DIFFERENCES" && -z "$trust_mode" ]]; then
    exit 2  # Differences found
  fi
}

main "$@"
