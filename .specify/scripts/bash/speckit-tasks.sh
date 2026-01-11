#!/usr/bin/env bash
#
# speckit-tasks.sh - Task tracking operations
#
# Usage:
#   speckit tasks status [file]         Count completed/total tasks
#   speckit tasks incomplete [file]     List incomplete tasks
#   speckit tasks mark <id>             Mark task complete
#   speckit tasks phase-status [file]   Status by phase
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
speckit tasks - Task tracking operations

USAGE:
    speckit tasks <command> [options]

COMMANDS:
    status [file]       Show completion status of tasks
                        Default: finds tasks.md in current spec

    incomplete [file]   List all incomplete tasks

    mark <id> [file]    Mark a task as complete
                        ID format: T001, T002, etc.

    phase-status [file] Show status grouped by phase

    list [file]         List all tasks with status

    find                Find all tasks.md files in specs/

    sync [file]         Regenerate Progress Dashboard from checkboxes
                        Updates the dashboard section at top of tasks.md

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit tasks status
    speckit tasks status specs/001-auth/tasks.md
    speckit tasks incomplete
    speckit tasks mark T005
    speckit tasks phase-status
    speckit tasks sync
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Find the default tasks file
find_tasks_file() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Try to get current phase from state
  if [[ -f "$state_file" ]]; then
    local phase_num
    phase_num=$(json_get "$state_file" ".orchestration.phase_number" 2>/dev/null || echo "")
    local specs_path
    specs_path=$(json_get "$state_file" ".config.specs_path" 2>/dev/null || echo "specs")
    specs_path="${specs_path%/}"

    if [[ -n "$phase_num" && "$phase_num" != "null" ]]; then
      # Look for tasks.md in current phase directory
      local phase_dir
      phase_dir=$(find "${repo_root}/${specs_path}" -maxdepth 1 -type d -name "${phase_num}-*" 2>/dev/null | head -1)
      if [[ -n "$phase_dir" && -f "${phase_dir}/tasks.md" ]]; then
        echo "${phase_dir}/tasks.md"
        return
      fi
    fi
  fi

  # Fallback: find most recent tasks.md
  find "${repo_root}/specs" -name "tasks.md" -type f 2>/dev/null | sort -r | head -1
}

# Find all tasks.md files
find_all_tasks_files() {
  local repo_root
  repo_root="$(get_repo_root)"
  find "${repo_root}/specs" -name "tasks.md" -type f 2>/dev/null | sort
}

# Count tasks in a file
# Returns: completed total
count_tasks() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "0 0"
    return
  fi

  local total completed

  # Count all task items: - [ ] Txxx or - [x] Txxx
  total=$(grep -cE '^\s*-\s*\[[x ]\]\s*T[0-9]+' "$file" 2>/dev/null) || total=0

  # Count completed tasks: - [x] Txxx
  completed=$(grep -cE '^\s*-\s*\[x\]\s*T[0-9]+' "$file" 2>/dev/null) || completed=0

  echo "$completed $total"
}

# Get incomplete tasks from a file
get_incomplete_tasks() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  # Find unchecked tasks with ID
  grep -E '^\s*-\s*\[ \]\s*T[0-9]+' "$file" 2>/dev/null | sed 's/^\s*-\s*\[ \]\s*//'
}

# Get all tasks from a file
get_all_tasks() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  grep -E '^\s*-\s*\[[x ]\]\s*T[0-9]+' "$file" 2>/dev/null
}

# Extract phase sections from tasks file
get_phases() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  # Find phase headers: ## Phase N: Name
  grep -E '^##\s+Phase\s+[0-9]+' "$file" 2>/dev/null | sed 's/^##\s*//'
}

# Calculate percentage
calc_percent() {
  local completed="$1"
  local total="$2"

  if [[ "$total" -eq 0 ]]; then
    echo "0"
  else
    echo "$((completed * 100 / total))"
  fi
}

# =============================================================================
# Commands
# =============================================================================

cmd_status() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    log_info "Specify a file or ensure you're in a spec directory"
    exit 1
  fi

  local counts
  counts=$(count_tasks "$file")
  local completed total
  read -r completed total <<< "$counts"

  local percent
  percent=$(calc_percent "$completed" "$total")

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    echo "{\"file\": \"$rel_path\", \"completed\": $completed, \"total\": $total, \"percent\": $percent}"
  else
    print_header "Task Status"
    echo ""
    echo "  File: $rel_path"
    echo "  Completed: $completed / $total ($percent%)"
    echo ""

    # Progress bar
    local bar_width=40
    local filled=$((percent * bar_width / 100))
    local empty=$((bar_width - filled))
    printf "  ["
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s" | tr ' ' ' '
    printf "] %d%%\n" "$percent"
  fi
}

