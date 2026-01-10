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
#   speckit state archive                Archive current phase and reset for next
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

# Central registry path
readonly SPECKIT_REGISTRY="${HOME}/.speckit/registry.json"

# Generate a UUID v4
generate_uuid() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  elif [[ -f /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  else
    # Fallback: use bash random + timestamp
    local n
    n=$(date +%s%N 2>/dev/null || date +%s)$RANDOM$RANDOM
    printf '%08x-%04x-4%03x-%04x-%012x\n' \
      $((n % 0xFFFFFFFF)) \
      $((RANDOM % 0xFFFF)) \
      $((RANDOM % 0xFFF)) \
      $((0x8000 | RANDOM % 0x3FFF)) \
      $((n % 0xFFFFFFFFFFFF))
  fi
}

# Default state template - v2.0 with web UI support
read -r -d '' DEFAULT_STATE << 'EOF' || true
{
  "schema_version": "2.0",
  "project": {
    "id": null,
    "name": null,
    "path": null,
    "description": null,
    "type": null,
    "criticality": null,
    "created_at": null,
    "updated_at": null
  },
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
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
    "phase": {
      "number": null,
      "name": null,
      "branch": null,
      "status": "not_started"
    },
    "step": {
      "current": null,
      "index": 0,
      "status": "not_started"
    },
    "progress": {
      "tasks_completed": 0,
      "tasks_total": 0,
      "percentage": 0
    }
  },
  "health": {
    "status": "unknown",
    "last_check": null,
    "issues": []
  },
  "actions": {
    "available": [],
    "pending": [],
    "history": []
  },
  "ui": {
    "last_sync": null,
    "notifications": []
  }
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
                        Generates project UUID for web UI support

    reset               Reset state to defaults (keeps project/config)

    reset --full        Reset entire state including config

    validate            Validate state file structure (v2.0 schema)

    migrate             Migrate state file from v1.x to v2.0
                        Preserves all existing data
                        Creates backup before migration
                        Generates UUID and registers with central registry

    archive             Archive completed phase and reset for next
                        Moves current phase to history
                        Clears orchestration state
                        Called automatically after phase completion

    registry [cmd]      Manage central project registry
                        list  - List all registered projects
                        sync  - Update last_seen for current project
                        clean - Remove stale projects
                        path  - Show registry file path

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
    speckit state migrate                 # Upgrade to v2.0 schema
    speckit state archive                 # Archive phase, reset for next
    speckit state registry list           # List all projects
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

# Register project in central registry
register_project() {
  local project_id="$1"
  local project_path="$2"
  local project_name="$3"

  local registry_dir
  registry_dir="$(dirname "$SPECKIT_REGISTRY")"

  # Create registry directory if needed
  if [[ ! -d "$registry_dir" ]]; then
    mkdir -p "$registry_dir"
  fi

  # Create registry file if it doesn't exist
  if [[ ! -f "$SPECKIT_REGISTRY" ]]; then
    echo '{"projects": {}}' > "$SPECKIT_REGISTRY"
  fi

  # Add/update project in registry
  local temp_file
  temp_file=$(mktemp)
  local timestamp
  timestamp="$(iso_timestamp)"

  jq --arg id "$project_id" \
     --arg path "$project_path" \
     --arg name "$project_name" \
     --arg ts "$timestamp" \
     '.projects[$id] = {"path": $path, "name": $name, "registered_at": $ts, "last_seen": $ts}' \
     "$SPECKIT_REGISTRY" > "$temp_file"

  mv "$temp_file" "$SPECKIT_REGISTRY"
}

# Initialize state file
cmd_init() {
  local force="${1:-}"
  local state_file
  state_file="$(get_state_file)"
  local specify_dir
  specify_dir="$(get_specify_dir)"
  local repo_root
  repo_root="$(get_repo_root)"

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

  # Generate new project ID and timestamp
  local project_id
  project_id="$(generate_uuid)"
  local timestamp
  timestamp="$(iso_timestamp)"
  local project_name
  project_name="$(basename "$repo_root")"

  # Create state file with populated fields
  echo "$DEFAULT_STATE" | jq \
    --arg id "$project_id" \
    --arg path "$repo_root" \
    --arg name "$project_name" \
    --arg ts "$timestamp" \
    '
      .project.id = $id |
      .project.path = $path |
      .project.name = $name |
      .project.created_at = $ts |
      .project.updated_at = $ts |
      .health.status = "initializing" |
      .health.last_check = $ts
    ' > "$state_file"

  # Register in central registry
  register_project "$project_id" "$repo_root" "$project_name"

  log_success "Created state file: $state_file"
  log_info "Project ID: $project_id"

  if is_json_output; then
    echo "{\"created\": \"$state_file\", \"project_id\": \"$project_id\"}"
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
    # Partial reset - keep project and config, reset interview and orchestration
    if ! confirm "Reset interview and orchestration state (project/config preserved)?"; then
      log_info "Aborted"
      exit 0
    fi

    local temp_file
    temp_file=$(mktemp)
    local timestamp
    timestamp="$(iso_timestamp)"

    # Reset interview, orchestration, health, and actions - preserve project and config
    jq --arg ts "$timestamp" '
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
        "phase": { "number": null, "name": null, "branch": null, "status": "not_started" },
        "step": { "current": null, "index": 0, "status": "not_started" },
        "progress": { "tasks_completed": 0, "tasks_total": 0, "percentage": 0 }
      } |
      .health = {
        "status": "reset",
        "last_check": $ts,
        "issues": []
      } |
      .actions = {
        "available": [],
        "pending": [],
        "history": []
      } |
      .project.updated_at = $ts
    ' "$state_file" > "$temp_file"

    mv "$temp_file" "$state_file"
    log_success "State reset (project/config preserved)"
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
  local warnings=0

  # Check JSON validity
  if ! json_validate "$state_file"; then
    log_error "Invalid JSON syntax"
    ((errors++))
    # Can't continue if JSON is invalid
    if is_json_output; then
      echo "{\"valid\": false, \"errors\": 1, \"warnings\": 0}"
    fi
    exit 1
  fi

  print_status ok "Valid JSON syntax"

  # Check schema version (v2.0 uses schema_version, older uses version)
  local schema_version
  schema_version=$(json_get "$state_file" ".schema_version" 2>/dev/null || echo "")
  local legacy_version
  legacy_version=$(json_get "$state_file" ".version" 2>/dev/null || echo "")

  if [[ -n "$schema_version" ]]; then
    if [[ "$schema_version" == "2.0" ]]; then
      print_status ok "Schema version: 2.0"
    else
      log_warn "Unknown schema version: $schema_version (expected 2.0)"
      ((warnings++))
    fi
  elif [[ -n "$legacy_version" ]]; then
    log_warn "Legacy version field found: $legacy_version (run 'speckit state migrate')"
    ((warnings++))
  else
    log_error "Missing schema_version field"
    ((errors++))
  fi

  # Check required sections (core)
  local core_sections=("config" "project" "interview" "orchestration")
  for section in "${core_sections[@]}"; do
    if ! json_has "$state_file" ".$section"; then
      log_error "Missing required section: $section"
      ((errors++))
    else
      print_status ok "Section: $section"
    fi
  done

  # Check v2.0 sections (warnings only for backwards compatibility)
  local v2_sections=("health" "actions" "ui")
  for section in "${v2_sections[@]}"; do
    if ! json_has "$state_file" ".$section"; then
      log_warn "Missing v2.0 section: $section (run 'speckit state migrate')"
      ((warnings++))
    fi
  done

  # Check project ID (v2.0 requirement)
  local project_id
  project_id=$(json_get "$state_file" ".project.id" 2>/dev/null || echo "")
  if [[ -z "$project_id" || "$project_id" == "null" ]]; then
    log_warn "Missing project.id (run 'speckit state migrate')"
    ((warnings++))
  else
    print_status ok "Project ID: ${project_id:0:8}..."
  fi

  # Check config paths
  local config_keys=("roadmap_path" "memory_path" "specs_path")
  for key in "${config_keys[@]}"; do
    if ! json_has "$state_file" ".config.$key"; then
      log_warn "Missing config key: $key"
      ((warnings++))
    fi
  done

  echo ""
  if [[ $errors -eq 0 ]]; then
    if [[ $warnings -eq 0 ]]; then
      log_success "State file is valid (v2.0)"
    else
      log_success "State file is valid with $warnings warning(s)"
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

# Show state file path
cmd_path() {
  local state_file
  state_file="$(get_state_file)"
  echo "$state_file"
}

# List/manage central registry
cmd_registry() {
  local subcommand="${1:-list}"

  case "$subcommand" in
    list|ls)
      if [[ ! -f "$SPECKIT_REGISTRY" ]]; then
        if is_json_output; then
          echo '{"projects": {}}'
        else
          log_info "No projects registered yet"
        fi
        exit 0
      fi

      if is_json_output; then
        cat "$SPECKIT_REGISTRY"
      else
        print_header "Registered Projects"
        echo ""
        jq -r '.projects | to_entries[] | "  \(.value.name) (\(.key | .[0:8])...)\n    Path: \(.value.path)\n    Registered: \(.value.registered_at)\n"' "$SPECKIT_REGISTRY" 2>/dev/null || echo "  (none)"
      fi
      ;;

    sync)
      # Update last_seen for current project
      local state_file
      state_file="$(get_state_file)"
      if [[ ! -f "$state_file" ]]; then
        log_error "No state file in current project"
        exit 1
      fi

      local project_id
      project_id=$(json_get "$state_file" ".project.id" 2>/dev/null || echo "")
      if [[ -z "$project_id" || "$project_id" == "null" ]]; then
        log_error "Project has no ID - run 'speckit state migrate'"
        exit 1
      fi

      if [[ ! -f "$SPECKIT_REGISTRY" ]]; then
        log_error "Registry not found"
        exit 1
      fi

      local temp_file
      temp_file=$(mktemp)
      local timestamp
      timestamp="$(iso_timestamp)"

      jq --arg id "$project_id" --arg ts "$timestamp" \
         '.projects[$id].last_seen = $ts' "$SPECKIT_REGISTRY" > "$temp_file"
      mv "$temp_file" "$SPECKIT_REGISTRY"

      log_success "Synced project $project_id"
      ;;

    clean)
      # Remove stale projects (paths that no longer exist)
      if [[ ! -f "$SPECKIT_REGISTRY" ]]; then
        log_info "Registry is empty"
        exit 0
      fi

      local temp_file
      temp_file=$(mktemp)
      local removed=0

      # Keep only projects where path exists
      jq -r '.projects | to_entries[] | "\(.key)|\(.value.path)"' "$SPECKIT_REGISTRY" | while IFS='|' read -r id path; do
        if [[ ! -d "$path" ]]; then
          log_info "Removing stale: $path"
          ((removed++)) || true
        fi
      done

      jq 'reduce (.projects | to_entries[]) as $e (.;
        if ($e.value.path | . as $p | (["test", "-d", $p] | debug | false)) then .projects |= del(.[$e.key]) else . end
      )' "$SPECKIT_REGISTRY" > "$temp_file" 2>/dev/null || cp "$SPECKIT_REGISTRY" "$temp_file"

      # Simpler approach - check each path
      local final_file
      final_file=$(mktemp)
      echo '{"projects": {}}' > "$final_file"

      jq -r '.projects | to_entries[] | "\(.key)|\(.value | @json)"' "$SPECKIT_REGISTRY" 2>/dev/null | while IFS='|' read -r id value; do
        local path
        path=$(echo "$value" | jq -r '.path')
        if [[ -d "$path" ]]; then
          jq --arg id "$id" --argjson val "$value" '.projects[$id] = $val' "$final_file" > "${final_file}.tmp"
          mv "${final_file}.tmp" "$final_file"
        else
          log_info "Removed stale: $path"
        fi
      done

      mv "$final_file" "$SPECKIT_REGISTRY"
      log_success "Registry cleaned"
      ;;

    path)
      echo "$SPECKIT_REGISTRY"
      ;;

    *)
      log_error "Unknown registry command: $subcommand"
      echo "Usage: speckit state registry [list|sync|clean|path]"
      exit 1
      ;;
  esac
}

