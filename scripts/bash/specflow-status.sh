#!/usr/bin/env bash
#
# specflow-status.sh - Comprehensive project status for orchestration
#
# Usage:
#   specflow status              Show full status
#   specflow status --json       JSON output for orchestrate consumption
#   specflow status --quick      Skip deep validation (faster)
#
# Returns everything needed to resume orchestration in ONE call:
# - Health/validation status
# - Current phase and step
# - Git branch status
# - Artifact existence
# - Task progress
# - ROADMAP phase status
# - Next recommended action
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
specflow status - Comprehensive project status

USAGE:
    specflow status [options]

OPTIONS:
    --json              Output as JSON (for orchestrate consumption)
    --quick             Skip deep validation (faster startup)
    -h, --help          Show this help

OUTPUT:
    Provides everything needed to resume orchestration:
    - Health check results
    - Current phase and step
    - Git branch and sync status
    - Artifact existence (spec, plan, tasks, checklists)
    - Task completion progress
    - ROADMAP phase status
    - Recommended next action

EXAMPLES:
    specflow status              # Human-readable status
    specflow status --json       # JSON for orchestrate
    specflow status --quick      # Skip deep checks
EOF
}

# =============================================================================
# Artifact Detection Functions
# =============================================================================

# Detect step from filesystem artifacts
# Returns the highest step that can be inferred from existing artifacts
detect_step_from_artifacts() {
  local feature_dir="$1"
  local detected_step="specify"
  local detected_index=0

  if [[ ! -d "$feature_dir" ]]; then
    echo "specify:0"
    return
  fi

  # Check spec.md exists (step 1: clarify)
  if [[ -f "${feature_dir}/spec.md" ]]; then
    detected_step="clarify"
    detected_index=1
  fi

  # Check plan.md exists (step 3: plan -> tasks)
  if [[ -f "${feature_dir}/plan.md" ]]; then
    detected_step="tasks"
    detected_index=3
  fi

  # Check tasks.md exists (step 4: analyze)
  if [[ -f "${feature_dir}/tasks.md" ]]; then
    detected_step="analyze"
    detected_index=4
  fi

  # Check checklists/ exists (step 6: implement)
  if [[ -d "${feature_dir}/checklists" ]] && [[ -n "$(ls -A "${feature_dir}/checklists" 2>/dev/null)" ]]; then
    detected_step="implement"
    detected_index=6
  fi

  # Check task completion (step 7: verify)
  if [[ -f "${feature_dir}/tasks.md" ]]; then
    local total_tasks completed_tasks
    # Use grep | wc -l instead of grep -c to avoid exit code 1 when count is 0
    total_tasks=$(grep -E '^\s*- \[.\] T[0-9]{3}' "${feature_dir}/tasks.md" 2>/dev/null | wc -l | tr -d ' ')
    completed_tasks=$(grep -E '^\s*- \[x\] T[0-9]{3}' "${feature_dir}/tasks.md" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$total_tasks" -gt 0 && "$completed_tasks" -eq "$total_tasks" ]]; then
      detected_step="verify"
      detected_index=7
    fi
  fi

  echo "${detected_step}:${detected_index}"
}

# Get actual task counts from filesystem
get_task_counts_from_file() {
  local tasks_file="$1"

  if [[ ! -f "$tasks_file" ]]; then
    echo "0:0"
    return
  fi

  local total completed
  # Use grep | wc -l instead of grep -c to avoid exit code 1 when count is 0
  total=$(grep -E '^\s*- \[.\] T[0-9]{3}' "$tasks_file" 2>/dev/null | wc -l | tr -d ' ')
  completed=$(grep -E '^\s*- \[x\] T[0-9]{3}' "$tasks_file" 2>/dev/null | wc -l | tr -d ' ')

  echo "${completed}:${total}"
}

# =============================================================================
# Status Collection
# =============================================================================

collect_status() {
  local quick_mode="${1:-false}"
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Initialize result object
  local result='{}'
  local health_ok=true
  local issues='[]'

  # -------------------------------------------------------------------------
  # 1. Health Check (quick validation)
  # -------------------------------------------------------------------------

  # Check state file
  if [[ ! -f "$state_file" ]]; then
    health_ok=false
    issues=$(echo "$issues" | jq '. + ["State file not found"]')
  elif ! jq empty "$state_file" 2>/dev/null; then
    health_ok=false
    issues=$(echo "$issues" | jq '. + ["State file is not valid JSON"]')
  fi

  # Check ROADMAP
  if [[ ! -f "${repo_root}/ROADMAP.md" ]]; then
    health_ok=false
    issues=$(echo "$issues" | jq '. + ["ROADMAP.md not found"]')
  fi

  # Check .specify directory
  if [[ ! -d "${repo_root}/.specify" ]]; then
    health_ok=false
    issues=$(echo "$issues" | jq '. + [".specify directory not found"]')
  fi

  # Deep validation (unless quick mode)
  if [[ "$quick_mode" == "false" && "$health_ok" == "true" ]]; then
    # Check for jq
    if ! command -v jq &>/dev/null; then
      health_ok=false
      issues=$(echo "$issues" | jq '. + ["jq not installed"]')
    fi

    # Check schema version
    local schema_version
    schema_version=$(jq -r '.schema_version // "unknown"' "$state_file" 2>/dev/null)
    if [[ "$schema_version" != "2.0" ]]; then
      issues=$(echo "$issues" | jq --arg v "$schema_version" '. + ["State schema version is \($v), expected 2.0"]')
    fi
  fi

  result=$(echo "$result" | jq --argjson ok "$health_ok" --argjson issues "$issues" '.health = {ok: $ok, issues: $issues}')

  # If health check failed, return early
  if [[ "$health_ok" == "false" ]]; then
    result=$(echo "$result" | jq '.ready = false | .next_action = "fix_health"')
    echo "$result"
    return
  fi

  # -------------------------------------------------------------------------
  # 2. Orchestration State
  # -------------------------------------------------------------------------

  local phase_number phase_name phase_branch phase_status
  phase_number=$(jq -r '.orchestration.phase.number // null' "$state_file")
  phase_name=$(jq -r '.orchestration.phase.name // null' "$state_file")
  phase_branch=$(jq -r '.orchestration.phase.branch // null' "$state_file")
  phase_status=$(jq -r '.orchestration.phase.status // "not_started"' "$state_file")

  local step_current step_index step_status
  step_current=$(jq -r '.orchestration.step.current // null' "$state_file")
  step_index=$(jq -r '.orchestration.step.index // 0' "$state_file")
  step_status=$(jq -r '.orchestration.step.status // "not_started"' "$state_file")

  # -------------------------------------------------------------------------
  # Filesystem-Derived State (source of truth)
  # -------------------------------------------------------------------------

  # Find feature directory for artifact detection
  local feature_dir=""
  if [[ -n "$phase_number" && "$phase_number" != "null" ]]; then
    feature_dir=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "*${phase_number}*" 2>/dev/null | head -1)
  fi

  # Derive step from filesystem artifacts
  local derived_step="" derived_index=0
  local state_mismatch=false
  if [[ -n "$feature_dir" && -d "$feature_dir" ]]; then
    local derived_result
    derived_result=$(detect_step_from_artifacts "$feature_dir")
    derived_step="${derived_result%%:*}"
    derived_index="${derived_result##*:}"

    # Check if state file is behind filesystem
    if [[ "$derived_index" -gt "$step_index" ]]; then
      state_mismatch=true
      # Use derived values as source of truth
      step_current="$derived_step"
      step_index="$derived_index"
    fi
  fi

  # Get task counts from filesystem (source of truth)
  local tasks_completed=0 tasks_total=0 tasks_percentage=0
  if [[ -n "$feature_dir" && -f "${feature_dir}/tasks.md" ]]; then
    local task_counts
    task_counts=$(get_task_counts_from_file "${feature_dir}/tasks.md")
    tasks_completed="${task_counts%%:*}"
    tasks_total="${task_counts##*:}"
  fi

  if [[ "$tasks_total" -gt 0 ]]; then
    tasks_percentage=$((tasks_completed * 100 / tasks_total))
  fi

  result=$(echo "$result" | jq \
    --arg pn "$phase_number" \
    --arg pname "$phase_name" \
    --arg pb "$phase_branch" \
    --arg ps "$phase_status" \
    --arg sc "$step_current" \
    --argjson si "$step_index" \
    --arg ss "$step_status" \
    --argjson tc "$tasks_completed" \
    --argjson tt "$tasks_total" \
    --argjson tp "$tasks_percentage" \
    --argjson sm "$state_mismatch" \
    --arg ds "$derived_step" \
    --argjson di "$derived_index" \
    '.phase = {number: $pn, name: $pname, branch: $pb, status: $ps} |
     .step = {current: $sc, index: $si, status: $ss, derived_from_files: $sm, derived_step: $ds, derived_index: $di} |
     .tasks = {completed: $tc, total: $tt, percentage: $tp}')

  # -------------------------------------------------------------------------
  # 3. Git Status
  # -------------------------------------------------------------------------

  local git_branch=""
  local git_matches=true
  local git_uncommitted=0
  local feature_branch_exists=true
  local phase_merged=false

  if is_git_repo; then
    git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    # Check if feature branch exists (locally or remotely)
    if [[ -n "$phase_branch" && "$phase_branch" != "null" ]]; then
      if ! git rev-parse --verify "$phase_branch" &>/dev/null && \
         ! git rev-parse --verify "origin/$phase_branch" &>/dev/null; then
        feature_branch_exists=false
      fi

      # Check if phase was merged to main (look for merge commit or PR merge)
      if [[ "$git_branch" == "main" || "$git_branch" == "master" ]]; then
        # Check for conventional commit format: feat(0170): or fix(0170):
        if git log --oneline -20 2>/dev/null | grep -qE "(feat|fix|chore|docs)\(${phase_number}\)"; then
          phase_merged=true
        # Check git log for merge commits mentioning the phase
        elif git log --oneline -20 --grep="$phase_number" 2>/dev/null | grep -q .; then
          phase_merged=true
        # Also check for PR merge pattern: Phase NNNN or #N
        elif git log --oneline -20 2>/dev/null | grep -qiE "Phase.*${phase_number}|${phase_number}.*phase"; then
          phase_merged=true
        fi
      fi
    fi

    # Smart branch matching logic
    if [[ -n "$phase_branch" && "$phase_branch" != "null" && "$git_branch" != "$phase_branch" ]]; then
      if [[ "$feature_branch_exists" == "false" && "$phase_merged" == "true" ]]; then
        # Branch deleted after merge - this is expected, not an error
        git_matches=true
      elif [[ "$feature_branch_exists" == "false" && ("$git_branch" == "main" || "$git_branch" == "master") ]]; then
        # On main, branch deleted but merge not confirmed - likely merged externally
        git_matches=true
      else
        git_matches=false
      fi
    fi

    # Count uncommitted changes (quick)
    git_uncommitted=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  fi

  result=$(echo "$result" | jq \
    --arg branch "$git_branch" \
    --argjson matches "$git_matches" \
    --argjson uncommitted "$git_uncommitted" \
    --argjson branch_exists "$feature_branch_exists" \
    --argjson merged "$phase_merged" \
    '.git = {branch: $branch, matches_state: $matches, uncommitted: $uncommitted, feature_branch_exists: $branch_exists, phase_merged: $merged}')

  # -------------------------------------------------------------------------
  # 4. Artifact Existence
  # -------------------------------------------------------------------------

  local artifacts='{}'
  # feature_dir already found above in Filesystem-Derived State section
  if [[ -n "$feature_dir" && -d "$feature_dir" ]]; then
    artifacts=$(echo "$artifacts" | jq \
      --argjson spec "$([[ -f "${feature_dir}/spec.md" ]] && echo true || echo false)" \
      --argjson plan "$([[ -f "${feature_dir}/plan.md" ]] && echo true || echo false)" \
      --argjson tasks "$([[ -f "${feature_dir}/tasks.md" ]] && echo true || echo false)" \
      --argjson checklists "$([[ -d "${feature_dir}/checklists" ]] && echo true || echo false)" \
      --argjson research "$([[ -f "${feature_dir}/research.md" ]] && echo true || echo false)" \
      '. + {spec: $spec, plan: $plan, tasks: $tasks, checklists: $checklists, research: $research}')
  fi

  result=$(echo "$result" | jq --argjson a "$artifacts" '.artifacts = $a')

  # -------------------------------------------------------------------------
  # 5. ROADMAP Phase Status
  # -------------------------------------------------------------------------

  local roadmap_status="unknown"
  if [[ -n "$phase_number" && "$phase_number" != "null" && -f "${repo_root}/ROADMAP.md" ]]; then
    if grep -qE "^\|.*${phase_number}.*\|.*✅|^##.*${phase_number}.*✅" "${repo_root}/ROADMAP.md" 2>/dev/null; then
      roadmap_status="complete"
    elif grep -qE "^\|.*${phase_number}.*\|.*⏳|^\|.*${phase_number}.*\|.*Awaiting" "${repo_root}/ROADMAP.md" 2>/dev/null; then
      roadmap_status="awaiting_user"
    elif grep -qE "^\|.*${phase_number}.*\|.*🔄|^\|.*${phase_number}.*\|.*In Progress" "${repo_root}/ROADMAP.md" 2>/dev/null; then
      roadmap_status="in_progress"
    elif grep -qE "^\|.*${phase_number}.*\||^##.*${phase_number}" "${repo_root}/ROADMAP.md" 2>/dev/null; then
      roadmap_status="pending"
    fi
  fi

  local roadmap_matches=true
  if [[ "$phase_status" != "not_started" && "$roadmap_status" != "unknown" ]]; then
    if [[ "$phase_status" == "in_progress" && "$roadmap_status" != "in_progress" && "$roadmap_status" != "awaiting_user" ]]; then
      # in_progress state can match either in_progress or awaiting_user ROADMAP status
      roadmap_matches=false
    elif [[ "$phase_status" == "awaiting_user_gate" && "$roadmap_status" != "awaiting_user" ]]; then
      roadmap_matches=false
    elif [[ "$phase_status" == "completed" && "$roadmap_status" != "complete" ]]; then
      roadmap_matches=false
    fi
  fi

  result=$(echo "$result" | jq \
    --arg status "$roadmap_status" \
    --argjson matches "$roadmap_matches" \
    '.roadmap = {phase_status: $status, matches_state: $matches}')

  # -------------------------------------------------------------------------
  # 6. Determine Next Action
  # -------------------------------------------------------------------------

  local next_action="unknown"
  local ready=true

  # Post-merge detection: On main, branch deleted, phase merged or ROADMAP shows complete/awaiting
  local post_merge_state=false
  if [[ "$feature_branch_exists" == "false" && ("$git_branch" == "main" || "$git_branch" == "master") ]]; then
    if [[ "$phase_merged" == "true" || "$roadmap_status" == "complete" || "$roadmap_status" == "awaiting_user" ]]; then
      post_merge_state=true
    fi
  fi

  # Check for mismatches that need fixing
  if [[ "$git_matches" == "false" ]]; then
    next_action="fix_branch"
    ready=false
  elif [[ "$post_merge_state" == "true" ]]; then
    # Phase was merged, determine what to do next
    if [[ "$roadmap_status" == "awaiting_user" ]]; then
      next_action="verify_user_gate"
      ready=true
    elif [[ "$roadmap_status" == "complete" ]]; then
      next_action="start_next_phase"
      ready=true
    else
      # Merged but ROADMAP not updated - need to archive
      next_action="archive_phase"
      ready=false
    fi
  elif [[ "$roadmap_matches" == "false" ]]; then
    if [[ "$roadmap_status" == "complete" ]]; then
      next_action="archive_phase"
    elif [[ "$roadmap_status" == "awaiting_user" ]]; then
      next_action="verify_user_gate"
      ready=true
    else
      next_action="sync_roadmap"
    fi
    ready=false
  elif [[ "$phase_number" == "null" || -z "$phase_number" ]]; then
    next_action="start_phase"
  elif [[ "$step_current" == "null" || -z "$step_current" ]]; then
    next_action="start_specify"
  else
    # Continue current step
    next_action="continue_${step_current}"
  fi

  result=$(echo "$result" | jq \
    --argjson ready "$ready" \
    --arg action "$next_action" \
    --argjson post_merge "$post_merge_state" \
    '.ready = $ready | .next_action = $action | .post_merge_state = $post_merge')

  echo "$result"
}

# =============================================================================
# Display Functions
# =============================================================================

display_status() {
  local status="$1"

  print_header "SpecFlow Project Status"
  echo ""

  # Health
  local health_ok
  health_ok=$(echo "$status" | jq -r '.health.ok')
  if [[ "$health_ok" == "true" ]]; then
    print_status ok "Health check passed"
  else
    print_status error "Health check failed"
    echo "$status" | jq -r '.health.issues[]' | while read -r issue; do
      echo "    • $issue"
    done
    return
  fi

  # Phase
  local phase_number phase_name phase_status
  phase_number=$(echo "$status" | jq -r '.phase.number // "none"')
  phase_name=$(echo "$status" | jq -r '.phase.name // "none"')
  phase_status=$(echo "$status" | jq -r '.phase.status // "not_started"')

  echo ""
  if [[ "$phase_number" != "null" && "$phase_number" != "none" ]]; then
    echo "Phase: ${phase_number} - ${phase_name}"
    echo "Status: ${phase_status}"
  else
    echo "Phase: No active phase"
  fi

  # Step
  local step_current step_index
  step_current=$(echo "$status" | jq -r '.step.current // "none"')
  step_index=$(echo "$status" | jq -r '.step.index // 0')

  if [[ "$step_current" != "null" && "$step_current" != "none" ]]; then
    echo "Step: ${step_current} (${step_index}/7)"
  fi

  # Git
  echo ""
  local git_branch git_matches git_uncommitted branch_exists phase_merged post_merge
  git_branch=$(echo "$status" | jq -r '.git.branch // "none"')
  git_matches=$(echo "$status" | jq -r '.git.matches_state')
  git_uncommitted=$(echo "$status" | jq -r '.git.uncommitted // 0')
  branch_exists=$(echo "$status" | jq -r '.git.feature_branch_exists // true')
  phase_merged=$(echo "$status" | jq -r '.git.phase_merged // false')
  post_merge=$(echo "$status" | jq -r '.post_merge_state // false')

  if [[ "$post_merge" == "true" ]]; then
    print_status ok "Git: On ${git_branch} (phase merged)"
  elif [[ "$git_matches" == "true" ]]; then
    print_status ok "Git branch: ${git_branch}"
  else
    print_status warn "Git branch mismatch: ${git_branch}"
    if [[ "$branch_exists" == "false" ]]; then
      echo "    Feature branch no longer exists"
    fi
  fi

  if [[ "$git_uncommitted" -gt 0 ]]; then
    echo "    ${git_uncommitted} uncommitted change(s)"
  fi

  # Artifacts
  echo ""
  echo "Artifacts:"
  local spec plan tasks checklists
  spec=$(echo "$status" | jq -r '.artifacts.spec // false')
  plan=$(echo "$status" | jq -r '.artifacts.plan // false')
  tasks=$(echo "$status" | jq -r '.artifacts.tasks // false')
  checklists=$(echo "$status" | jq -r '.artifacts.checklists // false')

  [[ "$spec" == "true" ]] && print_status ok "  spec.md" || print_status skip "  spec.md"
  [[ "$plan" == "true" ]] && print_status ok "  plan.md" || print_status skip "  plan.md"
  [[ "$tasks" == "true" ]] && print_status ok "  tasks.md" || print_status skip "  tasks.md"
  [[ "$checklists" == "true" ]] && print_status ok "  checklists/" || print_status skip "  checklists/"

  # Tasks
  local tasks_completed tasks_total tasks_percentage
  tasks_completed=$(echo "$status" | jq -r '.tasks.completed // 0')
  tasks_total=$(echo "$status" | jq -r '.tasks.total // 0')
  tasks_percentage=$(echo "$status" | jq -r '.tasks.percentage // 0')

  if [[ "$tasks_total" -gt 0 ]]; then
    echo ""
    echo "Tasks: ${tasks_completed}/${tasks_total} (${tasks_percentage}%)"
  fi

  # ROADMAP
  echo ""
  local roadmap_status roadmap_matches
  roadmap_status=$(echo "$status" | jq -r '.roadmap.phase_status // "unknown"')
  roadmap_matches=$(echo "$status" | jq -r '.roadmap.matches_state')

  if [[ "$roadmap_matches" == "true" ]]; then
    print_status ok "ROADMAP: ${roadmap_status}"
  else
    print_status warn "ROADMAP mismatch: ${roadmap_status}"
  fi

  # Next Action
  echo ""
  local next_action ready
  next_action=$(echo "$status" | jq -r '.next_action // "unknown"')
  ready=$(echo "$status" | jq -r '.ready')

  if [[ "$ready" == "true" ]]; then
    echo "Ready to: ${next_action//_/ }"
  else
    print_status warn "Action needed: ${next_action//_/ }"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  local json_output=false
  local quick_mode=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json)
        json_output=true
        shift
        ;;
      --quick)
        quick_mode=true
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Run 'specflow status --help' for usage"
        exit 1
        ;;
    esac
  done

  # Collect status
  local status
  status=$(collect_status "$quick_mode")

  # Output
  if [[ "$json_output" == "true" ]]; then
    echo "$status" | jq '.'
  else
    display_status "$status"
  fi

  # Exit code based on health
  local health_ok
  health_ok=$(echo "$status" | jq -r '.health.ok')
  if [[ "$health_ok" != "true" ]]; then
    exit 1
  fi
}

main "$@"
