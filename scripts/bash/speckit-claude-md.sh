#!/usr/bin/env bash
#
# speckit-claude-md.sh - CLAUDE.md operations
#
# Usage:
#   speckit claude-md update <description>   Add to Recent Changes
#   speckit claude-md sync                   Sync from ROADMAP.md completions
#   speckit claude-md init                   Initialize Recent Changes section
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# =============================================================================
# Constants
# =============================================================================

readonly RECENT_CHANGES_HEADER="## Recent Changes"
readonly MAX_RECENT_ENTRIES=10

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit claude-md - CLAUDE.md operations

USAGE:
    speckit claude-md <command> [options]

COMMANDS:
    update <description>
                        Add entry to Recent Changes section
                        Automatically adds date and maintains max entries

    sync                Sync Recent Changes from ROADMAP.md completions
                        Adds completed phases not already in Recent Changes

    init                Initialize or reset Recent Changes section
                        Creates section if missing, or clears existing

    merge [--dry-run]   Merge SpecKit sections into existing CLAUDE.md
                        Preserves user content, adds SpecKit sections
                        Use --dry-run to preview changes

    show                Show current Recent Changes section

    path                Show path to CLAUDE.md

OPTIONS:
    --json              Output in JSON format
    --dry-run           Preview changes without applying (for merge)
    -h, --help          Show this help

EXAMPLES:
    speckit claude-md update "Phase 002: Added flow engine with state machine"
    speckit claude-md sync
    speckit claude-md merge --dry-run
    speckit claude-md show
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get CLAUDE.md path
get_claude_md_path() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/CLAUDE.md"
}

# Ensure CLAUDE.md exists
ensure_claude_md() {
  local claude_path
  claude_path="$(get_claude_md_path)"

  if [[ ! -f "$claude_path" ]]; then
    log_error "CLAUDE.md not found: $claude_path"
    log_info "Create one with: /init"
    exit 1
  fi
}

# Check if Recent Changes section exists
has_recent_changes_section() {
  local claude_path
  claude_path="$(get_claude_md_path)"
  grep -qF "$RECENT_CHANGES_HEADER" "$claude_path" 2>/dev/null
}

# Get content of Recent Changes section
get_recent_changes() {
  local claude_path
  claude_path="$(get_claude_md_path)"

  if ! has_recent_changes_section; then
    echo ""
    return
  fi

  # Extract section content (from header to next ## or EOF)
  sed -n "/${RECENT_CHANGES_HEADER}/,/^## /p" "$claude_path" | head -n -1 | tail -n +2
}

# =============================================================================
# Commands
# =============================================================================

cmd_update() {
  local description="$1"

  if [[ -z "$description" ]]; then
    log_error "Description required"
    echo "Usage: speckit claude-md update <description>"
    exit 1
  fi

  ensure_claude_md
  local claude_path
  claude_path="$(get_claude_md_path)"

  local today
  today="$(current_date)"
  local entry="- **${today}**: ${description}"

  if ! has_recent_changes_section; then
    # Add section before first ## after header or at end
    log_info "Creating Recent Changes section"
    local temp_file
    temp_file=$(mktemp)

    # Find position to insert (after initial header section)
    awk -v header="$RECENT_CHANGES_HEADER" -v entry="$entry" '
      BEGIN { inserted = 0 }
      /^## / && !inserted {
        print header
        print ""
        print entry
        print ""
        inserted = 1
      }
      { print }
      END {
        if (!inserted) {
          print ""
          print header
          print ""
          print entry
        }
      }
    ' "$claude_path" > "$temp_file"

    mv "$temp_file" "$claude_path"
  else
    # Insert new entry at top of existing section
    local temp_file
    temp_file=$(mktemp)

    awk -v header="$RECENT_CHANGES_HEADER" -v entry="$entry" -v max="$MAX_RECENT_ENTRIES" '
      $0 == header {
        print
        getline  # skip blank line after header
        print ""
        print entry
        count = 1
        next
      }
      /^- \*\*[0-9]{4}-[0-9]{2}-[0-9]{2}\*\*:/ {
        count++
        if (count <= max) print
        next
      }
      { print }
    ' "$claude_path" > "$temp_file"

    mv "$temp_file" "$claude_path"
  fi

  log_success "Added: $entry"

  if is_json_output; then
    echo "{\"added\": \"$description\", \"date\": \"$today\"}"
  fi
}

