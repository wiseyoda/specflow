#!/usr/bin/env bash
#
# speckit-lessons.sh - Lessons learned management
#
# Usage:
#   speckit lessons init [file]           Initialize lessons-learned.md
#   speckit lessons add <type> <desc>     Add an entry (error, decision, gotcha)
#   speckit lessons check <keyword>       Search lessons for keyword
#   speckit lessons list                  List all entries
#   speckit lessons show [file]           Show lessons file
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
speckit lessons - Lessons learned management

USAGE:
    speckit lessons <command> [options]

COMMANDS:
    init [file]             Initialize lessons-learned.md in feature directory
                            Default: current feature's specs/NNN-feature/

    add <type> <args>       Add an entry to lessons learned
                            Types: error, decision, gotcha

    check <keyword>         Search lessons for keyword
                            Case-insensitive search

    list [file]             List all entries with types

    show [file]             Show the lessons file content

    path                    Show path to lessons file

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit lessons init
    speckit lessons add error "Database connection timeout"
    speckit lessons add decision "Chose Redis for caching"
    speckit lessons add gotcha "macOS sed" "No -i flag" "Use temp file"
    speckit lessons check "timeout"
    speckit lessons list
EOF
}

# =============================================================================
# Helpers
# =============================================================================

LESSONS_FILENAME="lessons-learned.md"

# Find lessons file in current feature
find_lessons_file() {
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
      # Look for lessons in current phase directory
      local phase_dir
      phase_dir=$(find "${repo_root}/${specs_path}" -maxdepth 1 -type d -name "${phase_num}-*" 2>/dev/null | head -1)
      if [[ -n "$phase_dir" ]]; then
        echo "${phase_dir}/${LESSONS_FILENAME}"
        return
      fi
    fi
  fi

  # Fallback: find most recent lessons file
  find "${repo_root}/specs" -name "$LESSONS_FILENAME" -type f 2>/dev/null | sort -r | head -1
}

# Get feature directory
get_feature_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  if [[ -f "$state_file" ]]; then
    local phase_num
    phase_num=$(json_get "$state_file" ".orchestration.phase_number" 2>/dev/null || echo "")
    local specs_path
    specs_path=$(json_get "$state_file" ".config.specs_path" 2>/dev/null || echo "specs")
    specs_path="${specs_path%/}"

    if [[ -n "$phase_num" && "$phase_num" != "null" ]]; then
      local phase_dir
      phase_dir=$(find "${repo_root}/${specs_path}" -maxdepth 1 -type d -name "${phase_num}-*" 2>/dev/null | head -1)
      if [[ -n "$phase_dir" ]]; then
        echo "$phase_dir"
        return
      fi
    fi
  fi

  # Fallback: try to find from git branch
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [[ "$branch" =~ ^([0-9]+)- ]]; then
    local num="${BASH_REMATCH[1]}"
    local phase_dir
    phase_dir=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "${num}-*" 2>/dev/null | head -1)
    if [[ -n "$phase_dir" ]]; then
      echo "$phase_dir"
      return
    fi
  fi

  echo ""
}

# =============================================================================
# Commands
# =============================================================================

cmd_init() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    local feature_dir
    feature_dir="$(get_feature_dir)"
    if [[ -z "$feature_dir" ]]; then
      log_error "Cannot determine feature directory"
      log_info "Specify a file path or ensure you're on a feature branch"
      exit 1
    fi
    file="${feature_dir}/${LESSONS_FILENAME}"
  fi

  if [[ -f "$file" ]]; then
    log_warn "Lessons file already exists: $file"
    if is_json_output; then
      echo "{\"path\": \"$file\", \"created\": false, \"exists\": true}"
    fi
    exit 0
  fi

  # Get template
  local template_path
  template_path="$(get_templates_path)/lessons-learned-template.md"

  if [[ ! -f "$template_path" ]]; then
    log_error "Template not found: $template_path"
    exit 1
  fi

  # Create directory if needed
  local dir
  dir=$(dirname "$file")
  mkdir -p "$dir"

  # Copy template and fill in placeholders
  local date_now
  date_now=$(date +"%Y-%m-%d")
  local feature_name
  feature_name=$(basename "$dir")

  sed -e "s/\[FEATURE NAME\]/${feature_name}/g" \
      -e "s/\[DATE\]/${date_now}/g" \
      "$template_path" > "$file"

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    echo "{\"path\": \"$rel_path\", \"created\": true}"
  else
    log_success "Created lessons file: $rel_path"
  fi
}

