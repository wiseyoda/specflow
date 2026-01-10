#!/usr/bin/env bash
#
# speckit-state.sh - State file operations
#
# Usage:
#   speckit state get [key]              Show state or specific key
#   speckit state set <key>=<value>      Update a value
#   speckit state init                   Initialize new state file
#   speckit state reset                  Reset to defaults
#   speckit state validate               Validate state file
#   speckit state migrate                Migrate v1.0 state to v2.0
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Constants
# =============================================================================

readonly STATE_VERSION="2.0"

# Default state template
read -r -d '' DEFAULT_STATE << 'EOF' || true
{
  "version": "2.0",
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
  },
  "project": {
    "name": null,
    "description": null,
    "type": null,
    "criticality": null
  },
  "interview": {
    "status": "not_started",
    "current_phase": 0,
    "current_question": 0,
    "decisions_count": 0,
    "phases": {},
    "started_at": null,
    "completed_at": null
  },
  "orchestration": {
    "phase_number": null,
    "phase_name": null,
    "branch": null,
    "step": null,
    "status": "not_started",
    "steps": {
      "specify": { "status": "pending", "completed_at": null, "artifacts": [] },
      "clarify": { "status": "pending", "completed_at": null, "artifacts": [] },
      "plan": { "status": "pending", "completed_at": null, "artifacts": [] },
      "tasks": { "status": "pending", "completed_at": null, "artifacts": [] },
      "analyze": { "status": "pending", "completed_at": null, "artifacts": [] },
      "checklist": { "status": "pending", "completed_at": null, "artifacts": [] },
      "implement": { "status": "pending", "completed_at": null, "tasks_completed": 0, "tasks_total": 0, "artifacts": [] },
      "verify": { "status": "pending", "completed_at": null, "artifacts": [] }
    }
  },
  "history": [],
  "last_updated": null
}
EOF

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit state - State file operations

USAGE:
    speckit state <command> [options]

COMMANDS:
    get [key]           Show entire state or a specific key
                        Keys use jq syntax: .config.roadmap_path

    set <key>=<value>   Update a value in the state file
                        Example: speckit state set .orchestration.step=plan

    init                Initialize a new state file
                        Creates .specify/orchestration-state.json

    reset               Reset state to defaults (keeps config)

    reset --full        Reset entire state including config

    validate            Validate state file structure

    migrate             Migrate state file from v1.0 to v2.0
                        Preserves all existing data
                        Creates backup before migration

    path                Print the state file path

OPTIONS:
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit state get                     # Show full state
    speckit state get .config             # Show config section
    speckit state get .orchestration.step # Show current step
    speckit state set .project.name=MyApp # Set project name
    speckit state init                    # Create new state file
    speckit state validate                # Check state validity
EOF
}

# =============================================================================
# Commands
# =============================================================================

# Get state or a specific key
cmd_get() {
  local key="${1:-}"
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    log_info "Run 'speckit state init' to create one"
    exit 1
  fi

  if [[ -z "$key" ]]; then
    # Show full state (pretty printed)
    if is_json_output; then
      cat "$state_file"
    else
      json_pretty "$state_file"
    fi
  else
    # Show specific key
    local value
    value=$(json_get "$state_file" "$key")

    if [[ -z "$value" ]]; then
      log_error "Key not found: $key"
      exit 1
    fi

    # Check if value is a JSON object/array
    if [[ "$value" == "{"* ]] || [[ "$value" == "["* ]]; then
      if is_json_output; then
        echo "$value"
      else
        echo "$value" | jq '.'
      fi
    else
      echo "$value"
    fi
  fi
}

