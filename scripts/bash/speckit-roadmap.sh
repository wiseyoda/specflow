#!/usr/bin/env bash
#
# speckit-roadmap.sh - ROADMAP.md operations
#
# Usage:
#   speckit roadmap status              Show all phase statuses
#   speckit roadmap update <phase> <s>  Update phase status
#   speckit roadmap next                Get next pending phase
#   speckit roadmap validate            Check ROADMAP.md structure
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Constants
# =============================================================================

readonly STATUS_NOT_STARTED="⬜"
readonly STATUS_IN_PROGRESS="🔄"
readonly STATUS_COMPLETE="✅"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit roadmap - ROADMAP.md operations

USAGE:
    speckit roadmap <command> [options]

COMMANDS:
    status              Show all phase statuses from ROADMAP.md

    update <phase> <status>
                        Update phase status
                        Phase: 001, 002, etc. or phase name
                        Status: not_started, in_progress, complete

    next                Get the next pending phase (not started)

    current             Get the current in-progress phase

    validate            Check ROADMAP.md structure and consistency

    path                Show path to ROADMAP.md

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

STATUS VALUES:
    not_started         ⬜ Phase not yet begun
    in_progress         🔄 Phase currently being worked on
    complete            ✅ Phase finished and verified

EXAMPLES:
    speckit roadmap status
    speckit roadmap update 002 in_progress
    speckit roadmap update 002 complete
    speckit roadmap next
    speckit roadmap validate
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get ROADMAP.md path (from state file or default)
get_roadmap_path() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  # Try to get from state file
  if [[ -f "$state_file" ]]; then
    local config_path
    config_path=$(json_get "$state_file" ".config.roadmap_path" 2>/dev/null || echo "")
    if [[ -n "$config_path" && "$config_path" != "null" ]]; then
      echo "${repo_root}/${config_path}"
      return
    fi
  fi

  # Default
  echo "${repo_root}/ROADMAP.md"
}

# Ensure ROADMAP.md exists
ensure_roadmap() {
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  if [[ ! -f "$roadmap_path" ]]; then
    log_error "ROADMAP.md not found: $roadmap_path"
    log_info "Create one with: /speckit.roadmap"
    exit 1
  fi
}

# Convert status string to emoji
status_to_emoji() {
  local status="$1"
  case "$status" in
    not_started|pending|notstarted)
      echo "$STATUS_NOT_STARTED"
      ;;
    in_progress|inprogress|progress|wip)
      echo "$STATUS_IN_PROGRESS"
      ;;
    complete|completed|done)
      echo "$STATUS_COMPLETE"
      ;;
    *)
      log_error "Unknown status: $status"
      log_info "Valid: not_started, in_progress, complete"
      exit 1
      ;;
  esac
}

# Convert emoji to status string
emoji_to_status() {
  local emoji="$1"
  case "$emoji" in
    *"⬜"*)
      echo "not_started"
      ;;
    *"🔄"*)
      echo "in_progress"
      ;;
    *"✅"*)
      echo "complete"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

# Parse phase table from ROADMAP.md
# Returns: phase_num|phase_name|status|gate
parse_phase_table() {
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Extract table rows (lines starting with | followed by 3-digit number)
  grep -E '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" 2>/dev/null | while IFS='|' read -r _ phase_num name status gate _; do
    phase_num=$(echo "$phase_num" | tr -d ' ')
    name=$(echo "$name" | tr -d ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    status=$(echo "$status" | tr -d ' ')
    gate=$(echo "$gate" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Get actual name (may have spaces)
    name=$(echo "$name" | sed 's/\[//g;s/\]//g')

    local status_str
    status_str=$(emoji_to_status "$status")

    echo "${phase_num}|${name}|${status_str}|${gate}"
  done
}

# =============================================================================
# Commands
# =============================================================================

cmd_status() {
  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  if is_json_output; then
    local phases="[]"
    while IFS='|' read -r phase_num name status gate; do
      phases=$(echo "$phases" | jq --arg num "$phase_num" --arg name "$name" --arg status "$status" --arg gate "$gate" \
        '. + [{"phase": $num, "name": $name, "status": $status, "gate": $gate}]')
    done < <(parse_phase_table)
    echo "$phases"
  else
    print_header "Roadmap Status"
    echo ""

    local total=0
    local complete=0
    local in_progress=0

    while IFS='|' read -r phase_num name status gate; do
      ((total++)) || true
      case "$status" in
        complete)
          ((complete++)) || true
          print_status ok "$phase_num - $name"
          ;;
        in_progress)
          ((in_progress++)) || true
          print_status progress "$phase_num - $name"
          ;;
        *)
          print_status pending "$phase_num - $name"
          ;;
      esac
    done < <(parse_phase_table)

    echo ""
    echo "Progress: $complete/$total complete"
    if [[ $in_progress -gt 0 ]]; then
      echo "Currently in progress: $in_progress phase(s)"
    fi
  fi
}

