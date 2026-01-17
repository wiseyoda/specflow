#!/usr/bin/env bash
#
# speckit-tasks.sh - Task tracking operations
#
# Usage:
#   speckit tasks status [file]              Count completed/total tasks
#   speckit tasks incomplete [file]          List incomplete tasks
#   speckit tasks mark <id>... [file.md]     Mark task(s) complete (supports ranges)
#   speckit tasks phase-status [file]        Status by phase
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"
source "${SCRIPT_DIR}/lib/mark.sh"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit tasks - Task tracking operations

USAGE:
    speckit tasks <command> [options]

COMMANDS:
    status [file]        Show completion status of tasks
                         Default: finds tasks.md in current spec

    incomplete [file]    List all incomplete tasks

    mark <id>... [file]  Mark task(s) as complete
                         Accepts multiple IDs and/or ranges
                         ID format: T001, A1.1, B2.3, etc.
                         Range format: T001..T010, A1..A5
                         File detected by .md extension (position flexible)

    phase-status [file]  Show status grouped by phase

    list [file]          List all tasks with status

    find                 Find all tasks.md files in specs/

    sync [file]          Regenerate Progress Dashboard from checkboxes
                         Updates the dashboard section at top of tasks.md

    start <id>... [--section <name>]
                         Mark task(s) as in-progress (batch tracking)
                         Updates state.orchestration.implement.current_tasks
                         Does NOT modify tasks.md (progress tracking only)

    working              Show currently in-progress tasks from state

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit tasks status
    speckit tasks status specs/001-auth/tasks.md
    speckit tasks incomplete
    speckit tasks phase-status
    speckit tasks sync

    # Mark single task
    speckit tasks mark T005
    speckit tasks mark A1.1 tasks.md

    # Mark multiple tasks
    speckit tasks mark T001 T002 T003 tasks.md

    # Mark range of tasks
    speckit tasks mark T001..T010 tasks.md

    # Mix ranges and individual IDs
    speckit tasks mark A1..A3 B1 B2..B4 tasks.md

    # Start working on tasks (batch tracking)
    speckit tasks start T001 T002 --section "Setup"
    speckit tasks start A1..A5

    # Show current in-progress tasks
    speckit tasks working
    speckit tasks working --json
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

  # Count all task items - supports multiple formats:
  # - [ ] T001: description (legacy format)
  # - [x] **A1.1**: description (ABBC format with bold)
  # - [x] A1.1: description (ABBC format without bold)
  # Pattern: checkbox followed by optional bold, then letter+digits or T+digits
  total=$(grep -cE '^\s*-\s*\[[x ]\]\s*\*?\*?[A-Z][0-9]+' "$file" 2>/dev/null) || total=0

  # Count completed tasks
  completed=$(grep -cE '^\s*-\s*\[x\]\s*\*?\*?[A-Z][0-9]+' "$file" 2>/dev/null) || completed=0

  echo "$completed $total"
}

# Get incomplete tasks from a file
get_incomplete_tasks() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  # Find unchecked tasks with ID (supports T001 and A1.1 formats)
  grep -E '^\s*-\s*\[ \]\s*\*?\*?[A-Z][0-9]+' "$file" 2>/dev/null | sed 's/^\s*-\s*\[ \]\s*//'
}

# Get all tasks from a file
get_all_tasks() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  # Match tasks with ID (supports T001 and A1.1 formats)
  grep -E '^\s*-\s*\[[x ]\]\s*\*?\*?[A-Z][0-9]+' "$file" 2>/dev/null
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
    # Three-Line Rule: Critical info first
    if [[ "$percent" -eq 100 ]]; then
      echo -e "${GREEN}OK${RESET}: Tasks $completed/$total complete (100%)"
    elif [[ "$percent" -ge 50 ]]; then
      echo -e "${BLUE}INFO${RESET}: Tasks $completed/$total complete ($percent%)"
    else
      echo -e "${YELLOW}WARN${RESET}: Tasks $completed/$total complete ($percent%)"
    fi
    echo "  File: $rel_path"

    # Progress bar (line 3+)
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
      # Extract task ID (supports T001 and **A1.1** formats)
      local task_id
      task_id=$(echo "$task" | sed 's/^\*\*//' | grep -oE '^[A-Z][0-9]+(\.[0-9]+)?' || echo "")
      items_json=$(echo "$items_json" | jq --arg id "$task_id" --arg task "$task" \
        '. + [{"id": $id, "task": $task}]')
    done < <(get_incomplete_tasks "$file")

    local count
    count=$(echo "$items_json" | jq 'length')
    echo "{\"file\": \"$rel_path\", \"count\": $count, \"tasks\": $items_json}"
  else
    # Collect incomplete tasks first to get count
    local tasks=()
    while IFS= read -r task; do
      [[ -z "$task" ]] && continue
      tasks+=("$task")
    done < <(get_incomplete_tasks "$file")
    local count=${#tasks[@]}

    # Three-Line Rule: Critical info first
    if [[ $count -eq 0 ]]; then
      echo -e "${GREEN}OK${RESET}: All tasks complete"
      echo "  File: $rel_path"
    else
      echo -e "${YELLOW}WARN${RESET}: $count incomplete task(s)"
      echo "  File: $rel_path"
      echo ""
      # Task list (line 4+)
      for task in "${tasks[@]}"; do
        echo "  - $task"
      done
    fi
  fi
}

