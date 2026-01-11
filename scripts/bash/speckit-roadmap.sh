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
                        Phase: 0010, 0020, etc.
                        Status: not_started, in_progress, complete

    next                Get the next pending phase (not started)

    current             Get the current in-progress phase

    insert --after <phase> "<name>"
                        Insert a new phase after an existing one
                        Creates the next available number in the decade
                        (e.g., after 0020 creates 0021)

    defer <phase> [--force]
                        Move a phase to the Backlog section
                        Use --force to defer in-progress phases

    restore <phase> [--after <phase>] [--as <number>]
                        Restore a phase from Backlog
                        Smart restore tries original number first
                        Use --after to specify position
                        Use --as to specify exact number

    backlog <action>    Manage backlog items
                        add "<item>" - Add item to backlog
                        list - Show all backlog items
                        clear - Remove all backlog items

    validate            Check ROADMAP.md structure and consistency

    path                Show path to ROADMAP.md

OPTIONS:
    --json              Output in JSON format
    --non-interactive   Skip prompts (for insert command)
    -h, --help          Show this help

STATUS VALUES:
    not_started         ⬜ Phase not yet begun
    in_progress         🔄 Phase currently being worked on
    complete            ✅ Phase finished and verified

EXAMPLES:
    speckit roadmap status
    speckit roadmap update 0020 in_progress
    speckit roadmap insert --after 0020 "Hotfix Auth"
    speckit roadmap defer 0040
    speckit roadmap restore 0040 --after 0030
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

# Detect roadmap format (2.0 = 3-digit, 2.1 = 4-digit)
# Returns: "2.0", "2.1", or "mixed"
detect_phase_format() {
  local roadmap_path
  roadmap_path="${1:-$(get_roadmap_path)}"

  local has_3digit=false
  local has_4digit=false

  if grep -qE '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" 2>/dev/null; then
    # Check if any are exactly 3 digits (not 4)
    if grep -E '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" | grep -qvE '^\|\s*[0-9]{4}\s*\|'; then
      has_3digit=true
    fi
  fi

  if grep -qE '^\|\s*[0-9]{4}\s*\|' "$roadmap_path" 2>/dev/null; then
    has_4digit=true
  fi

  if $has_3digit && $has_4digit; then
    echo "mixed"
  elif $has_4digit; then
    echo "2.1"
  elif $has_3digit; then
    echo "2.0"
  else
    echo "unknown"
  fi
}

# Validate phase number format
# Returns: 0 if valid, 1 if invalid
validate_phase_number() {
  local phase="$1"
  local format="${2:-2.1}"

  case "$format" in
    2.0)
      [[ "$phase" =~ ^[0-9]{3}$ ]]
      ;;
    2.1)
      [[ "$phase" =~ ^[0-9]{4}$ ]]
      ;;
    *)
      return 1
      ;;
  esac
}

# Get the decade for a phase number (e.g., 0025 -> 002, 0123 -> 012)
get_phase_decade() {
  local phase="$1"
  echo "${phase:0:3}"
}