cmd_sync() {
  ensure_claude_md

  # Check if roadmap exists
  local roadmap_path
  roadmap_path="$(get_repo_root)/ROADMAP.md"

  if [[ ! -f "$roadmap_path" ]]; then
    log_error "ROADMAP.md not found"
    exit 1
  fi

  # Get completed phases from roadmap
  local completed_phases
  completed_phases=$(grep -E '^\|\s*[0-9]{3}\s*\|.*✅' "$roadmap_path" 2>/dev/null || true)

  if [[ -z "$completed_phases" ]]; then
    log_info "No completed phases found in ROADMAP.md"
    exit 0
  fi

  # Get existing recent changes
  local existing_changes
  existing_changes=$(get_recent_changes)

  local added=0

  while IFS='|' read -r _ phase_num name _ _; do
    phase_num=$(echo "$phase_num" | tr -d ' ')
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Check if this phase is already in recent changes
    if echo "$existing_changes" | grep -qF "$phase_num"; then
      log_debug "Phase $phase_num already in Recent Changes"
      continue
    fi

    # Add to recent changes
    cmd_update "Phase ${phase_num}: ${name} - completed"
    ((added++))
  done <<< "$completed_phases"

  if [[ $added -eq 0 ]]; then
    log_info "Recent Changes already up to date"
  else
    log_success "Added $added phase(s) to Recent Changes"
  fi

  if is_json_output; then
    echo "{\"synced\": $added}"
  fi
}

cmd_init() {
  ensure_claude_md
  local claude_path
  claude_path="$(get_claude_md_path)"

  if has_recent_changes_section; then
    if ! confirm "Recent Changes section exists. Reset it?"; then
      log_info "Aborted"
      exit 0
    fi

    # Remove existing section
    local temp_file
    temp_file=$(mktemp)

    awk -v header="$RECENT_CHANGES_HEADER" '
      $0 == header { skip = 1; next }
      /^## / && skip { skip = 0 }
      !skip { print }
    ' "$claude_path" > "$temp_file"

    mv "$temp_file" "$claude_path"
  fi

  # Add fresh section
  local temp_file
  temp_file=$(mktemp)
  local today
  today="$(current_date)"

  awk -v header="$RECENT_CHANGES_HEADER" -v today="$today" '
    BEGIN { inserted = 0 }
    /^## / && !inserted {
      print header
      print ""
      print "- **" today "**: Initialized Recent Changes tracking"
      print ""
      inserted = 1
    }
    { print }
    END {
      if (!inserted) {
        print ""
        print header
        print ""
        print "- **" today "**: Initialized Recent Changes tracking"
      }
    }
  ' "$claude_path" > "$temp_file"

  mv "$temp_file" "$claude_path"
  log_success "Initialized Recent Changes section"

  if is_json_output; then
    echo "{\"initialized\": true}"
  fi
}

cmd_show() {
  ensure_claude_md

  if ! has_recent_changes_section; then
    log_info "No Recent Changes section found"
    log_info "Run 'speckit claude-md init' to create one"
    exit 0
  fi

  local changes
  changes=$(get_recent_changes)

  if is_json_output; then
    # Parse entries into JSON array
    echo "$changes" | grep -E '^- \*\*' | while read -r line; do
      echo "$line"
    done | jq -R -s 'split("\n") | map(select(. != ""))'
  else
    print_header "Recent Changes"
    if [[ -z "$changes" ]]; then
      echo "  (no entries)"
    else
      echo "$changes"
    fi
  fi
}

cmd_path() {
  get_claude_md_path
}