cmd_add() {
  local entry_type="${1:-}"
  shift || true

  if [[ -z "$entry_type" ]]; then
    log_error "Entry type required: error, decision, gotcha"
    exit 1
  fi

  local file
  file="$(find_lessons_file)"

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No lessons-learned.md found"
    log_info "Run 'speckit lessons init' first"
    exit 1
  fi

  local date_now
  date_now=$(date +"%Y-%m-%d")
  local entry=""

  case "$entry_type" in
    error)
      local description="${1:-}"
      if [[ -z "$description" ]]; then
        log_error "Description required for error entry"
        exit 1
      fi
      entry="### ${date_now} Error: ${description}

**Context**: [What we were doing]
**Root Cause**: [Why it happened]
**Fix**: [How we fixed it]
**Prevention**: [How to avoid in future]

"
      # Insert after Error Patterns section
      local temp_file
      temp_file=$(mktemp)
      awk -v entry="$entry" '
        /^## Error Patterns/ { print; getline; print; print ""; print entry; next }
        { print }
      ' "$file" > "$temp_file"
      mv "$temp_file" "$file"
      ;;

    decision)
      local description="${1:-}"
      if [[ -z "$description" ]]; then
        log_error "Description required for decision entry"
        exit 1
      fi
      entry="### ${date_now} Decision: ${description}

**Context**: [Why we needed to decide]
**Options Considered**: [What we considered]
**Chosen**: [What we picked and why]
**Outcome**: [How it worked out]

"
      # Insert after Architecture Decisions section
      local temp_file
      temp_file=$(mktemp)
      awk -v entry="$entry" '
        /^## Architecture Decisions/ { print; getline; print; print ""; print entry; next }
        { print }
      ' "$file" > "$temp_file"
      mv "$temp_file" "$file"
      ;;

    gotcha)
      local tech="${1:-}"
      local issue="${2:-}"
      local workaround="${3:-}"
      if [[ -z "$tech" || -z "$issue" ]]; then
        log_error "Usage: speckit lessons add gotcha <technology> <issue> [workaround]"
        exit 1
      fi
      # Add to gotcha table
      local temp_file
      temp_file=$(mktemp)
      awk -v tech="$tech" -v issue="$issue" -v wa="${workaround:-TBD}" '
        /^\| Technology \| Gotcha \| Workaround \|/ {
          print
          getline  # header separator
          print
          print "| " tech " | " issue " | " wa " |"
          next
        }
        { print }
      ' "$file" > "$temp_file"
      mv "$temp_file" "$file"
      entry="| $tech | $issue | ${workaround:-TBD} |"
      ;;

    *)
      log_error "Unknown entry type: $entry_type"
      log_info "Valid types: error, decision, gotcha"
      exit 1
      ;;
  esac

  # Update last updated date (POSIX-compliant)
  sed_in_place "$file" "s/\*\*Last Updated\*\*: .*/\*\*Last Updated\*\*: ${date_now}/"

  if is_json_output; then
    echo "{\"type\": \"$entry_type\", \"added\": true}"
  else
    log_success "Added $entry_type entry to lessons-learned.md"
  fi
}