cmd_update() {
  local phase="$1"
  local new_status="$2"

  if [[ -z "$phase" ]] || [[ -z "$new_status" ]]; then
    log_error "Phase and status required"
    echo "Usage: speckit roadmap update <phase> <status>"
    exit 1
  fi

  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Normalize phase number (ensure 3 digits)
  phase=$(printf "%03d" "${phase#0}" 2>/dev/null || echo "$phase")

  # Convert status to emoji
  local emoji
  emoji=$(status_to_emoji "$new_status")

  # Check if phase exists
  if ! grep -qE "^\|\s*${phase}\s*\|" "$roadmap_path"; then
    log_error "Phase not found: $phase"
    exit 1
  fi

  # Update the status in the table
  # Match: | 001 | Name | STATUS |
  # Replace the status column with new emoji
  local temp_file
  temp_file=$(mktemp)

  # Use sed to update the status in the phase line
  # This handles the table row format: | 001 | Name | ⬜ Status | Gate |
  sed -E "s/^(\|[[:space:]]*${phase}[[:space:]]*\|[^|]+\|)[[:space:]]*(⬜|🔄|✅)[[:space:]]*([^|]*\|)/\1 ${emoji} \3/" "$roadmap_path" > "$temp_file"

  mv "$temp_file" "$roadmap_path"

  log_success "Updated phase $phase to $new_status ($emoji)"

  if is_json_output; then
    echo "{\"phase\": \"$phase\", \"status\": \"$new_status\"}"
  fi
}

cmd_next() {
  ensure_roadmap

  local next_phase=""
  local next_name=""

  while IFS='|' read -r phase_num name status gate; do
    if [[ "$status" == "not_started" ]]; then
      next_phase="$phase_num"
      next_name="$name"
      break
    fi
  done < <(parse_phase_table)

  if [[ -z "$next_phase" ]]; then
    if is_json_output; then
      echo '{"next": null, "message": "All phases complete"}'
    else
      log_success "All phases complete!"
    fi
    exit 0
  fi

  if is_json_output; then
    echo "{\"next\": \"$next_phase\", \"name\": \"$next_name\"}"
  else
    echo "$next_phase - $next_name"
  fi
}

cmd_current() {
  ensure_roadmap

  local current_phase=""
  local current_name=""

  while IFS='|' read -r phase_num name status gate; do
    if [[ "$status" == "in_progress" ]]; then
      current_phase="$phase_num"
      current_name="$name"
      break
    fi
  done < <(parse_phase_table)

  if [[ -z "$current_phase" ]]; then
    if is_json_output; then
      echo '{"current": null, "message": "No phase in progress"}'
    else
      log_info "No phase currently in progress"
    fi
    exit 0
  fi

  if is_json_output; then
    echo "{\"current\": \"$current_phase\", \"name\": \"$current_name\"}"
  else
    echo "$current_phase - $current_name"
  fi
}

cmd_validate() {
  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  local errors=0
  local warnings=0

  log_step "Validating ROADMAP.md"

  # Check for phase overview table
  if ! grep -qE '^\|\s*Phase\s*\|' "$roadmap_path"; then
    log_error "Missing phase overview table header"
    ((errors++))
  fi

  # Check for at least one phase
  local phase_count
  phase_count=$(grep -cE '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" || echo "0")
  if [[ "$phase_count" -eq 0 ]]; then
    log_error "No phases found in table"
    ((errors++))
  else
    print_status ok "Found $phase_count phase(s)"
  fi

  # Check for duplicate phase numbers
  local duplicates
  duplicates=$(grep -oE '^\|\s*[0-9]{3}' "$roadmap_path" | sort | uniq -d | wc -l | tr -d ' ')
  if [[ "$duplicates" -gt 0 ]]; then
    log_error "Found duplicate phase numbers"
    ((errors++))
  else
    print_status ok "No duplicate phase numbers"
  fi

  # Check for phase sections matching table entries
  while IFS='|' read -r phase_num name status gate; do
    if ! grep -qE "^###\s*${phase_num}\s*-" "$roadmap_path"; then
      log_warn "Missing section for phase $phase_num"
      ((warnings++))
    fi
  done < <(parse_phase_table)

  # Check for multiple in-progress phases
  local in_progress
  in_progress=$(parse_phase_table | grep -c '|in_progress|' || echo "0")
  if [[ "$in_progress" -gt 1 ]]; then
    log_warn "Multiple phases in progress ($in_progress) - consider focusing on one"
    ((warnings++))
  fi

  # Check for required sections
  local required_sections=("Phase Overview" "Verification Gates")
  for section in "${required_sections[@]}"; do
    if ! grep -qi "## $section" "$roadmap_path"; then
      log_warn "Missing section: $section"
      ((warnings++))
    fi
  done

  echo ""

  if [[ $errors -eq 0 ]]; then
    if [[ $warnings -eq 0 ]]; then
      log_success "ROADMAP.md is valid"
    else
      log_success "ROADMAP.md is valid with $warnings warning(s)"
    fi
    if is_json_output; then
      echo "{\"valid\": true, \"errors\": 0, \"warnings\": $warnings}"
    fi
    exit 0
  else
    log_error "Found $errors error(s) and $warnings warning(s)"
    if is_json_output; then
      echo "{\"valid\": false, \"errors\": $errors, \"warnings\": $warnings}"
    fi
    exit 1
  fi
}

cmd_path() {
  get_roadmap_path
}

# =============================================================================
# Main
# =============================================================================

main() {
  parse_common_flags "$@"
  set -- "${REMAINING_ARGS[@]}"

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local command="$1"
  shift

  case "$command" in
    status|st)
      cmd_status
      ;;
    update)
      cmd_update "${1:-}" "${2:-}"
      ;;
    next)
      cmd_next
      ;;
    current)
      cmd_current
      ;;
    validate)
      cmd_validate
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
      echo "Run 'speckit roadmap --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