# Archive completed phase and reset for next phase
cmd_archive() {
  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    exit 1
  fi

  # Check if there's a current phase to archive
  local phase_number
  phase_number=$(json_get "$state_file" ".orchestration.phase.number" 2>/dev/null || echo "")

  if [[ -z "$phase_number" || "$phase_number" == "null" ]]; then
    log_warn "No current phase to archive"
    if is_json_output; then
      echo '{"archived": false, "reason": "no_current_phase"}'
    fi
    exit 0
  fi

  local temp_file
  temp_file=$(mktemp)
  local timestamp
  timestamp="$(iso_timestamp)"

  # Archive current phase to history and reset orchestration
  jq --arg ts "$timestamp" '
    # Create archive entry from current phase
    .actions.history += [{
      "type": "phase_completed",
      "phase_number": .orchestration.phase.number,
      "phase_name": .orchestration.phase.name,
      "branch": .orchestration.phase.branch,
      "completed_at": $ts,
      "tasks_completed": .orchestration.progress.tasks_completed,
      "tasks_total": .orchestration.progress.tasks_total
    }] |

    # Reset orchestration for next phase
    .orchestration = {
      "phase": {
        "number": null,
        "name": null,
        "branch": null,
        "status": "not_started"
      },
      "step": {
        "current": null,
        "index": 0,
        "status": "not_started"
      },
      "progress": {
        "tasks_completed": 0,
        "tasks_total": 0,
        "percentage": 0
      }
    } |

    # Update health and timestamps
    .health.status = "ready" |
    .health.last_check = $ts |
    .project.updated_at = $ts
  ' "$state_file" > "$temp_file"

  if ! jq '.' "$temp_file" >/dev/null 2>&1; then
    log_error "Archive produced invalid JSON - aborting"
    rm "$temp_file"
    exit 1
  fi

  mv "$temp_file" "$state_file"

  log_success "Archived phase $phase_number and reset state"

  if is_json_output; then
    echo "{\"archived\": true, \"phase_number\": \"$phase_number\", \"timestamp\": \"$timestamp\"}"
  fi
}