cmd_check() {
  local keyword="${1:-}"

  if [[ -z "$keyword" ]]; then
    log_error "Keyword required"
    exit 1
  fi

  local file
  file="$(find_lessons_file)"

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No lessons-learned.md found"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    local matches_json="[]"
    local line_num=0
    while IFS= read -r line; do
      ((line_num++)) || true
      if echo "$line" | grep -qi "$keyword"; then
        matches_json=$(echo "$matches_json" | jq --arg line "$line" --argjson num "$line_num" \
          '. + [{"line_number": $num, "content": $line}]')
      fi
    done < "$file"
    local count
    count=$(echo "$matches_json" | jq 'length')
    echo "{\"file\": \"$rel_path\", \"keyword\": \"$keyword\", \"count\": $count, \"matches\": $matches_json}"
  else
    # Three-line rule: Count and show status first, then details
    local count=0
    local all_matches=""
    while IFS= read -r line; do
      if echo "$line" | grep -qi "$keyword"; then
        ((count++)) || true
        all_matches+="$line"$'\n'
      fi
    done < "$file"

    # Three-line output: Status, location, detail
    if [[ $count -eq 0 ]]; then
      echo "No matches found for: $keyword"
      echo "File: $rel_path"
    else
      echo "Found $count matches for: $keyword"
      echo "File: $rel_path"
      echo ""
      echo "$all_matches" | grep -i --color=always "$keyword" 2>/dev/null || echo "$all_matches"
    fi
  fi
}

cmd_list() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_lessons_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No lessons-learned.md found"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    local entries_json="[]"
    local current_section=""
    while IFS= read -r line; do
      if [[ "$line" =~ ^##[[:space:]]+(Error|Architecture|Technology|Performance|Testing|Integration) ]]; then
        current_section="${BASH_REMATCH[1]}"
      elif [[ "$line" =~ ^###[[:space:]]+\[?([0-9-]+)\]?[[:space:]]+(Error|Decision):[[:space:]]*(.*)$ ]]; then
        local date="${BASH_REMATCH[1]}"
        local type="${BASH_REMATCH[2]}"
        local desc="${BASH_REMATCH[3]}"
        entries_json=$(echo "$entries_json" | jq --arg date "$date" --arg type "$type" --arg desc "$desc" \
          '. + [{"date": $date, "type": $type, "description": $desc}]')
      fi
    done < "$file"
    echo "{\"file\": \"$rel_path\", \"entries\": $entries_json}"
  else
    # Three-line rule: Count first, then details
    local count=0
    local entries=""
    while IFS= read -r line; do
      if [[ "$line" =~ ^###[[:space:]]+\[?([0-9-]+)\]?[[:space:]]+(Error|Decision):[[:space:]]*(.*)$ ]]; then
        ((count++)) || true
        local date="${BASH_REMATCH[1]}"
        local type="${BASH_REMATCH[2]}"
        local desc="${BASH_REMATCH[3]}"
        entries+="  [$date] $type: $desc"$'\n'
      fi
    done < "$file"

    # Three-line output: Status, location, entries
    if [[ $count -eq 0 ]]; then
      echo "No lessons learned entries found"
      echo "File: $rel_path"
    else
      echo "Lessons learned: $count entries"
      echo "File: $rel_path"
      echo ""
      echo -n "$entries"
    fi
  fi
}

cmd_show() {
  local file="${1:-}"

  if [[ -z "$file" ]]; then
    file="$(find_lessons_file)"
  fi

  if [[ -z "$file" || ! -f "$file" ]]; then
    log_error "No lessons-learned.md found"
    exit 1
  fi

  cat "$file"
}

cmd_path() {
  local file
  file="$(find_lessons_file)"

  if [[ -z "$file" ]]; then
    local feature_dir
    feature_dir="$(get_feature_dir)"
    if [[ -n "$feature_dir" ]]; then
      file="${feature_dir}/${LESSONS_FILENAME}"
    fi
  fi

  if [[ -z "$file" ]]; then
    log_error "Cannot determine lessons file path"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_path="${file#$repo_root/}"

  if is_json_output; then
    local exists="false"
    [[ -f "$file" ]] && exists="true"
    echo "{\"path\": \"$rel_path\", \"absolute\": \"$file\", \"exists\": $exists}"
  else
    echo "$rel_path"
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
    init)
      cmd_init "${1:-}"
      ;;
    add)
      cmd_add "$@"
      ;;
    check|search)
      cmd_check "${1:-}"
      ;;
    list|ls)
      cmd_list "${1:-}"
      ;;
    show)
      cmd_show "${1:-}"
      ;;
    path)
      cmd_path
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'speckit lessons --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