cmd_incomplete() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    local items_json="[]"
    while IFS= read -r task; do
      [[ -z "$task" ]] && continue
      # Extract task ID
      local task_id
      task_id=$(echo "$task" | grep -oE '^T[0-9]+' || echo "")
      items_json=$(echo "$items_json" | jq --arg id "$task_id" --arg task "$task" \
        '. + [{"id": $id, "task": $task}]')
    done < <(get_incomplete_tasks "$file")

    local count
    count=$(echo "$items_json" | jq 'length')
    echo "{\"file\": \"$rel_path\", \"count\": $count, \"tasks\": $items_json}"
  else
    print_header "Incomplete Tasks"
    echo ""
    echo -e "${DIM}$rel_path${RESET}"
    echo ""

    local count=0
    while IFS= read -r task; do
      [[ -z "$task" ]] && continue
      ((count++)) || true
      echo "  - $task"
    done < <(get_incomplete_tasks "$file")

    echo ""
    if [[ $count -eq 0 ]]; then
      log_success "All tasks complete!"
    else
      echo "Total incomplete: $count"
    fi
  fi
}

cmd_mark() {
  local task_id="$1"
  local file="${2:-}"

  if [[ -z "$task_id" ]]; then
    log_error "Task ID required"
    echo "Usage: speckit tasks mark <id> [file]"
    exit 1
  fi

  # Sanitize and validate task ID
  # Remove any characters that could be regex-dangerous
  task_id=$(echo "$task_id" | tr -cd '[:alnum:]')
  task_id=$(echo "$task_id" | tr '[:lower:]' '[:upper:]')

  # Validate format: T followed by 3+ digits
  if [[ ! "$task_id" =~ ^T[0-9]{3,}$ ]]; then
    log_error "Invalid task ID format: $task_id"
    log_info "Expected format: T001, T002, T003, etc. (T followed by 3+ digits)"
    exit 1
  fi

  # Additional security: ensure task_id only contains safe characters
  if [[ "$task_id" =~ [^A-Z0-9] ]]; then
    log_error "Task ID contains invalid characters"
    exit 1
  fi

  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    exit 1
  fi

  # Check if task exists
  if ! grep -qE "^\s*-\s*\[[x ]\]\s*${task_id}\b" "$file"; then
    log_error "Task not found: $task_id"
    exit 1
  fi

  # Check if already complete
  if grep -qE "^\s*-\s*\[x\]\s*${task_id}\b" "$file"; then
    log_warn "Task already complete: $task_id"
    exit 0
  fi

  # Mark complete: replace [ ] with [x]
  local temp_file
  temp_file=$(mktemp)

  # Use POSIX-compatible whitespace pattern (macOS sed doesn't support \s)
  sed -E "s/^([[:space:]]*-[[:space:]]*)\[ \]([[:space:]]*${task_id})/\1[x]\2/" "$file" > "$temp_file"
  mv "$temp_file" "$file"

  log_success "Marked complete: $task_id"

  # Update state file if it exists
  local state_file
  state_file="$(get_state_file)"
  if [[ -f "$state_file" ]]; then
    local counts
    counts=$(count_tasks "$file")
    local completed total
    read -r completed total <<< "$counts"

    # Update implement step in state
    local state_temp
    state_temp=$(mktemp)
    jq --argjson completed "$completed" --argjson total "$total" --arg ts "$(iso_timestamp)" \
      '.orchestration.steps.implement.tasks_completed = $completed |
       .orchestration.steps.implement.tasks_total = $total |
       .last_updated = $ts' "$state_file" > "$state_temp" 2>/dev/null && mv "$state_temp" "$state_file"

    log_debug "Updated state: $completed/$total tasks complete"
  fi

  # Sync progress dashboard (suppress output unless json mode)
  if is_json_output; then
    # In JSON mode, include sync data
    local sync_json
    sync_json=$(cmd_sync "$file" 2>/dev/null) || true
    echo "{\"marked\": \"$task_id\", \"status\": \"complete\", \"dashboard\": $sync_json}"
  else
    # Silently sync dashboard
    cmd_sync "$file" >/dev/null 2>&1 || true
  fi
}