# Migrate state file from v1.x to v2.0
cmd_migrate() {
  local state_file
  state_file="$(get_state_file)"
  local specify_dir
  specify_dir="$(get_specify_dir)"
  local repo_root
  repo_root="$(get_repo_root)"

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

  # Check current version (try schema_version first, then version)
  local schema_version
  schema_version=$(jq -r '.schema_version // ""' "$state_file" 2>/dev/null)
  local legacy_version
  legacy_version=$(jq -r '.version // "unknown"' "$state_file" 2>/dev/null)

  if [[ "$schema_version" == "2.0" ]]; then
    log_success "State file is already v2.0 - no migration needed"
    exit 0
  fi

  local source_version="${schema_version:-$legacy_version}"
  log_step "Migrating state file from v${source_version} to v2.0"

  # Create backup
  local backup_dir="${specify_dir}/backup"
  ensure_dir "$backup_dir"
  local backup_file="${backup_dir}/orchestration-state-${source_version}-$(date +%Y%m%d%H%M%S).json"
  cp "$state_file" "$backup_file"
  log_success "Created backup: $backup_file"

  # Generate new project ID for this migration
  local project_id
  project_id="$(generate_uuid)"
  local timestamp
  timestamp="$(iso_timestamp)"
  local project_name
  project_name="$(basename "$repo_root")"

  # Detect format and extract data
  local temp_file
  temp_file=$(mktemp)

  # Check if it's v1.0 format (version == "1.0" or config paths in .project)
  if [[ "$legacy_version" == "1.0" ]] || jq -e '.project.roadmap_path' "$state_file" >/dev/null 2>&1; then
    log_info "Detected v1.0 format (config in .project)"

    # Migrate v1.0 to v2.0
    jq --arg ts "$timestamp" \
       --arg id "$project_id" \
       --arg path "$repo_root" \
       --arg name "$project_name" '
      {
        "schema_version": "2.0",
        "project": {
          "id": $id,
          "name": (.project.name // $name),
          "path": $path,
          "description": (.project.description // null),
          "type": (.project.type // null),
          "criticality": (.project.criticality // null),
          "created_at": (.project.created_at // $ts),
          "updated_at": $ts
        },
        "config": {
          "roadmap_path": (.project.roadmap_path // "ROADMAP.md"),
          "memory_path": (.project.memory_path // ".specify/memory/"),
          "specs_path": (.project.specs_path // "specs/"),
          "scripts_path": (.project.scripts_path // ".specify/scripts/"),
          "templates_path": (.project.templates_path // ".specify/templates/")
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
        "orchestration": {
          "phase": {
            "number": (.orchestration.phase_number // null),
            "name": (.orchestration.phase_name // null),
            "branch": (.orchestration.branch // null),
            "status": (.orchestration.status // "not_started")
          },
          "step": {
            "current": (.orchestration.step // null),
            "index": 0,
            "status": "not_started"
          },
          "progress": {
            "tasks_completed": 0,
            "tasks_total": 0,
            "percentage": 0
          }
        },
        "health": {
          "status": "migrated",
          "last_check": $ts,
          "issues": []
        },
        "actions": {
          "available": [],
          "pending": [],
          "history": (.history // [])
        },
        "ui": {
          "last_sync": null,
          "notifications": []
        },
        "_migration": {
          "from_version": "1.0",
          "migrated_at": $ts
        }
      }
    ' "$state_file" > "$temp_file"

  elif jq -e '.config' "$state_file" >/dev/null 2>&1; then
    # Has .config but missing v2.0 sections
    log_info "Detected partial v2.0 format - adding missing sections"

    jq --arg ts "$timestamp" \
       --arg id "$project_id" \
       --arg path "$repo_root" \
       --arg name "$project_name" '
      {
        "schema_version": "2.0",
        "project": ((.project // {}) + {
          "id": (.project.id // $id),
          "path": (.project.path // $path),
          "name": (.project.name // $name),
          "created_at": (.project.created_at // $ts),
          "updated_at": $ts
        }),
        "config": (.config // {
          "roadmap_path": "ROADMAP.md",
          "memory_path": ".specify/memory/",
          "specs_path": "specs/",
          "scripts_path": ".specify/scripts/",
          "templates_path": ".specify/templates/"
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
        "orchestration": (
          if .orchestration.phase then .orchestration
          else {
            "phase": {
              "number": (.orchestration.phase_number // null),
              "name": (.orchestration.phase_name // null),
              "branch": (.orchestration.branch // null),
              "status": (.orchestration.status // "not_started")
            },
            "step": {
              "current": (.orchestration.step // null),
              "index": 0,
              "status": "not_started"
            },
            "progress": {
              "tasks_completed": 0,
              "tasks_total": 0,
              "percentage": 0
            }
          }
          end
        ),
        "health": (.health // {
          "status": "migrated",
          "last_check": $ts,
          "issues": []
        }),
        "actions": (.actions // {
          "available": [],
          "pending": [],
          "history": (.history // [])
        }),
        "ui": (.ui // {
          "last_sync": null,
          "notifications": []
        }),
        "_migration": {
          "from_version": (.version // "unknown"),
          "migrated_at": $ts
        }
      }
    ' "$state_file" > "$temp_file"

  else
    log_warn "Unknown state format - creating fresh v2.0 with preserved data"

    jq --arg ts "$timestamp" \
       --arg id "$project_id" \
       --arg path "$repo_root" \
       --arg name "$project_name" '
      {
        "schema_version": "2.0",
        "project": {
          "id": $id,
          "name": $name,
          "path": $path,
          "description": null,
          "type": null,
          "criticality": null,
          "created_at": $ts,
          "updated_at": $ts
        },
        "config": {
          "roadmap_path": "ROADMAP.md",
          "memory_path": ".specify/memory/",
          "specs_path": "specs/",
          "scripts_path": ".specify/scripts/",
          "templates_path": ".specify/templates/"
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
          "phase": { "number": null, "name": null, "branch": null, "status": "not_started" },
          "step": { "current": null, "index": 0, "status": "not_started" },
          "progress": { "tasks_completed": 0, "tasks_total": 0, "percentage": 0 }
        },
        "health": { "status": "migrated", "last_check": $ts, "issues": [] },
        "actions": { "available": [], "pending": [], "history": [] },
        "ui": { "last_sync": null, "notifications": [] },
        "_migration": { "from_version": "unknown", "migrated_at": $ts },
        "_preserved_data": .
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

  # Register project in central registry
  local final_id
  final_id=$(jq -r '.project.id' "$state_file")
  local final_name
  final_name=$(jq -r '.project.name' "$state_file")
  register_project "$final_id" "$repo_root" "$final_name"

  log_success "Migration complete!"
  log_info "Migrated: v${source_version} → v2.0"
  log_info "Project ID: $final_id"
  log_info "Backup: $backup_file"

  if is_json_output; then
    echo "{\"migrated\": true, \"from\": \"$source_version\", \"to\": \"2.0\", \"project_id\": \"$final_id\", \"backup\": \"$backup_file\"}"
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
    archive)
      cmd_archive
      ;;
    registry)
      cmd_registry "${1:-list}"
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
