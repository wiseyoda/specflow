#!/usr/bin/env bash
#
# speckit-issue.sh - Local issue tracking operations
#
# Usage:
#   speckit issue list              List all issues
#   speckit issue show <id>         Show issue details
#   speckit issue create <title>    Create new issue
#   speckit issue close <id>        Close an issue
#   speckit issue migrate           Migrate issues from ROADMAP.md
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# Validate dependencies
require_jq

# =============================================================================
# Constants
# =============================================================================

readonly ISSUES_DIR=".specify/issues"
readonly ISSUES_INDEX="${ISSUES_DIR}/index.json"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit issue - Local issue tracking operations

USAGE:
    speckit issue <command> [options]

COMMANDS:
    list                List all issues with status
        --open          Only open issues
        --closed        Only closed issues
        --phase <n>     Filter by assigned phase

    show <id>           Show issue details
                        Example: speckit issue show ISSUE-001

    create "<title>"    Create a new issue
        --description   Issue description
        --category      Category (bug, feature, improvement, etc.)
        --priority      Priority (high, medium, low)
        --phase         Assign to phase

    close <id>          Close an issue
        --resolution    Resolution notes

    update <id>         Update issue fields
        --title         New title
        --status        New status (open, closed, in_progress)
        --phase         Assign to phase
        --priority      Set priority

    migrate             Migrate issues from ROADMAP.md Issues Backlog
        --dry-run       Show what would happen without executing

    sync                Rebuild index.json from issue files

    path [id]           Show path to issue file (or issues directory)

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit issue list --open
    speckit issue show ISSUE-003
    speckit issue create "Fix login timeout" --category bug --priority high
    speckit issue close ISSUE-003 --resolution "Fixed in phase 0042"
    speckit issue migrate --dry-run
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get issues directory
get_issues_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/${ISSUES_DIR}"
}

# Ensure issues directory exists
ensure_issues_dir() {
  local issues_dir
  issues_dir="$(get_issues_dir)"
  mkdir -p "$issues_dir"
}

# Get next issue number
get_next_issue_number() {
  local issues_dir
  issues_dir="$(get_issues_dir)"

  local max=0
  for file in "$issues_dir"/ISSUE-*.md; do
    if [[ -f "$file" ]]; then
      local num
      num=$(basename "$file" | sed 's/ISSUE-\([0-9]*\).*/\1/' | sed 's/^0*//')
      if [[ "$num" -gt "$max" ]]; then
        max="$num"
      fi
    fi
  done

  printf "%03d" $((max + 1))
}

# Initialize or get index file path
get_index_path() {
  local issues_dir
  issues_dir="$(get_issues_dir)"
  echo "${issues_dir}/index.json"
}

# Initialize index.json if it doesn't exist
init_index() {
  local index_path
  index_path="$(get_index_path)"

  if [[ ! -f "$index_path" ]]; then
    echo '{"issues": []}' > "$index_path"
  fi
}

# Rebuild index.json from issue files (full sync)
rebuild_index() {
  local issues_dir
  issues_dir="$(get_issues_dir)"
  local index_path
  index_path="$(get_index_path)"

  local issues_array="[]"

  for file in "$issues_dir"/ISSUE-*.md; do
    if [[ ! -f "$file" ]]; then
      continue
    fi

    local id status phase
    id=$(basename "$file" .md)
    status=$(parse_issue_frontmatter "$file" "status")
    phase=$(parse_issue_frontmatter "$file" "phase")

    issues_array=$(echo "$issues_array" | jq \
      --arg id "$id" \
      --arg status "${status:-open}" \
      --arg phase "${phase:-}" \
      '. + [{id: $id, status: $status, phase: $phase}]')
  done

  echo "$issues_array" | jq '{issues: .}' > "$index_path"
}

# Add issue to index
add_to_index() {
  local id="$1"
  local status="${2:-open}"
  local phase="${3:-}"

  local index_path
  index_path="$(get_index_path)"
  init_index

  # Add new entry
  local updated
  updated=$(jq \
    --arg id "$id" \
    --arg status "$status" \
    --arg phase "$phase" \
    '.issues += [{id: $id, status: $status, phase: $phase}]' "$index_path")

  echo "$updated" > "$index_path"
}