cmd_phase_status() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    local phases_json="[]"
  else
    print_header "Task Status by Phase"
    echo ""
    echo -e "${DIM}$rel_path${RESET}"
    echo ""
  fi

  local current_phase=""
  local phase_completed=0
  local phase_total=0

  while IFS= read -r line; do
    # Check for phase header
    if [[ "$line" =~ ^##[[:space:]]+Phase[[:space:]]+([0-9]+) ]]; then
      # Output previous phase if exists
      if [[ -n "$current_phase" ]]; then
        local phase_percent
        phase_percent=$(calc_percent "$phase_completed" "$phase_total")
        if is_json_output; then
          phases_json=$(echo "$phases_json" | jq --arg name "$current_phase" --argjson completed "$phase_completed" --argjson total "$phase_total" --argjson percent "$phase_percent" \
            '. + [{"phase": $name, "completed": $completed, "total": $total, "percent": $percent}]')
        else
          if [[ "$phase_percent" -eq 100 ]]; then
            print_status complete "$current_phase ($phase_completed/$phase_total)"
          elif [[ "$phase_completed" -gt 0 ]]; then
            print_status progress "$current_phase ($phase_completed/$phase_total - $phase_percent%)"
          else
            print_status pending "$current_phase ($phase_completed/$phase_total)"
          fi
        fi
      fi

      # Start new phase
      current_phase="${line#\#\# }"
      phase_completed=0
      phase_total=0
    fi

    # Count tasks in current phase
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*T[0-9]+ ]]; then
      ((phase_completed++)) || true
      ((phase_total++)) || true
    elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*T[0-9]+ ]]; then
      ((phase_total++)) || true
    fi
  done < "$file"

  # Output last phase
  if [[ -n "$current_phase" ]]; then
    local phase_percent
    phase_percent=$(calc_percent "$phase_completed" "$phase_total")
    if is_json_output; then
      phases_json=$(echo "$phases_json" | jq --arg name "$current_phase" --argjson completed "$phase_completed" --argjson total "$phase_total" --argjson percent "$phase_percent" \
        '. + [{"phase": $name, "completed": $completed, "total": $total, "percent": $percent}]')
    else
      if [[ "$phase_percent" -eq 100 ]]; then
        print_status complete "$current_phase ($phase_completed/$phase_total)"
      elif [[ "$phase_completed" -gt 0 ]]; then
        print_status progress "$current_phase ($phase_completed/$phase_total - $phase_percent%)"
      else
        print_status pending "$current_phase ($phase_completed/$phase_total)"
      fi
    fi
  fi

  if is_json_output; then
    echo "{\"file\": \"$rel_path\", \"phases\": $phases_json}"
  fi
}

cmd_list() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    local items_json="[]"
    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[([x[:space:]])\][[:space:]]*(T[0-9]+.*)$ ]]; then
        local checked="${BASH_REMATCH[1]}"
        local task="${BASH_REMATCH[2]}"
        local task_id
        task_id=$(echo "$task" | grep -oE '^T[0-9]+' || echo "")
        local status="incomplete"
        [[ "$checked" == "x" ]] && status="complete"
        items_json=$(echo "$items_json" | jq --arg id "$task_id" --arg task "$task" --arg status "$status" \
          '. + [{"id": $id, "task": $task, "status": $status}]')
      fi
    done < "$file"

    echo "{\"file\": \"$rel_path\", \"tasks\": $items_json}"
  else
    print_header "All Tasks"
    echo ""
    echo -e "${DIM}$rel_path${RESET}"
    echo ""

    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*(T[0-9]+.*)$ ]]; then
        print_status complete "${BASH_REMATCH[1]}"
      elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*(T[0-9]+.*)$ ]]; then
        print_status pending "${BASH_REMATCH[1]}"
      fi
    done < "$file"
  fi
}

cmd_find() {
  if is_json_output; then
    local files_json="[]"
    while IFS= read -r file; do
      [[ -z "$file" ]] && continue
      local repo_root
      repo_root="$(get_repo_root)"
      local rel_path="${file#$repo_root/}"
      files_json=$(echo "$files_json" | jq --arg path "$rel_path" '. + [$path]')
    done < <(find_all_tasks_files)
    echo "$files_json"
  else
    print_header "Task Files"
    echo ""
    local count=0
    while IFS= read -r file; do
      [[ -z "$file" ]] && continue
      ((count++)) || true
      local repo_root
      repo_root="$(get_repo_root)"
      local rel_path="${file#$repo_root/}"
      echo "  $rel_path"
    done < <(find_all_tasks_files)

    if [[ $count -eq 0 ]]; then
      log_info "No tasks.md files found in specs/"
    fi
  fi
}