cmd_merge() {
  local dry_run=false

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

  local claude_path
  claude_path="$(get_claude_md_path)"

  # SpecKit sections to add/update
  local speckit_sections=(
    "Recent Changes"
    "SpecKit Configuration"
    "Development Workflow"
  )

  local speckit_marker="<!-- SpecKit Managed Section -->"

  if [[ ! -f "$claude_path" ]]; then
    log_error "CLAUDE.md not found at $claude_path"
    log_info "Nothing to merge - run scaffold to create one"
    exit 1
  fi

  local existing_content
  existing_content="$(cat "$claude_path")"

  # Check what SpecKit sections are already present
  local missing_sections=()
  local present_sections=()

  for section in "${speckit_sections[@]}"; do
    if grep -qF "## $section" "$claude_path" 2>/dev/null; then
      present_sections+=("$section")
    else
      missing_sections+=("$section")
    fi
  done

  if [[ ${#missing_sections[@]} -eq 0 ]]; then
    log_info "All SpecKit sections already present in CLAUDE.md"
    if is_json_output; then
      echo '{"status": "up_to_date", "merged": []}'
    fi
    return 0
  fi

  log_step "Merge Analysis"
  echo ""
  echo "  Existing CLAUDE.md: $(wc -l < "$claude_path" | tr -d ' ') lines"
  echo "  Present SpecKit sections: ${present_sections[*]:-none}"
  echo "  Missing SpecKit sections: ${missing_sections[*]}"
  echo ""

  if $dry_run; then
    log_info "[DRY RUN] Would add the following sections:"
    for section in "${missing_sections[@]}"; do
      echo "  + ## $section"
    done

    if is_json_output; then
      printf '{"dry_run": true, "would_add": ['
      local first=true
      for section in "${missing_sections[@]}"; do
        $first || printf ','
        printf '"%s"' "$section"
        first=false
      done
      printf ']}\n'
    fi
    return 0
  fi

  # Create backup
  local backup_path="${claude_path}.backup.$(date +%Y%m%d%H%M%S)"
  cp "$claude_path" "$backup_path"
  log_info "Backup created: $backup_path"

  # Generate missing sections content
  local new_sections=""

  for section in "${missing_sections[@]}"; do
    case "$section" in
      "Recent Changes")
        new_sections+="
## Recent Changes
$speckit_marker

- **$(current_date)**: SpecKit integration initialized

"
        ;;
      "SpecKit Configuration")
        new_sections+="
## SpecKit Configuration
$speckit_marker

- **State file**: \`.specify/orchestration-state.json\`
- **Memory docs**: \`.specify/memory/\`
- **Specifications**: \`specs/\`

Run \`speckit help\` for available commands.

"
        ;;
      "Development Workflow")
        new_sections+="
## Development Workflow
$speckit_marker

This project uses SpecKit for spec-driven development:

1. \`/speckit.orchestrate\` - Run full workflow
2. \`/speckit.verify\` - Verify completion
3. \`speckit roadmap status\` - Check phase progress

"
        ;;
    esac
  done

  # Find insertion point (before first ## or at end)
  local temp_file
  temp_file=$(mktemp)

  # Strategy: Insert SpecKit sections after the main header/description
  # Look for the first ## heading and insert before it
  awk -v sections="$new_sections" '
    /^## / && !inserted {
      printf "%s", sections
      inserted = 1
    }
    { print }
    END {
      if (!inserted) {
        printf "%s", sections
      }
    }
  ' "$claude_path" > "$temp_file"

  mv "$temp_file" "$claude_path"

  log_success "Merged ${#missing_sections[@]} SpecKit section(s) into CLAUDE.md"

  if is_json_output; then
    printf '{"merged": ['
    local first=true
    for section in "${missing_sections[@]}"; do
      $first || printf ','
      printf '"%s"' "$section"
      first=false
    done
    printf '], "backup": "%s"}\n' "$backup_path"
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
    update)
      cmd_update "${1:-}"
      ;;
    sync)
      cmd_sync
      ;;
    init)
      cmd_init
      ;;
    merge)
      cmd_merge "$@"
      ;;
    show)
      cmd_show
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
      echo "Run 'speckit claude-md --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