# Update issue in index
update_in_index() {
  local id="$1"
  local status="${2:-}"
  local phase="${3:-}"

  local index_path
  index_path="$(get_index_path)"

  if [[ ! -f "$index_path" ]]; then
    rebuild_index
    return
  fi

  # Update existing entry or add if not found
  local updated
  if jq -e --arg id "$id" '.issues | map(select(.id == $id)) | length > 0' "$index_path" > /dev/null 2>&1; then
    # Update existing
    if [[ -n "$status" ]] && [[ -n "$phase" ]]; then
      updated=$(jq --arg id "$id" --arg status "$status" --arg phase "$phase" \
        '.issues = [.issues[] | if .id == $id then {id: $id, status: $status, phase: $phase} else . end]' "$index_path")
    elif [[ -n "$status" ]]; then
      updated=$(jq --arg id "$id" --arg status "$status" \
        '.issues = [.issues[] | if .id == $id then .status = $status else . end]' "$index_path")
    elif [[ -n "$phase" ]]; then
      updated=$(jq --arg id "$id" --arg phase "$phase" \
        '.issues = [.issues[] | if .id == $id then .phase = $phase else . end]' "$index_path")
    else
      return
    fi
  else
    # Add new entry
    updated=$(jq --arg id "$id" --arg status "${status:-open}" --arg phase "${phase:-}" \
      '.issues += [{id: $id, status: $status, phase: $phase}]' "$index_path")
  fi

  echo "$updated" > "$index_path"
}

# Find issue file by ID
find_issue_file() {
  local id="$1"
  local issues_dir
  issues_dir="$(get_issues_dir)"

  # Normalize ID format (ISSUE-001, issue-1, 001, 1 all work)
  local num
  num=$(echo "$id" | grep -oE '[0-9]+' | head -1)
  num=$(printf "%03d" "$((10#$num))")

  local file="${issues_dir}/ISSUE-${num}.md"
  if [[ -f "$file" ]]; then
    echo "$file"
  fi
}

# Parse issue frontmatter
parse_issue_frontmatter() {
  local file="$1"
  local key="$2"

  awk -v key="$key" '
    /^---$/ { if (in_fm) exit; in_fm = 1; next }
    in_fm && $0 ~ "^"key":" {
      sub("^"key":[[:space:]]*", "")
      print
      exit
    }
  ' "$file"
}

# =============================================================================
# Commands
# =============================================================================

cmd_list() {
  local filter="all"
  local phase_filter=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --open)
        filter="open"
        shift
        ;;
      --closed)
        filter="closed"
        shift
        ;;
      --phase)
        phase_filter="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  local issues_dir
  issues_dir="$(get_issues_dir)"

  if [[ ! -d "$issues_dir" ]]; then
    if is_json_output; then
      echo '{"issues": [], "count": 0}'
    else
      log_info "No issues directory found"
      echo "Create issues with: speckit issue create \"<title>\""
    fi
    exit 0
  fi

  # Collect issues
  local ids=()
  local titles=()
  local statuses=()
  local priorities=()
  local phases=()

  for file in "$issues_dir"/ISSUE-*.md; do
    if [[ ! -f "$file" ]]; then
      continue
    fi

    local id
    id=$(basename "$file" .md)
    local title
    title=$(parse_issue_frontmatter "$file" "title")
    local status
    status=$(parse_issue_frontmatter "$file" "status")
    local priority
    priority=$(parse_issue_frontmatter "$file" "priority")
    local phase
    phase=$(parse_issue_frontmatter "$file" "phase")

    # Apply filters
    case "$filter" in
      open)
        [[ "$status" == "closed" ]] && continue
        ;;
      closed)
        [[ "$status" != "closed" ]] && continue
        ;;
    esac

    if [[ -n "$phase_filter" ]] && [[ "$phase" != "$phase_filter" ]]; then
      continue
    fi

    ids+=("$id")
    titles+=("$title")
    statuses+=("${status:-open}")
    priorities+=("${priority:-medium}")
    phases+=("${phase:-}")
  done

  if is_json_output; then
    local json="[]"
    for i in "${!ids[@]}"; do
      json=$(echo "$json" | jq \
        --arg id "${ids[$i]}" \
        --arg title "${titles[$i]}" \
        --arg status "${statuses[$i]}" \
        --arg priority "${priorities[$i]}" \
        --arg phase "${phases[$i]}" \
        '. + [{id: $id, title: $title, status: $status, priority: $priority, phase: $phase}]')
    done
    echo "$json" | jq '{issues: ., count: (. | length)}'
  else
    local total=${#ids[@]}
    local open=0
    local closed=0

    for status in "${statuses[@]}"; do
      case "$status" in
        closed) ((closed++)) || true ;;
        *) ((open++)) || true ;;
      esac
    done

    echo -e "${BLUE}INFO${RESET}: $total issue(s) ($open open, $closed closed)"
    echo ""

    for i in "${!ids[@]}"; do
      local icon="◯"
      local color=""
      case "${statuses[$i]}" in
        closed) icon="${GREEN}✓${RESET}" ;;
        in_progress) icon="${CYAN}◉${RESET}" ;;
      esac

      case "${priorities[$i]}" in
        high) color="${RED}" ;;
        medium) color="${YELLOW}" ;;
        low) color="${DIM}" ;;
      esac

      local phase_hint=""
      if [[ -n "${phases[$i]}" ]]; then
        phase_hint=" → ${phases[$i]}"
      fi

      echo -e "  $icon ${color}${ids[$i]}${RESET}: ${titles[$i]}${phase_hint}"
    done
  fi
}