cmd_mark() {
  # Parse arguments using shared library
  parse_ids_and_file "$@"
  local file="$MARK_FILE"
  local ids=("${MARK_IDS[@]}")

  if [[ ${#ids[@]} -eq 0 ]]; then
    log_error "Task ID(s) required"
    echo "Usage: speckit tasks mark <id>... [file.md]"
    echo "Examples:"
    echo "  speckit tasks mark T005"
    echo "  speckit tasks mark T001 T002 T003 tasks.md"
    echo "  speckit tasks mark T001..T010 tasks.md"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"

  # Resolve file path
  if [[ -z "$file" ]]; then
    file="$(find_tasks_file)"
  elif [[ ! "$file" = /* ]]; then
    file="$repo_root/$file"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No tasks.md file found"
    exit 1
  fi

  # Expand ranges and collect all IDs
  local expanded_ids=()
  while IFS= read -r expanded; do
    [[ -n "$expanded" ]] && expanded_ids+=("$expanded")
  done < <(expand_all_ids "${ids[@]}")

  local marked=0
  local skipped=0
  local not_found=0
  local errors=()
  local marked_ids=()

  # Process each ID
  for task_id in "${expanded_ids[@]}"; do
    # Sanitize task ID - allow alphanumeric plus dots for formats like A1.1, B2.3
    task_id=$(echo "$task_id" | tr -cd '[:alnum:].')
    task_id=$(echo "$task_id" | tr '[:lower:]' '[:upper:]')

    # Validate format: alphanumeric with optional dots (T001, A1.1, B2.3, etc.)
    if [[ ! "$task_id" =~ ^[A-Z0-9][A-Z0-9.]*$ ]]; then
      errors+=("$task_id: invalid format")
      ((not_found++)) || true
      continue
    fi

    # Mark using shared library (capture result without triggering set -e)
    local result=0
    mark_checkbox_item "$task_id" "$file" || result=$?

    case $result in
      0)
        ((marked++)) || true
        marked_ids+=("$task_id")
        ;;
      1)
        errors+=("$task_id: not found")
        ((not_found++)) || true
        ;;
      2) ((skipped++)) || true ;;
    esac
  done

  # Always update state file to sync progress (even if no tasks newly marked)
  local state_file
  state_file="$(get_state_file)"
  if [[ -f "$state_file" ]]; then
    local counts
    counts=$(count_tasks "$file")
    local completed total
    read -r completed total <<< "$counts"

    # Calculate percentage
    local percentage=0
    if [[ "$total" -gt 0 ]]; then
      percentage=$((completed * 100 / total))
    fi

    # Build list of marked task IDs for removal from current_tasks
    local marked_ids_json="[]"
    for mid in "${marked_ids[@]}"; do
      marked_ids_json=$(echo "$marked_ids_json" | jq --arg id "$mid" '. + [$id]')
    done

    # Update both implement step and progress in state, removing completed tasks from current_tasks
    local state_temp
    state_temp=$(mktemp)
    jq --argjson completed "$completed" --argjson total "$total" --argjson pct "$percentage" \
       --argjson marked "$marked_ids_json" --arg ts "$(iso_timestamp)" \
      '.orchestration.steps.implement.tasks_completed = $completed |
       .orchestration.steps.implement.tasks_total = $total |
       .orchestration.progress.tasks_completed = $completed |
       .orchestration.progress.tasks_total = $total |
       .orchestration.progress.percentage = $pct |
       .orchestration.implement.current_tasks = ((.orchestration.implement.current_tasks // []) - $marked) |
       .last_updated = $ts' "$state_file" > "$state_temp" 2>/dev/null && mv "$state_temp" "$state_file"

    log_debug "Updated state: $completed/$total tasks complete ($percentage%)"
  fi

  # Sync progress dashboard if anything was marked
  if [[ $marked -gt 0 ]]; then
    cmd_sync "$file" >/dev/null 2>&1 || true
  fi

  # Output results
  if is_json_output; then
    local errors_json="[]"
    for err in "${errors[@]}"; do
      errors_json=$(echo "$errors_json" | jq --arg e "$err" '. + [$e]')
    done
    local marked_json="[]"
    for mid in "${marked_ids[@]}"; do
      marked_json=$(echo "$marked_json" | jq --arg id "$mid" '. + [$id]')
    done
    echo "{\"marked\": $marked, \"marked_ids\": $marked_json, \"skipped\": $skipped, \"not_found\": $not_found, \"errors\": $errors_json}"
  else
    if [[ $marked -gt 0 ]]; then
      echo -e "${GREEN}OK${RESET}: Marked $marked task(s) complete"
    fi
    if [[ $skipped -gt 0 ]]; then
      echo -e "${YELLOW}WARN${RESET}: $skipped task(s) already complete"
    fi
    if [[ $not_found -gt 0 ]]; then
      echo -e "${RED}ERROR${RESET}: $not_found task(s) not found"
      for err in "${errors[@]}"; do
        echo "  - $err"
      done
    fi
  fi

  # Exit with error if any items not found
  [[ $not_found -gt 0 ]] && exit 1
  exit 0
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

  # Collect all phase data first
  local phases_json="[]"
  local phase_names=()
  local phase_completed_arr=()
  local phase_total_arr=()
  local all_completed=0
  local all_total=0
  local current_phase=""
  local phase_completed=0
  local phase_total=0

  while IFS= read -r line; do
    if [[ "$line" =~ ^##[[:space:]]+Phase[[:space:]]+([0-9]+) ]]; then
      if [[ -n "$current_phase" ]]; then
        phase_names+=("$current_phase")
        phase_completed_arr+=("$phase_completed")
        phase_total_arr+=("$phase_total")
        ((all_completed += phase_completed)) || true
        ((all_total += phase_total)) || true
      fi
      current_phase="${line#\#\# }"
      phase_completed=0
      phase_total=0
    fi
    # Support both T001 and **A1.1** task formats
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*\*?\*?[A-Z][0-9]+ ]]; then
      ((phase_completed++)) || true
    elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*\*?\*?[A-Z][0-9]+ ]]; then
      : # just count total
    else
      continue
    fi
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[x[:space:]]\][[:space:]]*\*?\*?[A-Z][0-9]+ ]]; then
      ((phase_total++)) || true
    fi
  done < "$file"

  # Don't forget last phase
  if [[ -n "$current_phase" ]]; then
    phase_names+=("$current_phase")
    phase_completed_arr+=("$phase_completed")
    phase_total_arr+=("$phase_total")
    ((all_completed += phase_completed)) || true
    ((all_total += phase_total)) || true
  fi

  local all_percent
  all_percent=$(calc_percent "$all_completed" "$all_total")

  if is_json_output; then
    for i in "${!phase_names[@]}"; do
      local p_percent
      p_percent=$(calc_percent "${phase_completed_arr[$i]}" "${phase_total_arr[$i]}")
      phases_json=$(echo "$phases_json" | jq --arg name "${phase_names[$i]}" \
        --argjson completed "${phase_completed_arr[$i]}" \
        --argjson total "${phase_total_arr[$i]}" \
        --argjson percent "$p_percent" \
        '. + [{"phase": $name, "completed": $completed, "total": $total, "percent": $percent}]')
    done
    echo "{\"file\": \"$rel_path\", \"phases\": $phases_json}"
  else
    # Three-Line Rule: Summary first
    local phase_count=${#phase_names[@]}
    if [[ "$all_percent" -eq 100 ]]; then
      echo -e "${GREEN}OK${RESET}: All phases complete ($all_completed/$all_total tasks)"
    else
      echo -e "${BLUE}INFO${RESET}: $phase_count phases, $all_completed/$all_total tasks ($all_percent%)"
    fi
    echo "  File: $rel_path"
    echo ""
    # Phase details (line 4+)
    for i in "${!phase_names[@]}"; do
      local p_percent
      p_percent=$(calc_percent "${phase_completed_arr[$i]}" "${phase_total_arr[$i]}")
      if [[ "$p_percent" -eq 100 ]]; then
        print_status complete "${phase_names[$i]} (${phase_completed_arr[$i]}/${phase_total_arr[$i]})"
      elif [[ "${phase_completed_arr[$i]}" -gt 0 ]]; then
        print_status progress "${phase_names[$i]} (${phase_completed_arr[$i]}/${phase_total_arr[$i]} - $p_percent%)"
      else
        print_status pending "${phase_names[$i]} (${phase_completed_arr[$i]}/${phase_total_arr[$i]})"
      fi
    done
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
      # Support both T001 and **A1.1** task formats
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[([x[:space:]])\][[:space:]]*(\*?\*?[A-Z][0-9]+.*)$ ]]; then
        local checked="${BASH_REMATCH[1]}"
        local task="${BASH_REMATCH[2]}"
        local task_id
        task_id=$(echo "$task" | sed 's/^\*\*//' | grep -oE '^[A-Z][0-9]+(\.[0-9]+)?' || echo "")
        local status="incomplete"
        [[ "$checked" == "x" ]] && status="complete"
        items_json=$(echo "$items_json" | jq --arg id "$task_id" --arg task "$task" --arg status "$status" \
          '. + [{"id": $id, "task": $task, "status": $status}]')
      fi
    done < "$file"

    echo "{\"file\": \"$rel_path\", \"tasks\": $items_json}"
  else
    # Collect all tasks first for summary
    local complete_tasks=()
    local pending_tasks=()
    while IFS= read -r line; do
      # Support both T001 and **A1.1** task formats
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*(\*?\*?[A-Z][0-9]+.*)$ ]]; then
        complete_tasks+=("${BASH_REMATCH[1]}")
      elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*(\*?\*?[A-Z][0-9]+.*)$ ]]; then
        pending_tasks+=("${BASH_REMATCH[1]}")
      fi
    done < "$file"

    local total=$((${#complete_tasks[@]} + ${#pending_tasks[@]}))
    local completed=${#complete_tasks[@]}

    # Three-Line Rule: Summary first
    echo -e "${BLUE}INFO${RESET}: $total tasks ($completed complete, ${#pending_tasks[@]} pending)"
    echo "  File: $rel_path"
    echo ""
    # Task list (line 4+)
    for task in "${complete_tasks[@]}"; do
      print_status complete "$task"
    done
    for task in "${pending_tasks[@]}"; do
      print_status pending "$task"
    done
  fi
}

cmd_find() {
  # Collect files first for summary
  local files=()
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local repo_root
    repo_root="$(get_repo_root)"
    local rel_path="${file#$repo_root/}"
    files+=("$rel_path")
  done < <(find_all_tasks_files)

  if is_json_output; then
    local files_json="[]"
    for f in "${files[@]}"; do
      files_json=$(echo "$files_json" | jq --arg path "$f" '. + [$path]')
    done
    echo "$files_json"
  else
    # Three-Line Rule: Summary first
    local count=${#files[@]}
    if [[ $count -eq 0 ]]; then
      echo -e "${YELLOW}WARN${RESET}: No tasks.md files found"
      echo "  Search path: specs/"
    else
      echo -e "${GREEN}OK${RESET}: Found $count tasks.md file(s)"
      echo ""
      for f in "${files[@]}"; do
        echo "  $f"
      done
    fi
  fi
}

cmd_start() {
  # Parse arguments - look for --section flag
  local section=""
  local ids=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --section)
        shift
        section="${1:-}"
        shift
        ;;
      *)
        ids+=("$1")
        shift
        ;;
    esac
  done

  if [[ ${#ids[@]} -eq 0 ]]; then
    log_error "Task ID(s) required"
    echo "Usage: speckit tasks start <id>... [--section <name>]"
    echo "Examples:"
    echo "  speckit tasks start T001 T002 --section \"Setup\""
    echo "  speckit tasks start A1..A5"
    exit 1
  fi

  # Expand ranges
  local expanded_ids=()
  while IFS= read -r expanded; do
    [[ -n "$expanded" ]] && expanded_ids+=("$expanded")
  done < <(expand_all_ids "${ids[@]}")

  # Validate and normalize IDs
  local valid_ids=()
  for task_id in "${expanded_ids[@]}"; do
    task_id=$(echo "$task_id" | tr -cd '[:alnum:].' | tr '[:lower:]' '[:upper:]')
    if [[ "$task_id" =~ ^[A-Z0-9][A-Z0-9.]*$ ]]; then
      valid_ids+=("$task_id")
    else
      log_warn "Invalid task ID format: $task_id"
    fi
  done

  if [[ ${#valid_ids[@]} -eq 0 ]]; then
    log_error "No valid task IDs provided"
    exit 1
  fi

  # Update state file
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "No state file found. Run 'speckit state init' first."
    exit 1
  fi

  # Build JSON array of task IDs
  local ids_json="[]"
  for id in "${valid_ids[@]}"; do
    ids_json=$(echo "$ids_json" | jq --arg id "$id" '. + [$id]')
  done

  # Update state with current tasks
  local temp_file
  temp_file=$(mktemp)
  local timestamp
  timestamp=$(iso_timestamp)

  if [[ -n "$section" ]]; then
    jq --argjson tasks "$ids_json" --arg section "$section" --arg ts "$timestamp" \
      '.orchestration.implement.current_tasks = $tasks |
       .orchestration.implement.current_section = $section |
       .orchestration.implement.started_at = $ts |
       .last_updated = $ts' "$state_file" > "$temp_file" 2>/dev/null && mv "$temp_file" "$state_file"
  else
    jq --argjson tasks "$ids_json" --arg ts "$timestamp" \
      '.orchestration.implement.current_tasks = $tasks |
       .orchestration.implement.current_section = null |
       .orchestration.implement.started_at = $ts |
       .last_updated = $ts' "$state_file" > "$temp_file" 2>/dev/null && mv "$temp_file" "$state_file"
  fi

  # Output
  if is_json_output; then
    local section_json="null"
    [[ -n "$section" ]] && section_json="\"$section\""
    echo "{\"tasks\": $ids_json, \"section\": $section_json, \"started_at\": \"$timestamp\"}"
  else
    log_success "Started ${#valid_ids[@]} task(s)"
    if [[ -n "$section" ]]; then
      echo "  Section: $section"
    fi
    echo "  Tasks: ${valid_ids[*]}"
  fi
}

cmd_working() {
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "No state file found"
    exit 1
  fi

  # Read current tasks from state
  local current_tasks section started_at
  current_tasks=$(jq -r '.orchestration.implement.current_tasks // []' "$state_file" 2>/dev/null)
  section=$(jq -r '.orchestration.implement.current_section // null' "$state_file" 2>/dev/null)
  started_at=$(jq -r '.orchestration.implement.started_at // null' "$state_file" 2>/dev/null)

  local count
  count=$(echo "$current_tasks" | jq 'length')

  if is_json_output; then
    echo "{\"tasks\": $current_tasks, \"section\": $section, \"started_at\": $started_at, \"count\": $count}"
  else
    if [[ "$count" -eq 0 || "$current_tasks" == "[]" ]]; then
      echo -e "${BLUE}INFO${RESET}: No tasks currently in progress"
      echo "  Use 'speckit tasks start <id>...' to begin working on tasks"
    else
      echo -e "${GREEN}OK${RESET}: $count task(s) in progress"
      if [[ "$section" != "null" && -n "$section" ]]; then
        echo "  Section: $section"
      fi
      if [[ "$started_at" != "null" && -n "$started_at" ]]; then
        echo "  Started: $started_at"
      fi
      echo "  Tasks:"
      echo "$current_tasks" | jq -r '.[]' | while read -r task; do
        echo "    - $task"
      done
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
  local in_dashboard_section=0

  while IFS= read -r line; do
    # Skip Progress Dashboard section to avoid counting Quick Status tasks
    if [[ "$line" == "## Progress Dashboard" ]]; then
      in_dashboard_section=1
      continue
    fi
    if [[ $in_dashboard_section -eq 1 ]]; then
      # End of dashboard: next ## header (not ###) or first ---
      if [[ "$line" =~ ^##[[:space:]] && ! "$line" =~ ^###[[:space:]] ]]; then
        in_dashboard_section=0
        # Fall through to process this line
      elif [[ "$line" == "---" ]]; then
        in_dashboard_section=0
        continue
      else
        continue
      fi
    fi

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

    # Count and collect tasks (supports both T001 and **A1.1** formats)
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*(\*?\*?[A-Z][0-9]+.*)$ ]]; then
      ((phase_completed++)) || true
      ((phase_total++)) || true
      ((total_completed++)) || true
      ((total_tasks++)) || true
      # Add to quick status (completed tasks)
      if [[ $quick_count -lt 10 ]]; then
        quick_status+="- [x] ${BASH_REMATCH[1]}\n"
        ((quick_count++)) || true
      fi
    elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*(\*?\*?[A-Z][0-9]+.*)$ ]]; then
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
      cmd_mark "$@"
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
    start)
      cmd_start "$@"
      ;;
    working|wip)
      cmd_working
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