# Get next available phase number in decade
# Returns: next number or empty if decade full
get_next_in_decade() {
  local after_phase="$1"
  local roadmap_path
  roadmap_path="${2:-$(get_roadmap_path)}"

  local decade
  decade=$(get_phase_decade "$after_phase")

  # Start from after_phase + 1
  local base=$((10#$after_phase + 1))
  local max=$((10#${decade}9))

  while [[ $base -le $max ]]; do
    local candidate
    candidate=$(printf "%04d" "$base")
    if ! grep -qE "^\|\s*${candidate}\s*\|" "$roadmap_path" 2>/dev/null; then
      echo "$candidate"
      return 0
    fi
    ((base++))
  done

  # Decade full, try next decade
  local next_decade=$((10#$decade + 1))
  printf "%04d" $((next_decade * 10))
}

# Check if phase exists in roadmap
phase_exists() {
  local phase="$1"
  local roadmap_path
  roadmap_path="${2:-$(get_roadmap_path)}"

  grep -qE "^\|\s*${phase}\s*\|" "$roadmap_path" 2>/dev/null
}

# Check if phase is in progress
phase_is_in_progress() {
  local phase="$1"
  local roadmap_path
  roadmap_path="${2:-$(get_roadmap_path)}"

  grep -E "^\|\s*${phase}\s*\|" "$roadmap_path" 2>/dev/null | grep -q "🔄"
}

# Parse phase table from ROADMAP.md
# Returns: phase_num|phase_name|status|gate
parse_phase_table() {
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Extract table rows (lines starting with | followed by 3-4 digit number)
  grep -E '^\|[[:space:]]*[0-9]{3,4}[[:space:]]*\|' "$roadmap_path" 2>/dev/null | while IFS='|' read -r _ phase_num name status gate _; do
    phase_num=$(echo "$phase_num" | tr -d ' ')
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')  # Trim only, preserve internal spaces
    status=$(echo "$status" | tr -d ' ')
    gate=$(echo "$gate" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Clean up name (remove brackets if present)
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

  # Collect all phase data first
  local phase_nums=()
  local phase_names=()
  local phase_statuses=()
  local total=0
  local complete=0
  local in_progress=0

  while IFS='|' read -r phase_num name status gate; do
    phase_nums+=("$phase_num")
    phase_names+=("$name")
    phase_statuses+=("$status")
    ((total++)) || true
    case "$status" in
      complete) ((complete++)) || true ;;
      in_progress) ((in_progress++)) || true ;;
    esac
  done < <(parse_phase_table)

  if is_json_output; then
    local phases="[]"
    for i in "${!phase_nums[@]}"; do
      phases=$(echo "$phases" | jq --arg num "${phase_nums[$i]}" --arg name "${phase_names[$i]}" --arg status "${phase_statuses[$i]}" \
        '. + [{"phase": $num, "name": $name, "status": $status}]')
    done
    echo "$phases"
  else
    # Three-Line Rule: Summary first
    if [[ "$complete" -eq "$total" ]]; then
      echo -e "${GREEN}OK${RESET}: All $total phases complete"
    elif [[ $in_progress -gt 0 ]]; then
      echo -e "${BLUE}INFO${RESET}: $complete/$total phases complete ($in_progress in progress)"
    else
      echo -e "${BLUE}INFO${RESET}: $complete/$total phases complete"
    fi
    echo ""
    # Phase list (line 3+)
    for i in "${!phase_nums[@]}"; do
      case "${phase_statuses[$i]}" in
        complete) print_status ok "${phase_nums[$i]} - ${phase_names[$i]}" ;;
        in_progress) print_status progress "${phase_nums[$i]} - ${phase_names[$i]}" ;;
        *) print_status pending "${phase_nums[$i]} - ${phase_names[$i]}" ;;
      esac
    done
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

  # Normalize phase number to 4 digits for 2.1 format
  phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")

  # Convert status to emoji
  local emoji
  emoji=$(status_to_emoji "$new_status")

  # Check if phase exists (support both 3 and 4 digit)
  if ! grep -qE "^\|[[:space:]]*${phase}[[:space:]]*\|" "$roadmap_path"; then
    # Try 3-digit format for backwards compatibility (v2.0 -> v2.1)
    # Only works for "main" phases that are multiples of 10 (0010 -> 001, 0020 -> 002)
    local phase_num=$((10#${phase}))
    if [[ $((phase_num % 10)) -eq 0 ]]; then
      local phase3
      phase3=$(printf "%03d" "$((phase_num / 10))" 2>/dev/null || echo "")
      if grep -qE "^\|[[:space:]]*${phase3}[[:space:]]*\|" "$roadmap_path"; then
        phase="$phase3"
      else
        log_error "Phase not found: $phase"
        exit 1
      fi
    else
      log_error "Phase not found: $phase"
      exit 1
    fi
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

  # Check for at least one phase (support both 3-digit and 4-digit ABBC format)
  local phase_count
  phase_count=$(grep -cE '^\|\s*[0-9]{3,4}\s*\|' "$roadmap_path" 2>/dev/null) || phase_count=0
  if [[ "$phase_count" -eq 0 ]]; then
    log_error "No phases found in table"
    ((errors++))
  else
    print_status ok "Found $phase_count phase(s)"
  fi

  # Check for duplicate phase numbers (support both 3-digit and 4-digit ABBC format)
  # Pattern requires number followed by pipe to avoid matching dates like "2026-01-10"
  local duplicates
  duplicates=$(grep -oE '^\|\s*[0-9]{3,4}\s*\|' "$roadmap_path" | sed 's/[| ]//g' | sort | uniq -d | wc -l | tr -d ' ')
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
  in_progress=$(parse_phase_table | grep -c '|in_progress|') || in_progress=0
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

# Insert a new phase after an existing one
cmd_insert() {
  local after_phase=""
  local phase_name=""
  local non_interactive=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --after)
        after_phase="$2"
        shift 2
        ;;
      --non-interactive)
        non_interactive=true
        shift
        ;;
      *)
        if [[ -z "$phase_name" ]]; then
          phase_name="$1"
        fi
        shift
        ;;
    esac
  done

  if [[ -z "$after_phase" ]] || [[ -z "$phase_name" ]]; then
    log_error "Missing required arguments"
    echo "Usage: speckit roadmap insert --after <phase> \"<name>\""
    echo "Example: speckit roadmap insert --after 0020 \"Hotfix Auth Bug\""
    exit 1
  fi

  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Normalize phase number to 4 digits
  after_phase=$(printf "%04d" "$((10#${after_phase}))" 2>/dev/null || echo "$after_phase")

  # Verify target phase exists
  if ! phase_exists "$after_phase" "$roadmap_path"; then
    log_error "Phase $after_phase not found in roadmap"
    echo "Available phases:"
    parse_phase_table | while IFS='|' read -r num name _ _; do
      echo "  $num - $name"
    done
    exit 1
  fi

  # Calculate new phase number
  local new_phase
  new_phase=$(get_next_in_decade "$after_phase" "$roadmap_path")

  if [[ -z "$new_phase" ]]; then
    log_error "Cannot insert phase: decade is full"
    echo "Consider deferring some phases: speckit roadmap defer <phase>"
    exit 1
  fi

  # Collect phase content
  local goal=""
  local scope=""
  local gate=""

  if $non_interactive; then
    goal="[TODO: Define goal]"
    gate="[TODO: Define verification gate]"
  else
    echo "Creating phase $new_phase - $phase_name"
    echo ""

    read -rp "Phase Goal (required): " goal
    if [[ -z "$goal" ]]; then
      log_error "Goal is required"
      exit 1
    fi

    echo "Enter scope items (one per line, blank line to finish):"
    local scope_items=()
    while read -rp "- " item && [[ -n "$item" ]]; do
      scope_items+=("$item")
    done

    if [[ ${#scope_items[@]} -gt 0 ]]; then
      scope=$(printf '- %s\n' "${scope_items[@]}")
    else
      scope="- [TODO: Define scope]"
    fi

    read -rp "Verification Gate (required): " gate
    if [[ -z "$gate" ]]; then
      log_error "Verification gate is required"
      exit 1
    fi
  fi

  # Create temp file for atomic update
  local temp_file
  temp_file=$(mktemp)

  # Insert table row after target phase
  awk -v after="$after_phase" -v new="$new_phase" -v name="$phase_name" -v gate="$gate" '
    /^\|[[:space:]]*'"$after_phase"'[[:space:]]*\|/ {
      print
      printf "| %s | %s | ⬜ Not Started | %s |\n", new, name, gate
      next
    }
    { print }
  ' "$roadmap_path" > "$temp_file"

  # Insert phase section after target phase section
  local section_content
  section_content=$(cat << EOF

---

### ${new_phase} - ${phase_name}

**Goal**: ${goal}

**Scope**:
${scope}

**Deliverables**:
- [TODO: Define deliverables]

**Verification Gate**:
- ${gate}
EOF
)

  # Find the end of the target phase section and insert new section
  awk -v after="$after_phase" -v content="$section_content" '
    BEGIN { found = 0; inserted = 0 }
    /^###[[:space:]]*'"$after_phase"'[[:space:]]*-/ { found = 1 }
    found && /^---$/ && !inserted {
      print content
      inserted = 1
    }
    { print }
  ' "$temp_file" > "${temp_file}.2"

  mv "${temp_file}.2" "$roadmap_path"
  rm -f "$temp_file"

  log_success "Created phase $new_phase - $phase_name"

  if is_json_output; then
    echo "{\"phase\": \"$new_phase\", \"name\": \"$phase_name\", \"after\": \"$after_phase\"}"
  fi
}

# Defer a phase to backlog
cmd_defer() {
  local phase=""
  local force=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force|-f)
        force=true
        shift
        ;;
      *)
        phase="$1"
        shift
        ;;
    esac
  done

  if [[ -z "$phase" ]]; then
    log_error "Phase number required"
    echo "Usage: speckit roadmap defer <phase> [--force]"
    exit 1
  fi

  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Normalize phase number
  phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")

  # Verify phase exists
  if ! phase_exists "$phase" "$roadmap_path"; then
    log_error "Phase $phase not found in roadmap"
    exit 1
  fi

  # Check if in progress
  if phase_is_in_progress "$phase" "$roadmap_path" && ! $force; then
    log_error "Phase $phase is in progress"
    echo "Use --force to defer an in-progress phase"
    exit 1
  fi

  # Get phase info
  local phase_name=""
  local phase_gate=""
  while IFS='|' read -r num name status gate; do
    if [[ "$num" == "$phase" ]]; then
      phase_name="$name"
      phase_gate="$gate"
      break
    fi
  done < <(parse_phase_table)

  # Extract phase section content
  local section_start
  local section_end
  section_start=$(grep -n "^###[[:space:]]*${phase}[[:space:]]*-" "$roadmap_path" | head -1 | cut -d: -f1)

  if [[ -z "$section_start" ]]; then
    log_warn "Phase section not found, only removing from table"
  fi

  # Create temp file
  local temp_file
  temp_file=$(mktemp)

  # Remove from table
  grep -vE "^\|[[:space:]]*${phase}[[:space:]]*\|" "$roadmap_path" > "$temp_file"

  # Check if Backlog section exists
  if ! grep -q "^## Backlog" "$temp_file"; then
    # Add Backlog section at the end
    cat >> "$temp_file" << 'EOF'

---

## Backlog

Deferred phases waiting for future prioritization.

| Phase | Name | Deferred Date | Reason |
|-------|------|---------------|--------|
EOF
  fi

  # Add to backlog table
  local today
  today=$(date +%Y-%m-%d)
  sed -i.bak "/^|[[:space:]]*Phase[[:space:]]*|[[:space:]]*Name[[:space:]]*|[[:space:]]*Deferred/a\\
| ${phase} | ${phase_name} | ${today} | Deferred by user |
" "$temp_file" 2>/dev/null || {
    # macOS sed syntax
    sed -i '' "/^|[[:space:]]*Phase[[:space:]]*|[[:space:]]*Name[[:space:]]*|[[:space:]]*Deferred/a\\
| ${phase} | ${phase_name} | ${today} | Deferred by user |
" "$temp_file"
  }
  rm -f "${temp_file}.bak"

  # Move section to backlog if it exists
  if [[ -n "$section_start" ]]; then
    # Extract section content
    local section_content
    section_content=$(awk -v start="$section_start" '
      NR >= start {
        if (NR > start && /^###[[:space:]]*[0-9]/ || /^## /) exit
        print
      }
    ' "$roadmap_path")

    # Remove section from original location
    awk -v start="$section_start" '
      NR < start { print; next }
      NR == start { in_section = 1 }
      in_section && (NR > start && /^###[[:space:]]*[0-9]/ || /^## /) {
        in_section = 0
        print
        next
      }
      !in_section { print }
    ' "$temp_file" > "${temp_file}.2"
    mv "${temp_file}.2" "$temp_file"

    # Append section to backlog
    echo "" >> "$temp_file"
    echo "$section_content" >> "$temp_file"
  fi

  mv "$temp_file" "$roadmap_path"

  log_success "Deferred phase $phase - $phase_name to Backlog"

  if is_json_output; then
    echo "{\"phase\": \"$phase\", \"name\": \"$phase_name\", \"deferred\": true}"
  fi
}

# Restore a phase from backlog
cmd_restore() {
  local phase=""
  local after_phase=""
  local as_number=""
  local force=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --after)
        after_phase="$2"
        shift 2
        ;;
      --as)
        as_number="$2"
        shift 2
        ;;
      --force|-f)
        force=true
        shift
        ;;
      *)
        phase="$1"
        shift
        ;;
    esac
  done

  if [[ -z "$phase" ]]; then
    log_error "Phase number required"
    echo "Usage: speckit roadmap restore <phase> [--after <phase>] [--as <number>]"
    exit 1
  fi

  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Normalize phase number
  phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")

  # Check if phase is in backlog
  if ! grep -qE "^\|[[:space:]]*${phase}[[:space:]]*\|" "$roadmap_path" | grep -q "Deferred"; then
    # More flexible check - look in backlog section
    local in_backlog=false
    awk '/^## Backlog/,/^## [^B]/ { print }' "$roadmap_path" | grep -qE "^\|[[:space:]]*${phase}[[:space:]]*\|" && in_backlog=true

    if ! $in_backlog; then
      log_error "Phase $phase not found in Backlog"
      echo "Use 'speckit roadmap status' to see available phases"
      exit 1
    fi
  fi

  # Determine target phase number
  local target_number=""

  if [[ -n "$as_number" ]]; then
    target_number=$(printf "%04d" "$((10#${as_number}))" 2>/dev/null || echo "$as_number")
    if phase_exists "$target_number" "$roadmap_path"; then
      log_error "Phase $target_number already exists"
      exit 1
    fi
  elif [[ -n "$after_phase" ]]; then
    after_phase=$(printf "%04d" "$((10#${after_phase}))" 2>/dev/null || echo "$after_phase")
    target_number=$(get_next_in_decade "$after_phase" "$roadmap_path")
  else
    # Smart restore: try original number first
    if ! phase_exists "$phase" "$roadmap_path"; then
      target_number="$phase"
    else
      target_number=$(get_next_in_decade "$phase" "$roadmap_path")
    fi
  fi

  if [[ -z "$target_number" ]]; then
    log_error "Cannot determine target phase number"
    echo "Use --after or --as to specify position"
    exit 1
  fi

  # Get phase info from backlog
  local phase_name=""
  phase_name=$(awk '/^## Backlog/,/^## [^B]/ {
    if (/^\|[[:space:]]*'"$phase"'[[:space:]]*\|/) {
      split($0, a, "|")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", a[3])
      print a[3]
      exit
    }
  }' "$roadmap_path")

  if [[ -z "$phase_name" ]]; then
    phase_name="Restored Phase"
  fi

  # Extract section content from backlog
  local section_content=""
  section_content=$(awk -v phase="$phase" '
    /^## Backlog/,0 {
      if (/^###[[:space:]]*'"$phase"'[[:space:]]*-/) {
        in_section = 1
      }
      if (in_section) {
        if (/^###[[:space:]]*[0-9]/ && !/^###[[:space:]]*'"$phase"'/) exit
        if (/^## [^B]/) exit
        print
      }
    }
  ' "$roadmap_path")

  # Create temp file
  local temp_file
  temp_file=$(mktemp)

  # Remove from backlog table
  awk '/^## Backlog/,/^## [^B]/ {
    if (/^\|[[:space:]]*'"$phase"'[[:space:]]*\|/) next
  }
  { print }' "$roadmap_path" > "$temp_file"

  # Remove section from backlog
  awk -v phase="$phase" '
    BEGIN { in_section = 0; in_backlog = 0 }
    /^## Backlog/ { in_backlog = 1 }
    /^## [^B]/ { in_backlog = 0 }
    in_backlog && /^###[[:space:]]*'"$phase"'[[:space:]]*-/ { in_section = 1; next }
    in_backlog && in_section && /^###[[:space:]]*[0-9]/ { in_section = 0 }
    !in_section { print }
  ' "$temp_file" > "${temp_file}.2"
  mv "${temp_file}.2" "$temp_file"

  # Find position to insert in table (after last phase before target)
  local insert_after=""
  while IFS='|' read -r num name status gate; do
    if [[ "$((10#$num))" -lt "$((10#$target_number))" ]]; then
      insert_after="$num"
    fi
  done < <(parse_phase_table)

  # Insert into table
  if [[ -n "$insert_after" ]]; then
    awk -v after="$insert_after" -v new="$target_number" -v name="$phase_name" '
      /^\|[[:space:]]*'"$insert_after"'[[:space:]]*\|/ {
        print
        printf "| %s | %s | ⬜ Not Started | Restored from backlog |\n", new, name
        next
      }
      { print }
    ' "$temp_file" > "${temp_file}.2"
  else
    # Insert at beginning of table
    awk -v new="$target_number" -v name="$phase_name" '
      /^\|[[:space:]]*Phase[[:space:]]*\|/ {
        print
        getline  # Skip header separator
        print
        printf "| %s | %s | ⬜ Not Started | Restored from backlog |\n", new, name
        next
      }
      { print }
    ' "$temp_file" > "${temp_file}.2"
  fi
  mv "${temp_file}.2" "$temp_file"

  # Update section header with new number and insert
  if [[ -n "$section_content" ]]; then
    local updated_section
    updated_section=$(echo "$section_content" | sed "s/^###[[:space:]]*${phase}/### ${target_number}/")

    # Find insertion point for section
    local section_insert_after=""
    while IFS='|' read -r num name status gate; do
      if [[ "$((10#$num))" -lt "$((10#$target_number))" ]]; then
        section_insert_after="$num"
      fi
    done < <(parse_phase_table)

    if [[ -n "$section_insert_after" ]]; then
      awk -v after="$section_insert_after" -v content="$updated_section" '
        /^###[[:space:]]*'"$section_insert_after"'[[:space:]]*-/ { found = 1 }
        found && /^---$/ {
          print content
          print ""
          found = 0
        }
        { print }
      ' "$temp_file" > "${temp_file}.2"
      mv "${temp_file}.2" "$temp_file"
    fi
  fi

  mv "$temp_file" "$roadmap_path"

  log_success "Restored phase $phase as $target_number - $phase_name"

  if is_json_output; then
    echo "{\"original\": \"$phase\", \"restored_as\": \"$target_number\", \"name\": \"$phase_name\"}"
  fi
}

# =============================================================================
# Backlog Commands
# =============================================================================

# Helper: Escape special characters for sed replacement
escape_for_sed() {
  printf '%s\n' "$1" | sed 's/[&/\]/\\&/g'
}

# Helper: Get today's date in YYYY-MM-DD format
today_date() {
  date +%Y-%m-%d
}

# Backlog subcommand dispatcher
cmd_backlog() {
  if [[ $# -eq 0 ]]; then
    cmd_backlog_help
    exit 0
  fi

  local action="$1"
  shift

  case "$action" in
    add)
      cmd_backlog_add "$@"
      ;;
    list|ls)
      cmd_backlog_list
      ;;
    clear)
      cmd_backlog_clear
      ;;
    help|--help|-h)
      cmd_backlog_help
      exit 0
      ;;
    *)
      log_error "Unknown backlog action: $action"
      echo "Run 'speckit roadmap backlog help' for usage"
      exit 1
      ;;
  esac
}