cmd_show() {
  local id="$1"

  if [[ -z "$id" ]]; then
    log_error "Issue ID required"
    echo "Usage: speckit issue show <id>"
    exit 1
  fi

  local file
  file=$(find_issue_file "$id")

  if [[ -z "$file" ]]; then
    log_error "Issue not found: $id"
    echo "List issues with: speckit issue list"
    exit 1
  fi

  if is_json_output; then
    local title status category priority phase created resolved
    title=$(parse_issue_frontmatter "$file" "title")
    status=$(parse_issue_frontmatter "$file" "status")
    category=$(parse_issue_frontmatter "$file" "category")
    priority=$(parse_issue_frontmatter "$file" "priority")
    phase=$(parse_issue_frontmatter "$file" "phase")
    created=$(parse_issue_frontmatter "$file" "created")
    resolved=$(parse_issue_frontmatter "$file" "resolved")

    jq -n \
      --arg id "$(basename "$file" .md)" \
      --arg title "$title" \
      --arg status "$status" \
      --arg category "$category" \
      --arg priority "$priority" \
      --arg phase "$phase" \
      --arg created "$created" \
      --arg resolved "$resolved" \
      --arg file "$file" \
      '{id: $id, title: $title, status: $status, category: $category, priority: $priority, phase: $phase, created: $created, resolved: $resolved, file: $file}'
  else
    cat "$file"
  fi
}

cmd_create() {
  local title=""
  local description=""
  local category="improvement"
  local priority="medium"
  local phase=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --description)
        description="$2"
        shift 2
        ;;
      --category)
        category="$2"
        shift 2
        ;;
      --priority)
        priority="$2"
        shift 2
        ;;
      --phase)
        phase="$2"
        shift 2
        ;;
      *)
        if [[ -z "$title" ]]; then
          title="$1"
        fi
        shift
        ;;
    esac
  done

  if [[ -z "$title" ]]; then
    log_error "Title required"
    echo "Usage: speckit issue create \"<title>\" [--category bug] [--priority high]"
    exit 1
  fi

  ensure_issues_dir
  local issues_dir
  issues_dir="$(get_issues_dir)"

  local num
  num=$(get_next_issue_number)
  local id="ISSUE-${num}"
  local file="${issues_dir}/${id}.md"

  cat > "$file" << EOF
---
id: ${id}
title: ${title}
status: open
category: ${category}
priority: ${priority}
phase: ${phase}
created: $(date +%Y-%m-%d)
resolved:
---

# ${id}: ${title}

## Problem

${description:-[TODO: Describe the problem or request]}

## Expected Outcome