# Set a value
cmd_set() {
  local assignment="$1"
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    log_info "Run 'speckit state init' to create one"
    exit 1
  fi

  # Parse key=value
  if [[ ! "$assignment" =~ ^(.+)=(.*)$ ]]; then
    log_error "Invalid format. Use: speckit state set <key>=<value>"
    exit 1
  fi

  local key="${BASH_REMATCH[1]}"
  local value="${BASH_REMATCH[2]}"

  # Ensure key starts with .
  if [[ ! "$key" =~ ^\. ]]; then
    key=".$key"
  fi

  # Set the value
  if json_set_string "$state_file" "$key" "$value"; then
    # Update timestamp
    json_set_string "$state_file" ".last_updated" "$(iso_timestamp)"
    log_success "Set $key = $value"
  else
    log_error "Failed to set value"
    exit 1
  fi
}

# Initialize state file
cmd_init() {
  local force="${1:-}"
  local state_file
  state_file="$(get_state_file)"
  local specify_dir
  specify_dir="$(get_specify_dir)"

  # Check if state file exists
  if [[ -f "$state_file" ]] && [[ "$force" != "--force" ]]; then
    log_warn "State file already exists: $state_file"
    if ! confirm "Overwrite existing state file?"; then
      log_info "Aborted"
      exit 0
    fi
  fi

  # Ensure .specify directory exists
  ensure_dir "$specify_dir"

  # Create state file
  local timestamp
  timestamp="$(iso_timestamp)"

  echo "$DEFAULT_STATE" | jq --arg ts "$timestamp" '.last_updated = $ts' > "$state_file"

  log_success "Created state file: $state_file"

  if is_json_output; then
    echo "{\"created\": \"$state_file\"}"
  fi
}

# Reset state
cmd_reset() {
  local full_reset="${1:-}"
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    exit 1
  fi

  if [[ "$full_reset" == "--full" ]]; then
    # Full reset - recreate entirely
    if ! confirm "This will reset ALL state including config. Continue?"; then
      log_info "Aborted"
      exit 0
    fi
    cmd_init --force
  else
    # Partial reset - keep config, reset interview and orchestration
    if ! confirm "Reset interview and orchestration state (config preserved)?"; then
      log_info "Aborted"
      exit 0
    fi

    local temp_file
    temp_file=$(mktemp)

    # Reset interview and orchestration, preserve config
    jq --arg ts "$(iso_timestamp)" '
      .interview = {
        "status": "not_started",
        "current_phase": 0,
        "current_question": 0,
        "decisions_count": 0,
        "phases": {},
        "started_at": null,
        "completed_at": null
      } |
      .orchestration = {
        "phase_number": null,
        "phase_name": null,
        "branch": null,
        "step": null,
        "status": "not_started",
        "steps": {
          "specify": { "status": "pending", "completed_at": null, "artifacts": [] },
          "clarify": { "status": "pending", "completed_at": null, "artifacts": [] },
          "plan": { "status": "pending", "completed_at": null, "artifacts": [] },
          "tasks": { "status": "pending", "completed_at": null, "artifacts": [] },
          "analyze": { "status": "pending", "completed_at": null, "artifacts": [] },
          "checklist": { "status": "pending", "completed_at": null, "artifacts": [] },
          "implement": { "status": "pending", "completed_at": null, "tasks_completed": 0, "tasks_total": 0, "artifacts": [] },
          "verify": { "status": "pending", "completed_at": null, "artifacts": [] }
        }
      } |
      .last_updated = $ts
    ' "$state_file" > "$temp_file"

    mv "$temp_file" "$state_file"
    log_success "State reset (config preserved)"
  fi
}

