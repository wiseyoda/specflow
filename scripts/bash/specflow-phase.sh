#!/usr/bin/env bash
#
# specflow-phase.sh - Phase detail operations
#
# Usage:
#   specflow phase show <phase>       Show phase details
#   specflow phase list [--active]    List phases
#   specflow phase archive <phase>    Archive phase to HISTORY.md
#   specflow phase create <phase> <n> Create new phase file
#   specflow phase migrate            Migrate ROADMAP.md to modular format
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

readonly PHASES_DIR=".specify/phases"
readonly HISTORY_DIR=".specify/history"
readonly HISTORY_FILE="${HISTORY_DIR}/HISTORY.md"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
specflow phase - Phase detail operations

USAGE:
    specflow phase <command> [options]

COMMANDS:
    show <phase>        Show phase details from .specify/phases/ or HISTORY.md
                        Example: specflow phase show 0042

    list                List all phases with status
        --active        Only active/pending phases
        --complete      Only completed phases

    archive <phase>     Move phase details to HISTORY.md
                        Collapses phase in ROADMAP.md to 1-line summary

    create <phase> <name>
                        Create new phase detail file
                        Example: specflow phase create 0050 "new-feature"

    migrate             Migrate ROADMAP.md to modular format
                        Extracts phase sections to .specify/phases/
                        Archives completed phases to HISTORY.md
        --dry-run       Show what would happen without executing
        --collapse      Also collapse ROADMAP.md to lightweight index

    path [phase]        Show path to phase file (or phases directory)

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    specflow phase show 0042
    specflow phase list --active
    specflow phase archive 0041
    specflow phase create 0050 "user-auth"
    specflow phase migrate --dry-run
    specflow phase migrate --collapse
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get phases directory
get_phases_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/${PHASES_DIR}"
}

# Get history directory
get_history_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/${HISTORY_DIR}"
}

# Get history file path
get_history_file() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/${HISTORY_FILE}"
}

# Ensure phases directory exists
ensure_phases_dir() {
  local phases_dir
  phases_dir="$(get_phases_dir)"
  mkdir -p "$phases_dir"
}

# Ensure history directory exists
ensure_history_dir() {
  local history_dir
  history_dir="$(get_history_dir)"
  mkdir -p "$history_dir"
}