[TODO: What should happen when this is resolved?]

## Notes

<!-- Additional context, related files, etc. -->
EOF

  # Update index.json
  add_to_index "$id" "open" "$phase"

  log_success "Created issue: $id"

  if is_json_output; then
    jq -n \
      --arg id "$id" \
      --arg title "$title" \
      --arg file "$file" \
      '{created: true, id: $id, title: $title, file: $file}'
  else
    echo ""
    echo "Edit with: ${EDITOR:-vim} $file"
    echo "View: speckit issue show $id"
  fi
}

cmd_close() {
  local id="$1"
  shift || true

  local resolution=""

  # Parse remaining arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --resolution)
        resolution="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  if [[ -z "$id" ]]; then
    log_error "Issue ID required"
    echo "Usage: speckit issue close <id> [--resolution \"notes\"]"
    exit 1
  fi

  local file
  file=$(find_issue_file "$id")

  if [[ -z "$file" ]]; then
    log_error "Issue not found: $id"
    exit 1
  fi

  # Update status and resolved date in frontmatter
  local temp_file
  temp_file=$(mktemp)

  awk -v resolved="$(date +%Y-%m-%d)" -v resolution="$resolution" '
    /^---$/ { if (in_fm) { in_fm = 0 } else { in_fm = 1 } }
    in_fm && /^status:/ { print "status: closed"; next }
    in_fm && /^resolved:/ { print "resolved: " resolved; next }
    { print }
  ' "$file" > "$temp_file"

  # Add resolution notes if provided
  if [[ -n "$resolution" ]]; then
    echo "" >> "$temp_file"
    echo "## Resolution" >> "$temp_file"
    echo "" >> "$temp_file"
    echo "$resolution" >> "$temp_file"
  fi

  mv "$temp_file" "$file"

  local issue_id
  issue_id=$(basename "$file" .md)

  # Update index.json
  update_in_index "$issue_id" "closed" ""

  log_success "Closed issue: $issue_id"

  if is_json_output; then
    jq -n \
      --arg id "$issue_id" \
      --arg resolved "$(date +%Y-%m-%d)" \
      '{closed: true, id: $id, resolved: $resolved}'
  fi
}

cmd_update() {
  local id="$1"
  shift || true

  local title=""
  local status=""
  local phase=""
  local priority=""

  # Parse remaining arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)
        title="$2"
        shift 2
        ;;
      --status)
        status="$2"
        shift 2
        ;;
      --phase)
        phase="$2"
        shift 2
        ;;
      --priority)
        priority="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  if [[ -z "$id" ]]; then
    log_error "Issue ID required"
    echo "Usage: speckit issue update <id> [--status open] [--phase 0050]"
    exit 1
  fi

  local file
  file=$(find_issue_file "$id")

  if [[ -z "$file" ]]; then
    log_error "Issue not found: $id"
    exit 1
  fi

  local temp_file
  temp_file=$(mktemp)

  awk -v title="$title" -v status="$status" -v phase="$phase" -v priority="$priority" '
    /^---$/ { if (in_fm) { in_fm = 0 } else { in_fm = 1 } }
    in_fm && /^title:/ && title != "" { print "title: " title; next }
    in_fm && /^status:/ && status != "" { print "status: " status; next }
    in_fm && /^phase:/ && phase != "" { print "phase: " phase; next }
    in_fm && /^priority:/ && priority != "" { print "priority: " priority; next }
    { print }
  ' "$file" > "$temp_file"

  mv "$temp_file" "$file"

  local issue_id
  issue_id=$(basename "$file" .md)

  # Update index.json if status or phase changed
  if [[ -n "$status" ]] || [[ -n "$phase" ]]; then
    update_in_index "$issue_id" "$status" "$phase"
  fi

  log_success "Updated issue: $issue_id"

  if is_json_output; then
    jq -n --arg id "$issue_id" '{updated: true, id: $id}'
  fi
}