cmd_sync() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  # Collect phase data
  local phases_data=""
  local current_phase=""
  local phase_completed=0
  local phase_total=0
  local total_completed=0
  local total_tasks=0
  local current_task=""
  local quick_status=""
  local quick_count=0

  while IFS= read -r line; do
    # Check for phase header
    if [[ "$line" =~ ^##[[:space:]]+Phase[[:space:]]+([0-9N]+)[[:space:]]*:?[[:space:]]*(.*)$ ]]; then
      # Save previous phase
      if [[ -n "$current_phase" ]]; then
        local status="PENDING"
        if [[ "$phase_completed" -eq "$phase_total" && "$phase_total" -gt 0 ]]; then
          status="DONE"
        elif [[ "$phase_completed" -gt 0 ]]; then
          status="IN PROGRESS"
        fi
        phases_data+="| ${current_phase} | ${status} | ${phase_completed}/${phase_total} |\n"
      fi

      # Start new phase
      current_phase="${BASH_REMATCH[2]:-Phase ${BASH_REMATCH[1]}}"
      # Clean up phase name (remove trailing markers like (DONE))
      current_phase=$(echo "$current_phase" | sed 's/[[:space:]]*(DONE)[[:space:]]*$//' | sed 's/[[:space:]]*$//')
      phase_completed=0
      phase_total=0
    fi

    # Count and collect tasks
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*(T[0-9]+.*)$ ]]; then
      ((phase_completed++)) || true
      ((phase_total++)) || true
      ((total_completed++)) || true
      ((total_tasks++)) || true
      # Add to quick status (completed tasks)
      if [[ $quick_count -lt 10 ]]; then
        quick_status+="- [x] ${BASH_REMATCH[1]}\n"
        ((quick_count++)) || true
      fi
    elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*(T[0-9]+.*)$ ]]; then
      ((phase_total++)) || true
      ((total_tasks++)) || true
      # First incomplete task is current
      if [[ -z "$current_task" ]]; then
        current_task="${BASH_REMATCH[1]}"
      fi
      # Add to quick status (incomplete tasks, mark current)
      if [[ $quick_count -lt 10 ]]; then
        if [[ "${BASH_REMATCH[1]}" == "$current_task" ]]; then
          quick_status+="- [ ] **${BASH_REMATCH[1]}** <- CURRENT\n"
        else
          quick_status+="- [ ] ${BASH_REMATCH[1]}\n"
        fi
        ((quick_count++)) || true
      fi
    fi
  done < "$file"

  # Save last phase
  if [[ -n "$current_phase" ]]; then
    local status="PENDING"
    if [[ "$phase_completed" -eq "$phase_total" && "$phase_total" -gt 0 ]]; then
      status="DONE"
    elif [[ "$phase_completed" -gt 0 ]]; then
      status="IN PROGRESS"
    fi
    phases_data+="| ${current_phase} | ${status} | ${phase_completed}/${phase_total} |"
  fi

  # Calculate percentage
  local percent=0
  if [[ "$total_tasks" -gt 0 ]]; then
    percent=$((total_completed * 100 / total_tasks))
  fi

  # Current task display
  local current_display="None"
  if [[ -n "$current_task" ]]; then
    current_display=$(echo "$current_task" | cut -c1-40)
  fi

  # Generate timestamp
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Build new dashboard
  local dashboard="## Progress Dashboard

> Last updated: ${timestamp} | Run \`speckit tasks sync\` to refresh

| Phase | Status | Progress |
|-------|--------|----------|
$(echo -e "$phases_data")

**Overall**: ${total_completed}/${total_tasks} (${percent}%) | **Current**: ${current_display}

### Quick Status

$(echo -e "$quick_status")
---"

  # Update file - replace dashboard section
  local temp_file
  temp_file=$(mktemp)
  local in_dashboard=0
  local dashboard_written=0

  while IFS= read -r line; do
    if [[ "$line" == "## Progress Dashboard" ]]; then
      in_dashboard=1
      if [[ $dashboard_written -eq 0 ]]; then
        echo "$dashboard" >> "$temp_file"
        dashboard_written=1
      fi
      continue
    fi

    # End of dashboard section (next ## header or ---)
    if [[ $in_dashboard -eq 1 ]]; then
      if [[ "$line" =~ ^##[[:space:]] && "$line" != "## Progress Dashboard" && ! "$line" =~ ^###[[:space:]] ]]; then
        in_dashboard=0
        echo "$line" >> "$temp_file"
      elif [[ "$line" == "---" ]]; then
        in_dashboard=0
        # Skip this --- as we already added one in dashboard
      fi
      # Skip lines in dashboard section
      continue
    fi

    echo "$line" >> "$temp_file"
  done < "$file"

  mv "$temp_file" "$file"

  if is_json_output; then
    echo "{\"file\": \"$rel_path\", \"completed\": $total_completed, \"total\": $total_tasks, \"percent\": $percent, \"current\": \"${current_task:-null}\"}"
  else
    log_success "Progress Dashboard updated in $rel_path"
    echo ""
    echo "  Completed: $total_completed / $total_tasks ($percent%)"
    if [[ -n "$current_task" ]]; then
      echo "  Current: $current_task"
    fi
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
    status|st)
      cmd_status "${1:-}"
      ;;
    incomplete|inc)
      cmd_incomplete "${1:-}"
      ;;
    mark)
      cmd_mark "${1:-}" "${2:-}"
      ;;
    phase-status|phases|ps)
      cmd_phase_status "${1:-}"
      ;;
    list|ls)
      cmd_list "${1:-}"
      ;;
    find)
      cmd_find
      ;;
    sync)
      cmd_sync "${1:-}"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'speckit tasks --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
