#!/usr/bin/env bash
#
# speckit-checklist.sh - Checklist operations
#
# Usage:
#   speckit checklist status [dir]      Count completed/total across checklists
#   speckit checklist list [dir]        List all checklists with status
#   speckit checklist incomplete [dir]  List incomplete items
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
speckit checklist - Checklist operations

USAGE:
    speckit checklist <command> [options]

COMMANDS:
    status [dir]        Show completion status across all checklists
                        Default: looks in specs/*/checklists/

    list [dir]          List all checklist files with their status

    incomplete [dir]    List all incomplete checklist items

    show <file>         Show status of a specific checklist file

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit checklist status
    speckit checklist status specs/001-auth/checklists/
    speckit checklist list
    speckit checklist incomplete
    speckit checklist show specs/001-auth/checklists/security.md
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get default checklists directory
get_checklists_base() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Try to get specs path from state file
  local specs_path="specs"
  if [[ -f "$state_file" ]]; then
    local config_path
    config_path=$(json_get "$state_file" ".config.specs_path" 2>/dev/null || echo "")
    if [[ -n "$config_path" && "$config_path" != "null" ]]; then
      specs_path="${config_path%/}"
    fi
  fi

  echo "${repo_root}/${specs_path}"
}

# Find all checklist files in a directory (recursively)
find_checklists() {
  local dir="$1"

  if [[ ! -d "$dir" ]]; then
    return
  fi

  # Find markdown files in checklists directories or files with checklist in name
  find "$dir" -type f -name "*.md" \( -path "*/checklists/*" -o -name "*checklist*.md" \) 2>/dev/null | sort
}

# Count checkboxes in a file
# Returns: completed total
count_checkboxes() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "0 0"
    return
  fi

  local total completed

  # Count all checkbox items: - [ ] or - [x]
  # Note: grep -c exits 1 when count is 0, so we capture output and default
  total=$(grep -cE '^\s*-\s*\[[x ]\]' "$file" 2>/dev/null) || total=0

  # Count completed items: - [x]
  completed=$(grep -cE '^\s*-\s*\[x\]' "$file" 2>/dev/null) || completed=0

  echo "$completed $total"
}

# Get incomplete items from a file
get_incomplete_items() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  # Find unchecked items and extract the text
  grep -E '^\s*-\s*\[ \]' "$file" 2>/dev/null | sed 's/^\s*-\s*\[ \]\s*//'
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
  local dir="${1:-}"

  if [[ -z "$dir" ]]; then
    dir="$(get_checklists_base)"
  fi

  if [[ ! -d "$dir" ]]; then
    log_error "Directory not found: $dir"
    exit 1
  fi

  local total_items=0
  local completed_items=0
  local file_count=0

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    local counts
    counts=$(count_checkboxes "$file")
    local completed total
    read -r completed total <<< "$counts"

    ((total_items += total)) || true
    ((completed_items += completed)) || true
    ((file_count++)) || true
  done < <(find_checklists "$dir")

  local percent
  percent=$(calc_percent "$completed_items" "$total_items")

  if is_json_output; then
    echo "{\"files\": $file_count, \"completed\": $completed_items, \"total\": $total_items, \"percent\": $percent}"
  else
    if [[ $file_count -eq 0 ]]; then
      echo -e "${YELLOW}WARN${RESET}: No checklists found"
      echo "  Path: $dir"
      exit 0
    fi

    # Three-Line Rule: Summary first
    if [[ "$percent" -eq 100 ]]; then
      echo -e "${GREEN}OK${RESET}: Checklists $completed_items/$total_items complete (100%)"
    else
      echo -e "${BLUE}INFO${RESET}: Checklists $completed_items/$total_items complete ($percent%)"
    fi
    echo "  Files: $file_count"

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