cmd_migrate() {
  local dry_run=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        dry_run=true
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  local roadmap_path
  roadmap_path="$(get_repo_root)/ROADMAP.md"

  if [[ ! -f "$roadmap_path" ]]; then
    log_error "ROADMAP.md not found"
    exit 1
  fi

  # Three-line rule: Status will be shown after scan
  # Look for Issues Backlog section or ISSUE-XXX patterns
  local issue_count=0

  # Pattern 1: ISSUE-XXX in tables
  # Use grep | wc -l instead of grep -c to avoid exit code 1 when count is 0
  issue_count=$(grep -E 'ISSUE-[0-9]+' "$roadmap_path" 2>/dev/null | wc -l | tr -d ' ')

  # Pattern 2: Issues Backlog section with table rows
  if grep -q "## Issues Backlog" "$roadmap_path" 2>/dev/null; then
    local backlog_count
    backlog_count=$(awk '/## Issues Backlog/,/^## [^I]/ { if (/^\|[[:space:]]*ISSUE/) print }' "$roadmap_path" | wc -l | tr -d ' ')
    issue_count=$((issue_count + backlog_count))
  fi

  echo "Found approximately $issue_count issue reference(s)"
  echo ""

  if [[ "$issue_count" -eq 0 ]]; then
    log_info "No issues found to migrate"
    exit 0
  fi

  if $dry_run; then
    echo "DRY RUN - Would execute:"
    echo ""
    echo "1. Create .specify/issues/ directory"
    echo "2. Extract ~$issue_count issue(s) to individual files"
    echo "3. Remove Issues Backlog section from ROADMAP.md"
    echo ""
    echo "No changes made."
    exit 0
  fi

  ensure_issues_dir
  local issues_dir
  issues_dir="$(get_issues_dir)"

  local migrated=0

  # Extract issues from backlog section
  if grep -q "## Issues Backlog" "$roadmap_path" 2>/dev/null; then
    awk '/## Issues Backlog/,/^## [^I]/' "$roadmap_path" | grep -E '^\|[[:space:]]*ISSUE' | while IFS='|' read -r _ id title status category _; do
      id=$(echo "$id" | tr -d ' ')
      title=$(echo "$title" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      status=$(echo "$status" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      category=$(echo "$category" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

      local file="${issues_dir}/${id}.md"

      if [[ -f "$file" ]]; then
        continue
      fi

      cat > "$file" << EOF
---
id: ${id}
title: ${title}
status: ${status:-open}
category: ${category:-improvement}
priority: medium
phase:
created: $(date +%Y-%m-%d)
resolved:
---

# ${id}: ${title}

## Problem

Migrated from ROADMAP.md Issues Backlog.

## Expected Outcome

[TODO: Define expected outcome]

## Notes

<!-- Additional context -->
EOF

      ((migrated++)) || true
    done
  fi

  # Rebuild index after migration
  rebuild_index

  log_success "Migrated $migrated issue(s) to .specify/issues/"
  echo ""
  echo "Review with: speckit issue list"
  echo ""
  echo "Note: Issues Backlog section still exists in ROADMAP.md"
  echo "Remove it manually after verifying migration."
}

cmd_sync() {
  local issues_dir
  issues_dir="$(get_issues_dir)"

  if [[ ! -d "$issues_dir" ]]; then
    log_error "No issues directory found"
    exit 1
  fi

  rebuild_index

  local index_path
  index_path="$(get_index_path)"
  local count
  count=$(jq '.issues | length' "$index_path")

  log_success "Rebuilt index.json with $count issue(s)"

  if is_json_output; then
    cat "$index_path"
  fi
}

cmd_path() {
  local id="${1:-}"

  if [[ -z "$id" ]]; then
    get_issues_dir
  else
    local file
    file=$(find_issue_file "$id")

    if [[ -n "$file" ]]; then
      echo "$file"
    else
      echo "$(get_issues_dir)/ISSUE-${id}.md (not found)"
      exit 1
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
    list|ls)
      cmd_list "$@"
      ;;
    show)
      cmd_show "${1:-}"
      ;;
    create|new)
      cmd_create "$@"
      ;;
    close)
      cmd_close "$@"
      ;;
    update)
      cmd_update "$@"
      ;;
    migrate)
      cmd_migrate "$@"
      ;;
    sync)
      cmd_sync
      ;;
    path)
      cmd_path "${1:-}"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'speckit issue --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