# Find phase file by number with fuzzy matching
# Tries exact match first, then fuzzy (014 → 0140)
# Returns the full path or empty string
find_phase_file() {
  local phase="$1"
  local phases_dir
  phases_dir="$(get_phases_dir)"

  # Strip non-numeric characters and convert to number
  local input
  input=$(echo "$phase" | tr -cd '0-9')
  local num
  num=$((10#${input})) 2>/dev/null || return 1

  # Try 4-digit format first (exact match)
  local phase4
  phase4=$(printf "%04d" "$num")

  local found
  found=$(find "$phases_dir" -maxdepth 1 -name "${phase4}-*.md" 2>/dev/null | head -1)

  if [[ -n "$found" ]]; then
    echo "$found"
    return 0
  fi

  # Fuzzy match: try appending 0 (e.g., "014" → "0140")
  if [[ $num -lt 1000 ]]; then
    local phase_expanded
    phase_expanded=$(printf "%04d" $((num * 10)))
    found=$(find "$phases_dir" -maxdepth 1 -name "${phase_expanded}-*.md" 2>/dev/null | head -1)
    if [[ -n "$found" ]]; then
      log_debug "Fuzzy match: $phase → $phase_expanded"
      echo "$found"
      return 0
    fi
  fi

  return 1
}

# Get phase info from ROADMAP.md table with fuzzy matching
# Tries exact match first, then fuzzy (014 → 0140)
# Returns: phase_num|name|status
get_phase_from_roadmap() {
  local phase="$1"
  local roadmap_path
  roadmap_path="$(get_repo_root)/ROADMAP.md"

  if [[ ! -f "$roadmap_path" ]]; then
    return 1
  fi

  # Use fuzzy matching to find the phase
  local matched_phase
  matched_phase=$(normalize_phase_fuzzy "$phase" "$roadmap_path")

  if [[ -z "$matched_phase" ]]; then
    return 1
  fi

  grep -E "^\|[[:space:]]*${matched_phase}[[:space:]]*\|" "$roadmap_path" 2>/dev/null | head -1 | while IFS='|' read -r _ num name status _; do
    num=$(echo "$num" | tr -d ' ')
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    status=$(echo "$status" | tr -d ' ')
    echo "${num}|${name}|${status}"
  done
}

# Check if phase is in history with fuzzy matching
phase_in_history() {
  local phase="$1"
  local history_file
  history_file="$(get_history_file)"

  if [[ ! -f "$history_file" ]]; then
    return 1
  fi

  # Strip non-numeric and convert to number
  local input
  input=$(echo "$phase" | tr -cd '0-9')
  local num
  num=$((10#${input})) 2>/dev/null || return 1

  # Try 4-digit format first
  local phase4
  phase4=$(printf "%04d" "$num")

  if grep -qE "^##[[:space:]]*${phase4}[[:space:]]*-" "$history_file" 2>/dev/null; then
    return 0
  fi

  # Fuzzy match: try appending 0
  if [[ $num -lt 1000 ]]; then
    local phase_expanded
    phase_expanded=$(printf "%04d" $((num * 10)))
    if grep -qE "^##[[:space:]]*${phase_expanded}[[:space:]]*-" "$history_file" 2>/dev/null; then
      return 0
    fi
  fi

  return 1
}

# Extract phase section from ROADMAP.md with fuzzy matching
extract_phase_section() {
  local phase="$1"
  local roadmap_path
  roadmap_path="$(get_repo_root)/ROADMAP.md"

  # Use fuzzy matching to find the phase
  local matched_phase
  matched_phase=$(normalize_phase_fuzzy "$phase" "$roadmap_path")

  if [[ -z "$matched_phase" ]]; then
    # Fall back to simple normalization for inline section search
    local input
    input=$(echo "$phase" | tr -cd '0-9')
    local num
    num=$((10#${input})) 2>/dev/null || return 1
    matched_phase=$(printf "%04d" "$num")
  fi

  awk -v phase="$matched_phase" '
    /^###[[:space:]]*'"$matched_phase"'[[:space:]]*-/ { found = 1 }
    found {
      if (/^###[[:space:]]*[0-9]/ && !/^###[[:space:]]*'"$matched_phase"'/) exit
      if (/^##[[:space:]]/ && !/^###/) exit
      if (/^---$/ && NR > start_line + 1) exit
      print
    }
    found && NR == 1 { start_line = NR }
  ' "$roadmap_path"
}

# Extract phase section from HISTORY.md with fuzzy matching
extract_history_section() {
  local phase="$1"
  local history_file
  history_file="$(get_history_file)"

  if [[ ! -f "$history_file" ]]; then
    return 1
  fi

  # Strip non-numeric and convert to number
  local input
  input=$(echo "$phase" | tr -cd '0-9')
  local num
  num=$((10#${input})) 2>/dev/null || return 1

  # Try 4-digit format first
  local matched_phase
  matched_phase=$(printf "%04d" "$num")

  # Check if it exists, if not try fuzzy
  if ! grep -qE "^##[[:space:]]*${matched_phase}[[:space:]]*-" "$history_file" 2>/dev/null; then
    if [[ $num -lt 1000 ]]; then
      local phase_expanded
      phase_expanded=$(printf "%04d" $((num * 10)))
      if grep -qE "^##[[:space:]]*${phase_expanded}[[:space:]]*-" "$history_file" 2>/dev/null; then
        matched_phase="$phase_expanded"
      fi
    fi
  fi

  awk -v phase="$matched_phase" '
    /^##[[:space:]]*'"$matched_phase"'[[:space:]]*-/ { found = 1 }
    found {
      if (/^##[[:space:]]*[0-9]/ && !/^##[[:space:]]*'"$matched_phase"'/) exit
      print
    }
  ' "$history_file"
}

# Collapse ROADMAP.md to lightweight index format
# Preserves header, table, and footer; removes inline phase sections
collapse_roadmap() {
  local roadmap_path="$1"

  # Create backup
  cp "$roadmap_path" "${roadmap_path}.bak"

  # Find the line after the legend (marks end of table section)
  # Pattern: **Legend**: ... followed by --- is the table end
  local legend_end_line
  legend_end_line=$(grep -n "^\*\*Legend\*\*:" "$roadmap_path" | head -1 | cut -d: -f1)

  if [[ -z "$legend_end_line" ]]; then
    log_warn "Could not find Legend line in ROADMAP.md"
    rm "${roadmap_path}.bak"
    return 1
  fi

  # Find the next --- after legend
  local table_end_line
  table_end_line=$(tail -n +"$legend_end_line" "$roadmap_path" | grep -n "^---$" | head -1 | cut -d: -f1)
  table_end_line=$((legend_end_line + table_end_line - 1))

  # Extract header section (up to and including the --- after legend)
  head -n "$table_end_line" "$roadmap_path" > "${roadmap_path}.new"

  # Add modular format notice
  cat >> "${roadmap_path}.new" << 'EOF'

## Phase Details

Phase details are stored in modular files:

| Location | Content |
|----------|---------|
| `.specify/phases/*.md` | Active/pending phase details |
| `.specify/history/HISTORY.md` | Archived completed phases |

To view a specific phase:
```bash
specflow phase show 0010
```

To list all phases:
```bash
specflow phase list
specflow phase list --active
specflow phase list --complete
```

---

## Verification Gates Summary
EOF

  # Extract any existing user verification gates table
  local gates_section
  gates_section=$(awk '/^## Verification Gates Summary/,/^---$/' "$roadmap_path" | tail -n +2 | sed '$d')

  if [[ -n "$gates_section" ]] && [[ $(echo "$gates_section" | grep -c '|') -gt 2 ]]; then
    echo "" >> "${roadmap_path}.new"
    echo "$gates_section" >> "${roadmap_path}.new"
  else
    # Generate from table
    echo "" >> "${roadmap_path}.new"
    echo "| Gate | Phase | What User Verifies |" >> "${roadmap_path}.new"
    echo "|------|-------|-------------------|" >> "${roadmap_path}.new"
    grep -E "^\|.*USER GATE" "$roadmap_path" | while IFS='|' read -r _ num name _ gate _; do
      num=$(echo "$num" | tr -d ' ')
      gate=$(echo "$gate" | sed 's/.*USER GATE[^:]*:[[:space:]]*//')
      echo "| USER GATE | $num | $gate |" >> "${roadmap_path}.new"
    done
  fi

  # Add footer
  cat >> "${roadmap_path}.new" << 'EOF'

---

## Phase Sizing Guidelines

Each phase is designed to be:
- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:
1. Cut scope to MVP for that phase
2. Document deferred items in `specs/[phase]/checklists/deferred.md`
3. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase
```
/specflow.orchestrate
```
Or manually:
```
/specflow.specify "Phase NNNN - [Phase Name]"
```

### After Completing a Phase
1. Update status in table above: ⬜ → ✅
2. Archive phase: `specflow phase archive NNNN`
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases
Use SpecFlow commands:
```bash
specflow roadmap insert --after 0020 "New Phase Name"
specflow phase create 0025 "new-phase"
```
EOF

  # Replace original
  mv "${roadmap_path}.new" "$roadmap_path"
  rm -f "${roadmap_path}.bak"
}

# =============================================================================
# Commands
# =============================================================================

cmd_show() {
  local phase="$1"

  if [[ -z "$phase" ]]; then
    log_error "Phase number required"
    echo "Usage: specflow phase show <phase>"
    exit 1
  fi

  # Normalize to 4 digits
  phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")

  # Try phase file first
  local phase_file
  phase_file=$(find_phase_file "$phase")

  if [[ -n "$phase_file" ]]; then
    if is_json_output; then
      # Parse frontmatter and content
      local name status created
      name=$(grep -E "^name:" "$phase_file" | sed 's/name:[[:space:]]*//')
      status=$(grep -E "^status:" "$phase_file" | sed 's/status:[[:space:]]*//')
      created=$(grep -E "^created:" "$phase_file" | sed 's/created:[[:space:]]*//')

      jq -n \
        --arg phase "$phase" \
        --arg name "$name" \
        --arg status "$status" \
        --arg created "$created" \
        --arg file "$phase_file" \
        --arg source "phases" \
        '{phase: $phase, name: $name, status: $status, created: $created, file: $file, source: $source}'
    else
      cat "$phase_file"
    fi
    return 0
  fi

  # Try history
  if phase_in_history "$phase"; then
    if is_json_output; then
      local content
      content=$(extract_history_section "$phase")
      local name
      name=$(echo "$content" | head -1 | sed 's/^##[[:space:]]*[0-9]*[[:space:]]*-[[:space:]]*//')

      jq -n \
        --arg phase "$phase" \
        --arg name "$name" \
        --arg status "complete" \
        --arg source "history" \
        '{phase: $phase, name: $name, status: "complete", source: $source}'
    else
      extract_history_section "$phase"
    fi
    return 0
  fi

  # Try inline ROADMAP section
  local section
  section=$(extract_phase_section "$phase")

  if [[ -n "$section" ]]; then
    if is_json_output; then
      local info
      info=$(get_phase_from_roadmap "$phase")
      local name status
      name=$(echo "$info" | cut -d'|' -f2)
      status=$(echo "$info" | cut -d'|' -f3)

      jq -n \
        --arg phase "$phase" \
        --arg name "$name" \
        --arg status "$status" \
        --arg source "roadmap" \
        '{phase: $phase, name: $name, status: $status, source: $source}'
    else
      echo "$section"
    fi
    return 0
  fi

  log_error "Phase $phase not found"
  echo "Check: specflow phase list"
  exit 1
}

cmd_list() {
  local filter="all"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --active)
        filter="active"
        shift
        ;;
      --complete|--completed)
        filter="complete"
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

  local phases_dir
  phases_dir="$(get_phases_dir)"

  # Collect phases
  local phases=()
  local names=()
  local statuses=()
  local sources=()

  # Parse from ROADMAP table
  while IFS='|' read -r _ num name status _; do
    num=$(echo "$num" | tr -d ' ')
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Determine status
    local status_str="not_started"
    if [[ "$status" == *"✅"* ]]; then
      status_str="complete"
    elif [[ "$status" == *"🔄"* ]]; then
      status_str="in_progress"
    fi

    # Apply filter
    case "$filter" in
      active)
        [[ "$status_str" == "complete" ]] && continue
        ;;
      complete)
        [[ "$status_str" != "complete" ]] && continue
        ;;
    esac

    # Check source
    local source="roadmap"
    local phase_files=""
    if [[ -d "$phases_dir" ]]; then
      phase_files=$(find "$phases_dir" -maxdepth 1 -name "${num}-*.md" 2>/dev/null | head -1) || true
    fi
    if [[ -n "$phase_files" ]]; then
      source="phases"
    fi

    phases+=("$num")
    names+=("$name")
    statuses+=("$status_str")
    sources+=("$source")
  done < <(grep -E '^\|[[:space:]]*[0-9]{3,4}[[:space:]]*\|' "$roadmap_path" 2>/dev/null)

  if is_json_output; then
    local json="[]"
    for i in "${!phases[@]}"; do
      json=$(echo "$json" | jq \
        --arg phase "${phases[$i]}" \
        --arg name "${names[$i]}" \
        --arg status "${statuses[$i]}" \
        --arg source "${sources[$i]}" \
        '. + [{phase: $phase, name: $name, status: $status, source: $source}]')
    done
    echo "$json" | jq '{phases: ., count: (. | length)}'
  else
    # Summary
    local total=${#phases[@]}
    local complete=0
    local in_progress=0

    for status in "${statuses[@]}"; do
      case "$status" in
        complete) ((complete++)) ;;
        in_progress) ((in_progress++)) ;;
      esac
    done

    echo -e "${BLUE}INFO${RESET}: $total phase(s) ($complete complete, $in_progress in progress)"
    echo ""

    for i in "${!phases[@]}"; do
      local icon="◯"
      case "${statuses[$i]}" in
        complete) icon="${GREEN}✓${RESET}" ;;
        in_progress) icon="${CYAN}◉${RESET}" ;;
      esac

      local source_hint=""
      if [[ "${sources[$i]}" == "phases" ]]; then
        source_hint=" [file]"
      fi

      echo -e "  $icon ${phases[$i]} - ${names[$i]}${source_hint}"
    done
  fi
}

cmd_archive() {
  local phase="$1"

  if [[ -z "$phase" ]]; then
    log_error "Phase number required"
    echo "Usage: specflow phase archive <phase>"
    exit 1
  fi

  # Normalize to 4 digits
  phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")

  local roadmap_path
  roadmap_path="$(get_repo_root)/ROADMAP.md"

  # Get phase info
  local info
  info=$(get_phase_from_roadmap "$phase")

  if [[ -z "$info" ]]; then
    log_error "Phase $phase not found in ROADMAP.md"
    exit 1
  fi

  local phase_name
  phase_name=$(echo "$info" | cut -d'|' -f2)

  # Ensure history directory
  ensure_history_dir
  local history_file
  history_file="$(get_history_file)"

  # Initialize HISTORY.md if needed
  if [[ ! -f "$history_file" ]]; then
    cat > "$history_file" << 'EOF'
# Completed Phases

> Archive of completed development phases. Newest first.

---

EOF
  fi

  # Extract phase content
  local phase_content=""
  local phase_file
  phase_file=$(find_phase_file "$phase")

  if [[ -n "$phase_file" ]]; then
    # From phase file (skip frontmatter)
    phase_content=$(awk '
      /^---$/ { if (in_frontmatter) { in_frontmatter = 0; next } else { in_frontmatter = 1; next } }
      !in_frontmatter { print }
    ' "$phase_file")
  else
    # From ROADMAP inline section
    phase_content=$(extract_phase_section "$phase")
  fi

  if [[ -z "$phase_content" ]]; then
    log_warn "No detailed content found for phase $phase"
    phase_content="### ${phase} - ${phase_name}

**Completed**: $(date +%Y-%m-%d)

No detailed content available."
  fi

  # Format for history (### becomes ## for history headings)
  local history_content
  history_content=$(echo "$phase_content" | sed 's/^###/##/')

  # Add completion date if not present
  if ! echo "$history_content" | grep -q "Completed"; then
    history_content=$(echo "$history_content" | sed "s/^## ${phase}/## ${phase} - ${phase_name}\n\n**Completed**: $(date +%Y-%m-%d)/")
  fi

  # Append to history (after the header)
  # Write content to temp file first (awk -v can't handle multi-line strings)
  local content_file
  content_file=$(mktemp)
  echo "$history_content" > "$content_file"

  local temp_file
  temp_file=$(mktemp)

  awk -v content_file="$content_file" '
    /^---$/ && !inserted {
      print
      print ""
      while ((getline line < content_file) > 0) print line
      close(content_file)
      print ""
      print "---"
      inserted = 1
      next
    }
    { print }
  ' "$history_file" > "$temp_file"

  rm -f "$content_file"
  mv "$temp_file" "$history_file"

  # Remove phase file if it exists
  if [[ -n "$phase_file" ]]; then
    rm -f "$phase_file"
  fi

  log_success "Archived phase $phase to HISTORY.md"

  if is_json_output; then
    jq -n \
      --arg phase "$phase" \
      --arg name "$phase_name" \
      --arg history "$history_file" \
      '{archived: true, phase: $phase, name: $name, history_file: $history}'
  fi
}

cmd_create() {
  local phase="$1"
  local name="$2"

  if [[ -z "$phase" ]] || [[ -z "$name" ]]; then
    log_error "Phase and name required"
    echo "Usage: specflow phase create <phase> <name>"
    echo "Example: specflow phase create 0050 user-authentication"
    exit 1
  fi

  # Normalize phase to 4 digits
  phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")

  # Normalize name to kebab-case
  name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')

  ensure_phases_dir
  local phases_dir
  phases_dir="$(get_phases_dir)"

  local phase_file="${phases_dir}/${phase}-${name}.md"

  if [[ -f "$phase_file" ]]; then
    log_error "Phase file already exists: $phase_file"
    exit 1
  fi

  # Create phase file
  cat > "$phase_file" << EOF
---
phase: ${phase}
name: ${name}
status: not_started
created: $(date +%Y-%m-%d)
milestone: 0
---

# ${phase} - ${name}

**Goal**: [TODO: Define the primary goal of this phase]

## Scope

- [TODO: Define scope item 1]
- [TODO: Define scope item 2]

## User Stories

1. As a [user type], I can [action] so that [benefit]

## Deliverables

- [ ] [TODO: Deliverable 1]
- [ ] [TODO: Deliverable 2]

## Verification Gate

- [ ] All deliverables complete
- [ ] Tests passing
- [ ] Documentation updated

## Complexity

**Estimated**: [Small | Medium | Large]

---

## Implementation Notes

<!-- Populated during implementation -->

## Lessons Learned

<!-- Populated after completion -->
EOF

  log_success "Created phase file: $phase_file"

  if is_json_output; then
    jq -n \
      --arg phase "$phase" \
      --arg name "$name" \
      --arg file "$phase_file" \
      '{created: true, phase: $phase, name: $name, file: $file}'
  else
    echo ""
    echo "Edit with: $EDITOR $phase_file"
    echo "Or view: specflow phase show $phase"
  fi
}

cmd_migrate() {
  local dry_run=false
  local collapse=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        dry_run=true
        shift
        ;;
      --collapse)
        collapse=true
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

  # Three-line rule: Show counts after analysis
  # Count phases
  local total_phases=0
  local complete_phases=0
  local active_phases=0

  while IFS='|' read -r _ num name status _; do
    ((total_phases++))
    if [[ "$status" == *"✅"* ]]; then
      ((complete_phases++))
    else
      ((active_phases++))
    fi
  done < <(grep -E '^\|[[:space:]]*[0-9]{3,4}[[:space:]]*\|' "$roadmap_path" 2>/dev/null)

  echo "Found: $total_phases phases ($complete_phases complete, $active_phases active)"
  echo ""

  if $dry_run; then
    echo "DRY RUN - Would execute:"
    echo ""
    echo "1. Create directories:"
    echo "   - .specify/phases/"
    echo "   - .specify/history/"
    echo ""
    echo "2. Extract $active_phases active phase(s) to .specify/phases/"
    echo ""
    echo "3. Archive $complete_phases completed phase(s) to .specify/history/HISTORY.md"
    echo ""
    if $collapse; then
      echo "4. Collapse ROADMAP.md to lightweight index format (--collapse)"
    else
      echo "4. (skipped) Use --collapse to rewrite ROADMAP.md"
    fi
    echo ""
    echo "No changes made."
    exit 0
  fi

  # Create directories
  ensure_phases_dir
  ensure_history_dir

  local phases_dir
  phases_dir="$(get_phases_dir)"
  local history_file
  history_file="$(get_history_file)"

  # Initialize HISTORY.md
  if [[ ! -f "$history_file" ]]; then
    cat > "$history_file" << 'EOF'
# Completed Phases

> Archive of completed development phases. Newest first.

---

EOF
  fi

  # Process each phase
  local extracted=0
  local archived=0

  while IFS='|' read -r _ num name status _; do
    num=$(echo "$num" | tr -d ' ')
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')

    local section
    section=$(extract_phase_section "$num")

    if [[ -z "$section" ]]; then
      continue
    fi

    if [[ "$status" == *"✅"* ]]; then
      # Archive completed phase
      local history_section
      history_section=$(echo "$section" | sed 's/^###/##/')

      # Append to history
      echo "" >> "$history_file"
      echo "$history_section" >> "$history_file"
      echo "" >> "$history_file"
      echo "---" >> "$history_file"

      ((archived++))
    else
      # Extract active phase
      local phase_file="${phases_dir}/${num}-${name}.md"

      cat > "$phase_file" << EOF
---
phase: ${num}
name: ${name}
status: $(if [[ "$status" == *"🔄"* ]]; then echo "in_progress"; else echo "not_started"; fi)
created: $(date +%Y-%m-%d)
---

$section
EOF

      ((extracted++))
    fi
  done < <(grep -E '^\|[[:space:]]*[0-9]{3,4}[[:space:]]*\|' "$roadmap_path" 2>/dev/null)

  # Collapse ROADMAP if requested
  if $collapse; then
    collapse_roadmap "$roadmap_path"
  fi

  log_success "Migration complete"
  echo ""
  echo "  Extracted: $extracted active phase(s) to .specify/phases/"
  echo "  Archived: $archived completed phase(s) to .specify/history/HISTORY.md"
  if $collapse; then
    echo "  Collapsed: ROADMAP.md to lightweight index format"
  else
    echo ""
    echo "Note: ROADMAP.md still contains inline sections."
    echo "Run 'specflow phase migrate --collapse' or use /specflow.roadmap to regenerate."
  fi
}

cmd_path() {
  local phase="${1:-}"

  if [[ -z "$phase" ]]; then
    get_phases_dir
  else
    phase=$(printf "%04d" "$((10#${phase}))" 2>/dev/null || echo "$phase")
    local phase_file
    phase_file=$(find_phase_file "$phase")

    if [[ -n "$phase_file" ]]; then
      echo "$phase_file"
    else
      echo "$(get_phases_dir)/${phase}-*.md (not found)"
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
    show)
      cmd_show "${1:-}"
      ;;
    list|ls)
      cmd_list "$@"
      ;;
    archive)
      cmd_archive "${1:-}"
      ;;
    create)
      cmd_create "${1:-}" "${2:-}"
      ;;
    migrate)
      cmd_migrate "$@"
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
      echo "Run 'specflow phase --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