# Validate state file
cmd_validate() {
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    exit 1
  fi

  local errors=0

  # Check JSON validity
  if ! json_validate "$state_file"; then
    log_error "Invalid JSON syntax"
    ((errors++))
  fi

  # Check version
  local version
  version=$(json_get "$state_file" ".version" 2>/dev/null || echo "")
  if [[ -z "$version" ]]; then
    log_error "Missing version field"
    ((errors++))
  elif [[ "$version" != "2.0" ]] && [[ "$version" != "1.1" ]] && [[ "$version" != "1.0" ]]; then
    log_warn "Unknown version: $version (expected 2.0)"
  fi

  # Check required sections
  local sections=("config" "project" "interview" "orchestration")
  for section in "${sections[@]}"; do
    if ! json_has "$state_file" ".$section"; then
      log_error "Missing required section: $section"
      ((errors++))
    fi
  done

  # Check config paths
  local config_keys=("roadmap_path" "memory_path" "specs_path")
  for key in "${config_keys[@]}"; do
    if ! json_has "$state_file" ".config.$key"; then
      log_warn "Missing config key: $key"
    fi
  done

  if [[ $errors -eq 0 ]]; then
    log_success "State file is valid"
    if is_json_output; then
      echo '{"valid": true, "errors": 0}'
    fi
    exit 0
  else
    log_error "Found $errors error(s)"
    if is_json_output; then
      echo "{\"valid\": false, \"errors\": $errors}"
    fi
    exit 1
  fi
}

# Show state file path
cmd_path() {
  local state_file
  state_file="$(get_state_file)"
  echo "$state_file"
}