cmd_list() {
  local dir="${1:-}"

  if [[ -z "$dir" ]]; then
    dir="$(get_checklists_base)"
  fi

  if [[ ! -d "$dir" ]]; then
    log_error "Directory not found: $dir"
    exit 1
  fi

  # Collect all checklist data first
  local files_json="[]"
  local file_paths=()
  local file_completed=()
  local file_total=()
  local file_percent=()
  local repo_root
  repo_root="$(get_repo_root)"

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local counts
    counts=$(count_checkboxes "$file")
    local completed total
    read -r completed total <<< "$counts"
    local percent
    percent=$(calc_percent "$completed" "$total")
    local rel_path="${file#$repo_root/}"

    file_paths+=("$rel_path")
    file_completed+=("$completed")
    file_total+=("$total")
    file_percent+=("$percent")
  done < <(find_checklists "$dir")

  local file_count=${#file_paths[@]}

  if is_json_output; then
    for i in "${!file_paths[@]}"; do
      files_json=$(echo "$files_json" | jq --arg path "${file_paths[$i]}" \
        --argjson completed "${file_completed[$i]}" \
        --argjson total "${file_total[$i]}" \
        --argjson percent "${file_percent[$i]}" \
        '. + [{"path": $path, "completed": $completed, "total": $total, "percent": $percent}]')
    done
    echo "$files_json"
  else
    # Three-Line Rule: Summary first
    if [[ $file_count -eq 0 ]]; then
      echo -e "${YELLOW}WARN${RESET}: No checklists found"
      echo "  Path: $dir"
    else
      echo -e "${BLUE}INFO${RESET}: Found $file_count checklist(s)"
      echo ""
      # File list (line 3+)
      for i in "${!file_paths[@]}"; do
        if [[ "${file_percent[$i]}" -eq 100 ]]; then
          print_status complete "${file_paths[$i]} (${file_completed[$i]}/${file_total[$i]})"
        elif [[ "${file_percent[$i]}" -gt 0 ]]; then
          print_status progress "${file_paths[$i]} (${file_completed[$i]}/${file_total[$i]} - ${file_percent[$i]}%)"
        else
          print_status pending "${file_paths[$i]} (${file_completed[$i]}/${file_total[$i]})"
        fi
      done
    fi
  fi
}

cmd_incomplete() {
  local dir="${1:-}"

  if [[ -z "$dir" ]]; then
    dir="$(get_checklists_base)"
  fi

  if [[ ! -d "$dir" ]]; then
    log_error "Directory not found: $dir"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"

  # Collect all incomplete items first
  local items_json="[]"
  local all_files=()
  local all_items=()
  local current_file=""

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local rel_path="${file#$repo_root/}"

    while IFS= read -r item; do
      [[ -z "$item" ]] && continue
      all_files+=("$rel_path")
      all_items+=("$item")

      if is_json_output; then
        items_json=$(echo "$items_json" | jq --arg file "$rel_path" --arg item "$item" \
          '. + [{"file": $file, "item": $item}]')
      fi
    done < <(get_incomplete_items "$file")
  done < <(find_checklists "$dir")

  local total_incomplete=${#all_items[@]}

  if is_json_output; then
    echo "{\"total\": $total_incomplete, \"items\": $items_json}"
  else
    # Three-Line Rule: Summary first
    if [[ $total_incomplete -eq 0 ]]; then
      echo -e "${GREEN}OK${RESET}: All checklist items complete"
    else
      echo -e "${YELLOW}WARN${RESET}: $total_incomplete incomplete item(s)"
      echo ""
      # Item list (line 3+)
      current_file=""
      for i in "${!all_items[@]}"; do
        if [[ "${all_files[$i]}" != "$current_file" ]]; then
          current_file="${all_files[$i]}"
          echo -e "${DIM}$current_file${RESET}"
        fi
        echo "  - ${all_items[$i]}"
      done
    fi
  fi
}

cmd_show() {
  local file="$1"

  if [[ -z "$file" ]]; then
    log_error "File path required"
    echo "Usage: speckit checklist show <file>"
    exit 1
  fi

  # Resolve relative path
  if [[ ! "$file" = /* ]]; then
    file="$(get_repo_root)/$file"
  fi

  if [[ ! -f "$file" ]]; then
    log_error "File not found: $file"
    exit 1
  fi

  local counts
  counts=$(count_checkboxes "$file")
  local completed total
  read -r completed total <<< "$counts"

  local percent
  percent=$(calc_percent "$completed" "$total")

  if is_json_output; then
    local items_json="[]"
    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[([x[:space:]])\][[:space:]]*(.+)$ ]]; then
        local checked="${BASH_REMATCH[1]}"
        local text="${BASH_REMATCH[2]}"
        local status="incomplete"
        [[ "$checked" == "x" ]] && status="complete"
        items_json=$(echo "$items_json" | jq --arg text "$text" --arg status "$status" \
          '. + [{"text": $text, "status": $status}]')
      fi
    done < "$file"

    echo "{\"completed\": $completed, \"total\": $total, \"percent\": $percent, \"items\": $items_json}"
  else
    # Three-Line Rule: Summary first
    local filename
    filename=$(basename "$file")
    if [[ "$percent" -eq 100 ]]; then
      echo -e "${GREEN}OK${RESET}: $filename - $completed/$total complete (100%)"
    else
      echo -e "${BLUE}INFO${RESET}: $filename - $completed/$total complete ($percent%)"
    fi
    echo ""
    # Item list (line 3+)
    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[x\][[:space:]]*(.+)$ ]]; then
        print_status complete "${BASH_REMATCH[1]}"
      elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\[[[:space:]]\][[:space:]]*(.+)$ ]]; then
        print_status pending "${BASH_REMATCH[1]}"
      fi
    done < "$file"
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
    list|ls)
      cmd_list "${1:-}"
      ;;
    incomplete|inc)
      cmd_incomplete "${1:-}"
      ;;
    show)
      cmd_show "${1:-}"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'speckit checklist --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