cmd_backlog_help() {
  cat << 'EOF'
speckit roadmap backlog - Manage ROADMAP.md backlog items

USAGE:
    speckit roadmap backlog <action> [options]

ACTIONS:
    add "<item>"        Add an item to the backlog
    list, ls            List all backlog items
    clear               Remove all backlog items (use after triage)

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit roadmap backlog add "Add dark mode support"
    speckit roadmap backlog add "Improve error messages"
    speckit roadmap backlog list
    speckit roadmap backlog clear
EOF
}

cmd_backlog_add() {
  if [[ $# -eq 0 ]]; then
    log_error "Item text required"
    echo "Usage: speckit roadmap backlog add \"<item>\""
    exit 1
  fi

  local item="$*"

  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  local today
  today=$(today_date)

  # Create temp file for atomic update
  local temp_file
  temp_file=$(mktemp)
  cp "$roadmap_path" "$temp_file"

  # Check if Backlog section exists
  if ! grep -q "^## Backlog" "$temp_file"; then
    # Add Backlog section at the end
    cat >> "$temp_file" << 'EOF'

---

## Backlog

Items captured for future triage. Run `/speckit.backlog` to assign to phases.

| Item | Description | Priority | Notes |
|------|-------------|----------|-------|
EOF
  fi

  # Escape the item for sed
  local escaped_item
  escaped_item=$(escape_for_sed "$item")

  # Append item to backlog table (supports both table formats)
  # Format 1: | Item | Description | Priority | Notes |
  # Format 2: | Added | Item | Priority | Notes |
  awk -v date="$today" -v item="$escaped_item" '
    # Match the table header (either format)
    /^\|[[:space:]]*(Item|Added)[[:space:]]*\|/ && /Backlog/ == 0 {
      if (in_backlog) {
        in_backlog_table = 1
        print
        getline  # Print separator row
        print
        # Add new row based on format
        if (/Added/) {
          printf "| %s | %s | - | |\n", date, item
        } else {
          printf "| %s | Added %s | - | |\n", item, date
        }
        next
      }
    }
    /^##[[:space:]]*Backlog/ { in_backlog = 1 }
    /^##[[:space:]]/ && !/Backlog/ { in_backlog = 0 }

    # Handle table right after detecting backlog section
    in_backlog && /^\|[[:space:]]*(Item|Added)[[:space:]]*\|/ {
      in_backlog_table = 1
      print
      getline  # Print separator row
      print
      # Add new row - detect format from header
      if ($0 ~ /Added/) {
        printf "| %s | %s | - | |\n", date, item
      } else {
        printf "| %s | Added %s | - | |\n", item, date
      }
      next
    }
    { print }
  ' "$temp_file" > "${temp_file}.2"

  mv "${temp_file}.2" "$roadmap_path"
  rm -f "$temp_file"

  log_success "Added to backlog: $item"

  if is_json_output; then
    # Escape for JSON
    local json_item
    json_item=$(printf '%s' "$item" | jq -R .)
    echo "{\"added\": true, \"item\": $json_item, \"date\": \"$today\"}"
  fi
}

cmd_backlog_list() {
  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Check if Backlog section exists
  if ! grep -q "^## Backlog" "$roadmap_path"; then
    if is_json_output; then
      echo '{"items": [], "count": 0}'
    else
      log_info "No backlog section found"
    fi
    exit 0
  fi

  # Extract items from backlog table (supports both table formats)
  local items=()
  local in_backlog=false
  local header_passed=false

  while IFS= read -r line; do
    # Start capturing after Backlog header
    if [[ "$line" =~ ^##[[:space:]]*Backlog ]]; then
      in_backlog=true
      continue
    fi

    # Stop at next section
    if $in_backlog && [[ "$line" =~ ^##[[:space:]] ]]; then
      break
    fi

    # Skip until we hit the table header (either format)
    if $in_backlog && [[ "$line" =~ ^\|[[:space:]]*(Item|Added)[[:space:]]*\| ]]; then
      header_passed=true
      continue
    fi

    # Skip separator row
    if $header_passed && [[ "$line" =~ ^\|[-]+\| ]]; then
      continue
    fi

    # Capture table rows
    if $header_passed && [[ "$line" =~ ^\| ]]; then
      items+=("$line")
    fi
  done < "$roadmap_path"

  if is_json_output; then
    local json_items="[]"
    for item_line in "${items[@]}"; do
      # Parse: | item | description | priority | notes |
      local item description priority notes
      item=$(echo "$item_line" | cut -d'|' -f2 | xargs)
      description=$(echo "$item_line" | cut -d'|' -f3 | xargs)
      priority=$(echo "$item_line" | cut -d'|' -f4 | xargs)
      notes=$(echo "$item_line" | cut -d'|' -f5 | xargs)

      json_items=$(echo "$json_items" | jq --arg i "$item" --arg d "$description" --arg p "$priority" --arg n "$notes" \
        '. + [{"item": $i, "description": $d, "priority": $p, "notes": $n}]')
    done
    echo "$json_items" | jq "{items: ., count: (. | length)}"
  else
    # Three-Line Rule: Summary first
    if [[ ${#items[@]} -eq 0 ]]; then
      echo -e "${GREEN}OK${RESET}: Backlog is empty"
    else
      echo -e "${BLUE}INFO${RESET}: ${#items[@]} backlog item(s)"
      echo ""
      # Item list (line 3+)
      for item_line in "${items[@]}"; do
        local item
        item=$(echo "$item_line" | cut -d'|' -f2 | xargs)
        local priority
        priority=$(echo "$item_line" | cut -d'|' -f4 | xargs)
        if [[ "$priority" != "-" && -n "$priority" ]]; then
          echo "  - [$priority] $item"
        else
          echo "  - $item"
        fi
      done
    fi
  fi
}

cmd_backlog_clear() {
  ensure_roadmap
  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  # Check if Backlog section exists
  if ! grep -q "^## Backlog" "$roadmap_path"; then
    log_info "No backlog section to clear"
    if is_json_output; then
      echo '{"cleared": false, "reason": "no_backlog_section"}'
    fi
    exit 0
  fi

  # Count items before clearing
  local count
  count=$(grep -cE '^\|[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}' "$roadmap_path" 2>/dev/null || echo "0")

  # Create temp file
  local temp_file
  temp_file=$(mktemp)

  # Remove all data rows from backlog table, keep header
  awk '
    /^##[[:space:]]*Backlog/ { in_backlog = 1 }
    /^##[[:space:]]/ && !/^##[[:space:]]*Backlog/ { in_backlog = 0 }

    # In backlog section
    in_backlog {
      # Keep section header, description, and table header
      if (/^##/ || /^Items captured/ || /^\|[[:space:]]*Added/ || /^\|[-]+/) {
        print
        next
      }
      # Skip data rows (date pattern)
      if (/^\|[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}/) {
        next
      }
      # Keep empty lines and other content
      print
      next
    }

    # Outside backlog
    { print }
  ' "$roadmap_path" > "$temp_file"

  mv "$temp_file" "$roadmap_path"

  log_success "Cleared $count item(s) from backlog"

  if is_json_output; then
    echo "{\"cleared\": true, \"count\": $count}"
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
    insert)
      cmd_insert "$@"
      ;;
    defer)
      cmd_defer "$@"
      ;;
    restore)
      cmd_restore "$@"
      ;;
    backlog)
      cmd_backlog "$@"
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