# Migrate state file from v1.0 to v2.0
cmd_migrate() {
  local state_file
  state_file="$(get_state_file)"
  local specify_dir
  specify_dir="$(get_specify_dir)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    log_info "Nothing to migrate"
    exit 1
  fi

  # Check if valid JSON
  if ! jq '.' "$state_file" >/dev/null 2>&1; then
    log_error "State file has invalid JSON - cannot migrate"
    log_info "Try: speckit state init --force (will lose existing data)"
    exit 1
  fi

  # Check current version
  local version
  version=$(jq -r '.version // "unknown"' "$state_file" 2>/dev/null)

  if [[ "$version" == "2.0" ]]; then
    log_success "State file is already v2.0 - no migration needed"
    exit 0
  fi

  log_step "Migrating state file from v${version} to v2.0"

  # Create backup
  local backup_dir="${specify_dir}/backup"
  ensure_dir "$backup_dir"
  local backup_file="${backup_dir}/orchestration-state-${version}-$(date +%Y%m%d%H%M%S).json"
  cp "$state_file" "$backup_file"
  log_success "Created backup: $backup_file"

  # Detect format and extract data
  local temp_file
  temp_file=$(mktemp)

  # Check if it's v1.0 format (version == "1.0" or config paths in .project)
  if [[ "$version" == "1.0" ]] || jq -e '.project.roadmap_path' "$state_file" >/dev/null 2>&1; then
    log_info "Detected v1.0 format"

    # Migrate v1.0 to v2.0
    jq --arg ts "$(iso_timestamp)" '
      # Start with default structure
      {
        "version": "2.0",
        "config": {
          "roadmap_path": (.project.roadmap_path // "ROADMAP.md"),
          "memory_path": (.project.memory_path // ".specify/memory/"),
          "specs_path": (.project.specs_path // "specs/"),
          "scripts_path": (.project.scripts_path // ".specify/scripts/"),
          "templates_path": (.project.templates_path // ".specify/templates/")
        },
        "project": {
          "name": (.project.name // null),
          "description": (.project.description // null),
          "type": (.project.type // null),
          "criticality": (.project.criticality // null)
        },
        "interview": (.interview // {
          "status": "not_started",
          "current_phase": 0,
          "current_question": 0,
          "decisions_count": 0,
          "phases": {},
          "started_at": null,
          "completed_at": null
        }),
        "orchestration": (.orchestration // {
          "phase_number": null,
          "phase_name": null,
          "branch": null,
          "step": null,
          "status": "not_started",
          "steps": {
            "specify": { "status": "pending", "completed_at": null, "artifacts": [] },
            "clarify": { "status": "pending", "completed_at": null, "artifacts": [] },
            "plan": { "status": "pending", "completed_at": null, "artifacts": [] },
            "tasks": { "status": "pending", "completed_at": null, "artifacts": [] },
            "analyze": { "status": "pending", "completed_at": null, "artifacts": [] },
            "checklist": { "status": "pending", "completed_at": null, "artifacts": [] },
            "implement": { "status": "pending", "completed_at": null, "tasks_completed": 0, "tasks_total": 0, "artifacts": [] },
            "verify": { "status": "pending", "completed_at": null, "artifacts": [] }
          }
        }),
        "history": (.history // []),
        "last_updated": $ts,
        "_migrated_from": "v1.0",
        "_migrated_at": $ts
      }
    ' "$state_file" > "$temp_file"

  elif jq -e '.config' "$state_file" >/dev/null 2>&1; then
    # Already has .config, but might be missing sections
    log_info "Detected partial v2.0 format - adding missing sections"

    jq --arg ts "$(iso_timestamp)" '
      # Merge with defaults for any missing sections
      {
        "version": "2.0",
        "config": (.config // {
          "roadmap_path": "ROADMAP.md",
          "memory_path": ".specify/memory/",
          "specs_path": "specs/",
          "scripts_path": ".specify/scripts/",
          "templates_path": ".specify/templates/"
        }),
        "project": (.project // {
          "name": null,
          "description": null,
          "type": null,
          "criticality": null
        }),
        "interview": (.interview // {
          "status": "not_started",
          "current_phase": 0,
          "current_question": 0,
          "decisions_count": 0,
          "phases": {},
          "started_at": null,
          "completed_at": null
        }),
        "orchestration": (.orchestration // {
          "phase_number": null,
          "phase_name": null,
          "branch": null,
          "step": null,
          "status": "not_started",
          "steps": {}
        }),
        "history": (.history // []),
        "last_updated": $ts
      }
    ' "$state_file" > "$temp_file"

  else
    log_warn "Unknown state format - creating fresh v2.0 with preserved data"

    jq --arg ts "$(iso_timestamp)" '
      {
        "version": "2.0",
        "config": {
          "roadmap_path": "ROADMAP.md",
          "memory_path": ".specify/memory/",
          "specs_path": "specs/",
          "scripts_path": ".specify/scripts/",
          "templates_path": ".specify/templates/"
        },
        "project": {
          "name": null,
          "description": null,
          "type": null,
          "criticality": null
        },
        "interview": {
          "status": "not_started",
          "current_phase": 0,
          "current_question": 0,
          "decisions_count": 0,
          "phases": {},
          "started_at": null,
          "completed_at": null
        },
        "orchestration": {
          "phase_number": null,
          "phase_name": null,
          "branch": null,
          "step": null,
          "status": "not_started",
          "steps": {}
        },
        "history": [],
        "last_updated": $ts,
        "_original_data": .
      }
    ' "$state_file" > "$temp_file"
  fi

  # Validate the migrated file
  if ! jq '.' "$temp_file" >/dev/null 2>&1; then
    log_error "Migration produced invalid JSON - aborting"
    log_info "Original file preserved, backup at: $backup_file"
    rm "$temp_file"
    exit 1
  fi

  # Write the migrated file
  mv "$temp_file" "$state_file"

  log_success "Migration complete!"
  log_info "Migrated: v${version} → v2.0"
  log_info "Backup: $backup_file"

  if is_json_output; then
    echo "{\"migrated\": true, \"from\": \"$version\", \"to\": \"2.0\", \"backup\": \"$backup_file\"}"
  fi
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
    get)
      cmd_get "${1:-}"
      ;;
    set)
      if [[ $# -eq 0 ]]; then
        log_error "Missing argument. Usage: speckit state set <key>=<value>"
        exit 1
      fi
      cmd_set "$1"
      ;;
    init)
      cmd_init "${1:-}"
      ;;
    reset)
      cmd_reset "${1:-}"
      ;;
    validate)
      cmd_validate
      ;;
    migrate)
      cmd_migrate
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
      echo "Run 'speckit state --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
