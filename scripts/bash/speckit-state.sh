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

    infer               Infer orchestration state from file existence
                        Checks for spec.md, plan.md, tasks.md
                        Counts completed tasks
                        Use --apply to update state file

    rollback [file]     Rollback state to a backup
                        Lists available backups if no file specified
                        Creates backup of current state before rollback

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
    log_info "After 'speckit state archive', use 'speckit state set' to configure the next phase"
    log_info "To completely reinitialize, use 'speckit state init --force'"
    if ! confirm "Overwrite existing state file?"; then
      log_info "Keeping existing state file. Use 'speckit state set' to update values."
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
    log_info "Nothing to reset. Use 'speckit state init' to create a new state file."
    exit 1
  fi

  if [[ "$full_reset" == "--full" ]]; then
    # Full reset - recreate entirely
    if ! confirm "This will reset ALL state including config. Continue?"; then
      log_info "Reset cancelled. State file unchanged."
      exit 0
    fi
    cmd_init --force
  else
    # Partial reset - keep project and config, reset interview and orchestration
    if ! confirm "Reset interview and orchestration state (project/config preserved)?"; then
      log_info "Reset cancelled. State file unchanged."
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
    log_info "Run 'speckit state init' to create one"
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
        # Three-Line Rule: Summary first
        local project_count
        project_count=$(jq '.projects | length' "$SPECKIT_REGISTRY" 2>/dev/null || echo "0")
        echo -e "${BLUE}INFO${RESET}: $project_count registered project(s)"
        echo ""
        # Details (line 3+)
        jq -r '.projects | to_entries[] | "  \(.value.name) (\(.key | .[0:8])...)\n    \(.value.path)"' "$SPECKIT_REGISTRY" 2>/dev/null || echo "  (none)"
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
    log_info "Run 'speckit state init' to create one, or 'speckit scaffold' for a new project"
    exit 1
  fi

  # Check if there's a current phase to archive
  local phase_number
  phase_number=$(json_get "$state_file" ".orchestration.phase.number" 2>/dev/null || echo "")

  if [[ -z "$phase_number" || "$phase_number" == "null" ]]; then
    log_warn "No current phase to archive (orchestration.phase.number is not set)"
    log_info "Use 'speckit state set orchestration.phase.number=NNN' to set a phase first"
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
  log_info "Next steps:"
  log_info "  1. Create new branch: git checkout -b NNN-feature-name"
  log_info "  2. Configure phase: speckit state set \"orchestration.phase.number=NNN\""
  log_info "  3. Update roadmap: speckit roadmap update NNN in_progress"

  if is_json_output; then
    echo "{\"archived\": true, \"phase_number\": \"$phase_number\", \"timestamp\": \"$timestamp\"}"
  fi
}

# =============================================================================
# V1 Discovery Detection
# =============================================================================

# Detect and parse v1 interview state from discovery files
detect_v1_discovery() {
  local repo_root
  repo_root="$(get_repo_root)"
  local discovery_dir="${repo_root}/.specify/discovery"

  # Check if discovery directory exists
  if [[ ! -d "$discovery_dir" ]]; then
    echo '{"found": false}'
    return
  fi

  local has_state=false
  local has_decisions=false
  local has_context=false
  local current_phase=0
  local decisions_count=0
  local status="not_started"
  local paused_at=""

  # Check for state.md
  if [[ -f "${discovery_dir}/state.md" ]]; then
    has_state=true
    # Parse state.md for phase info
    local state_content
    state_content=$(cat "${discovery_dir}/state.md")

    # Try to extract current phase
    if echo "$state_content" | grep -qiE 'current.*phase|phase.*[0-9]+'; then
      current_phase=$(echo "$state_content" | grep -oE 'phase[^0-9]*([0-9]+)' -i | grep -oE '[0-9]+' | head -1 || echo "0")
    fi

    # Check if paused
    if echo "$state_content" | grep -qiE 'paused|status.*paused'; then
      status="paused"
      paused_at=$(echo "$state_content" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || echo "")
    elif [[ $current_phase -gt 0 ]]; then
      status="in_progress"
    fi
  fi

  # Check for decisions.md
  if [[ -f "${discovery_dir}/decisions.md" ]]; then
    has_decisions=true
    # Count decisions (look for decision markers)
    decisions_count=$(grep -cE '^\s*[-*]\s*\*\*|^###.*Decision|^##.*Decision' "${discovery_dir}/decisions.md" 2>/dev/null || echo "0")
    if [[ $decisions_count -eq 0 ]]; then
      # Try counting list items as fallback
      decisions_count=$(grep -cE '^\s*[-*]\s+[A-Z]' "${discovery_dir}/decisions.md" 2>/dev/null || echo "0")
    fi
  fi

  # Check for context.md
  if [[ -f "${discovery_dir}/context.md" ]]; then
    has_context=true
  fi

  # Determine overall status
  if [[ "$has_state" == "true" || "$has_decisions" == "true" ]]; then
    if [[ "$status" == "not_started" && "$decisions_count" -gt 0 ]]; then
      status="in_progress"
    fi
  fi

  cat << EOF
{
  "found": true,
  "files": {
    "state_md": $has_state,
    "decisions_md": $has_decisions,
    "context_md": $has_context
  },
  "interview": {
    "status": "$status",
    "current_phase": $current_phase,
    "decisions_count": $decisions_count,
    "paused_at": $(if [[ -n "$paused_at" ]]; then echo "\"$paused_at\""; else echo "null"; fi)
  }
}
EOF
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

  # Check for v1 discovery files (interview state in markdown)
  local v1_discovery
  v1_discovery=$(detect_v1_discovery)
  local has_v1_discovery=false
  local v1_interview_status="not_started"
  local v1_current_phase=0
  local v1_decisions_count=0

  if echo "$v1_discovery" | jq -e '.found == true' >/dev/null 2>&1; then
    has_v1_discovery=true
    v1_interview_status=$(echo "$v1_discovery" | jq -r '.interview.status')
    v1_current_phase=$(echo "$v1_discovery" | jq -r '.interview.current_phase')
    v1_decisions_count=$(echo "$v1_discovery" | jq -r '.interview.decisions_count')

    log_info "Found v1 discovery files:"
    log_info "  Interview status: $v1_interview_status"
    log_info "  Current phase: $v1_current_phase"
    log_info "  Decisions: $v1_decisions_count"
    log_info "  Discovery files will be preserved and state incorporated"
  fi

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
       --arg name "$project_name" \
       --arg v1_status "$v1_interview_status" \
       --argjson v1_phase "$v1_current_phase" \
       --argjson v1_decisions "$v1_decisions_count" \
       --argjson has_v1 "$has_v1_discovery" '
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
        "interview": (
          # Merge existing interview with v1 discovery if found
          if $has_v1 then
            (.interview // {}) * {
              "status": (if $v1_status != "not_started" then $v1_status else (.interview.status // "not_started") end),
              "current_phase": (if $v1_phase > 0 then $v1_phase else (.interview.current_phase // 0) end),
              "current_question": (.interview.current_question // 0),
              "decisions_count": (if $v1_decisions > 0 then $v1_decisions else (.interview.decisions_count // 0) end),
              "phases": (.interview.phases // {}),
              "started_at": (.interview.started_at // null),
              "completed_at": (.interview.completed_at // null),
              "v1_discovery_imported": true
            }
          else
            (.interview // {
              "status": "not_started",
              "current_phase": 0,
              "current_question": 0,
              "decisions_count": 0,
              "phases": {},
              "started_at": null,
              "completed_at": null
            })
          end
        ),
        "orchestration": {
          "phase": {
            "number": (.current.phase_number // null),
            "name": (.current.phase_name // null),
            "branch": (.current.branch // null),
            "status": (.current.status // "not_started")
          },
          "step": {
            "current": (.current.step // null),
            "index": (.current.step_index // 0),
            "status": (if .current.step then (.current.status // "in_progress") else "not_started" end)
          },
          "progress": {
            "tasks_completed": (.steps.implement.tasks_completed // 0),
            "tasks_total": (.steps.implement.tasks_total // 0),
            "current_task": (.steps.implement.current_task // null),
            "percentage": (if (.steps.implement.tasks_total // 0) > 0 then (((.steps.implement.tasks_completed // 0) * 100) / (.steps.implement.tasks_total // 1)) else 0 end)
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
          "migrated_at": $ts,
          "v1_steps": (.steps // null),
          "v1_pending_questions": (.pending_questions // null)
        }
      }
    ' "$state_file" > "$temp_file"

  elif jq -e '.config' "$state_file" >/dev/null 2>&1; then
    # Has .config but missing v2.0 sections
    log_info "Detected partial v2.0 format - adding missing sections"

    jq --arg ts "$timestamp" \
       --arg id "$project_id" \
       --arg path "$repo_root" \
       --arg name "$project_name" \
       --arg v1_status "$v1_interview_status" \
       --argjson v1_phase "$v1_current_phase" \
       --argjson v1_decisions "$v1_decisions_count" \
       --argjson has_v1 "$has_v1_discovery" '
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
        "interview": (
          if $has_v1 then
            (.interview // {}) * {
              "status": (if $v1_status != "not_started" then $v1_status else (.interview.status // "not_started") end),
              "current_phase": (if $v1_phase > 0 then $v1_phase else (.interview.current_phase // 0) end),
              "current_question": (.interview.current_question // 0),
              "decisions_count": (if $v1_decisions > 0 then $v1_decisions else (.interview.decisions_count // 0) end),
              "phases": (.interview.phases // {}),
              "started_at": (.interview.started_at // null),
              "completed_at": (.interview.completed_at // null),
              "v1_discovery_imported": true
            }
          else
            (.interview // {
              "status": "not_started",
              "current_phase": 0,
              "current_question": 0,
              "decisions_count": 0,
              "phases": {},
              "started_at": null,
              "completed_at": null
            })
          end
        ),
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
       --arg name "$project_name" \
       --arg v1_status "$v1_interview_status" \
       --argjson v1_phase "$v1_current_phase" \
       --argjson v1_decisions "$v1_decisions_count" \
       --argjson has_v1 "$has_v1_discovery" '
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
        "interview": (
          if $has_v1 then
            {
              "status": $v1_status,
              "current_phase": $v1_phase,
              "current_question": 0,
              "decisions_count": $v1_decisions,
              "phases": {},
              "started_at": null,
              "completed_at": null,
              "v1_discovery_imported": true
            }
          else
            {
              "status": "not_started",
              "current_phase": 0,
              "current_question": 0,
              "decisions_count": 0,
              "phases": {},
              "started_at": null,
              "completed_at": null
            }
          end
        ),
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

  # Initialize or update manifest if not exists
  local manifest_script="${SCRIPT_DIR}/speckit-manifest.sh"
  local manifest_file="${specify_dir}/manifest.json"
  if [[ -f "$manifest_script" ]]; then
    if [[ ! -f "$manifest_file" ]]; then
      # Initialize manifest for first time
      bash "$manifest_script" init 2>/dev/null || true
      log_info "Created version manifest"
    else
      # Record the migration in manifest
      local migration_timestamp
      migration_timestamp="$(iso_timestamp)"
      local migration_entry
      migration_entry=$(jq -n \
        --arg from "$source_version" \
        --arg to "2.0" \
        --arg at "$migration_timestamp" \
        '{"from": $from, "to": $to, "target": "state", "migrated_at": $at}')

      # Append to migrations array
      local manifest_temp
      manifest_temp=$(mktemp)
      if jq --argjson entry "$migration_entry" '.migrations += [$entry]' "$manifest_file" > "$manifest_temp" 2>/dev/null; then
        mv "$manifest_temp" "$manifest_file"
        log_info "Recorded migration in manifest"
      else
        rm -f "$manifest_temp"
      fi
    fi
  fi

  log_success "Migration complete!"
  log_info "Migrated: v${source_version} → v2.0"
  log_info "Project ID: $final_id"
  log_info "Backup: $backup_file"

  if is_json_output; then
    echo "{\"migrated\": true, \"from\": \"$source_version\", \"to\": \"2.0\", \"project_id\": \"$final_id\", \"backup\": \"$backup_file\"}"
  fi
}

# =============================================================================
# Infer State from Files
# =============================================================================

# Infer orchestration state from file existence
cmd_infer() {
  local apply="${1:-false}"
  local state_file
  state_file="$(get_state_file)"
  local repo_root
  repo_root="$(get_repo_root)"

  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found. Run 'speckit state init' first."
    exit 1
  fi

  log_step "Inferring state from files"

  # Get current phase from state or detect from specs directory
  local current_phase
  current_phase=$(jq -r '.orchestration.phase.number // empty' "$state_file" 2>/dev/null)

  # If no phase in state, try to detect from specs directory
  if [[ -z "$current_phase" || "$current_phase" == "null" ]]; then
    # Check if specs directory exists
    if [[ ! -d "${repo_root}/specs" ]]; then
      log_info "No specs/ directory found"
      if is_json_output; then
        echo '{"phase": null, "inferred": {}, "message": "no_specs_directory"}'
      else
        echo ""
        log_info "No specs/ directory - nothing to infer"
      fi
      return 0
    fi

    # Find most recent phase directory
    local latest_phase_dir
    latest_phase_dir=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "[0-9][0-9][0-9]-*" 2>/dev/null | sort -r | head -1)
    if [[ -n "$latest_phase_dir" ]]; then
      current_phase=$(basename "$latest_phase_dir" | grep -oE '^[0-9]{3}')
      log_info "Detected phase from specs: $current_phase"
    else
      log_info "No phase directories found in specs/"
      if is_json_output; then
        echo '{"phase": null, "inferred": {}, "message": "no_phases"}'
      else
        echo ""
        log_info "No phase directories - nothing to infer"
      fi
      return 0
    fi
  fi

  # Find the phase directory
  local phase_dir
  phase_dir=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "${current_phase}-*" 2>/dev/null | head -1)

  if [[ -z "$phase_dir" ]]; then
    log_warn "Phase directory not found for phase $current_phase"
    if is_json_output; then
      echo "{\"phase\": \"$current_phase\", \"inferred\": {}, \"error\": \"phase_dir_not_found\"}"
    fi
    return
  fi

  local phase_name
  phase_name=$(basename "$phase_dir")

  # Infer step completion from file existence
  local spec_exists=false
  local plan_exists=false
  local tasks_exists=false
  local checklists_exist=false
  local tasks_completed=0
  local tasks_total=0

  [[ -f "${phase_dir}/spec.md" ]] && spec_exists=true
  [[ -f "${phase_dir}/plan.md" ]] && plan_exists=true
  [[ -f "${phase_dir}/tasks.md" ]] && tasks_exists=true
  [[ -d "${phase_dir}/checklists" ]] && checklists_exist=true

  # Count tasks if tasks.md exists
  if [[ "$tasks_exists" == "true" ]]; then
    tasks_completed=$(grep -c '^\s*- \[x\]' "${phase_dir}/tasks.md" 2>/dev/null || echo "0")
    tasks_total=$(grep -c '^\s*- \[' "${phase_dir}/tasks.md" 2>/dev/null || echo "0")
  fi

  # Determine inferred step
  local inferred_step="specify"
  local inferred_step_status="pending"

  if [[ "$spec_exists" == "true" ]]; then
    inferred_step="plan"
    if [[ "$plan_exists" == "true" ]]; then
      inferred_step="tasks"
      if [[ "$tasks_exists" == "true" ]]; then
        inferred_step="implement"
        if [[ "$tasks_total" -gt 0 && "$tasks_completed" -eq "$tasks_total" ]]; then
          inferred_step="verify"
          inferred_step_status="pending"
        elif [[ "$tasks_completed" -gt 0 ]]; then
          inferred_step_status="in_progress"
        else
          inferred_step_status="pending"
        fi
      fi
    fi
  fi

  # Calculate percentage
  local percentage=0
  if [[ "$tasks_total" -gt 0 ]]; then
    percentage=$((tasks_completed * 100 / tasks_total))
  fi

  # Build inferred state object
  local inferred_json
  inferred_json=$(cat << EOF
{
  "phase": {
    "number": "$current_phase",
    "name": "$phase_name",
    "detected": true
  },
  "files": {
    "spec_md": $spec_exists,
    "plan_md": $plan_exists,
    "tasks_md": $tasks_exists,
    "checklists": $checklists_exist
  },
  "progress": {
    "tasks_completed": $tasks_completed,
    "tasks_total": $tasks_total,
    "percentage": $percentage
  },
  "inferred_step": "$inferred_step",
  "inferred_status": "$inferred_step_status"
}
EOF
)

  if is_json_output; then
    echo "$inferred_json"
  else
    # Three-Line Rule: Summary first
    echo -e "${BLUE}INFO${RESET}: Phase $current_phase ($phase_name)"
    echo "  Progress: $tasks_completed/$tasks_total ($percentage%), Step: $inferred_step"
    echo ""
    # Details (line 4+)
    echo "Files:"
    [[ "$spec_exists" == "true" ]] && print_status ok "spec.md" || print_status pending "spec.md (missing)"
    [[ "$plan_exists" == "true" ]] && print_status ok "plan.md" || print_status pending "plan.md (missing)"
    [[ "$tasks_exists" == "true" ]] && print_status ok "tasks.md" || print_status pending "tasks.md (missing)"
    [[ "$checklists_exist" == "true" ]] && print_status ok "checklists/" || print_status pending "checklists/ (missing)"
  fi

  # Apply to state file if requested
  if [[ "$apply" == "--apply" || "$apply" == "-a" ]]; then
    echo ""
    log_step "Applying inferred state"

    local temp_file
    temp_file=$(mktemp)

    jq --arg phase "$current_phase" \
       --arg name "$phase_name" \
       --arg step "$inferred_step" \
       --arg status "$inferred_step_status" \
       --argjson completed "$tasks_completed" \
       --argjson total "$tasks_total" \
       --argjson pct "$percentage" \
       --arg ts "$(iso_timestamp)" \
       '.orchestration.phase.number = $phase |
        .orchestration.phase.name = $name |
        .orchestration.phase.status = "in_progress" |
        .orchestration.step.current = $step |
        .orchestration.step.status = $status |
        .orchestration.progress.tasks_completed = $completed |
        .orchestration.progress.tasks_total = $total |
        .orchestration.progress.percentage = $pct |
        .last_updated = $ts' "$state_file" > "$temp_file"

    mv "$temp_file" "$state_file"
    log_success "State updated from file system"
  else
    if ! is_json_output; then
      echo ""
      log_info "Run 'speckit state infer --apply' to update state file"
    fi
  fi
}

# =============================================================================
# Rollback State
# =============================================================================

# Rollback state to a backup
cmd_rollback() {
  local backup_file="${1:-}"
  local state_file
  state_file="$(get_state_file)"
  local repo_root
  repo_root="$(get_repo_root)"
  local backup_dir="${repo_root}/.specify/backup"

  # If no backup specified, list available backups
  if [[ -z "$backup_file" ]]; then
    if [[ ! -d "$backup_dir" ]]; then
      log_info "No backup directory found at $backup_dir"
      if is_json_output; then
        echo '{"backups": [], "message": "no_backup_directory"}'
      fi
      return 0
    fi

    local backups
    backups=$(find "$backup_dir" -name "*.json" -type f 2>/dev/null | sort -r)

    if [[ -z "$backups" ]]; then
      log_info "No backup files found"
      if is_json_output; then
        echo '{"backups": [], "message": "no_backups"}'
      fi
      return 0
    fi

    if is_json_output; then
      local backup_json="[]"
      while IFS= read -r file; do
        local filename size date_str
        filename=$(basename "$file")
        size=$(wc -c < "$file" | tr -d ' ')
        date_str=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d'.' -f1)
        backup_json=$(echo "$backup_json" | jq \
          --arg file "$filename" \
          --arg path "$file" \
          --argjson size "$size" \
          --arg date "$date_str" \
          '. + [{"file": $file, "path": $path, "size": $size, "date": $date}]')
      done <<< "$backups"
      echo "{\"backups\": $backup_json}"
    else
      # Three-Line Rule: Count backups first
      local backup_count
      backup_count=$(echo "$backups" | wc -l | tr -d ' ')
      echo -e "${BLUE}INFO${RESET}: $backup_count backup(s) available"
      echo ""
      # Details (line 3+)
      local count=0
      while IFS= read -r file; do
        ((count++)) || true
        local filename size date_str
        filename=$(basename "$file")
        size=$(wc -c < "$file" | tr -d ' ')
        date_str=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d'.' -f1)
        printf "  %d. %s (%s bytes, %s)\n" "$count" "$filename" "$size" "$date_str"
      done <<< "$backups"
      echo ""
      echo "To rollback: speckit state rollback <filename>"
    fi
    return 0
  fi

  # Find the backup file
  local full_path
  if [[ -f "$backup_file" ]]; then
    full_path="$backup_file"
  elif [[ -f "${backup_dir}/${backup_file}" ]]; then
    full_path="${backup_dir}/${backup_file}"
  else
    log_error "Backup file not found: $backup_file"
    exit 1
  fi

  # Validate the backup file is valid JSON
  if ! jq '.' "$full_path" >/dev/null 2>&1; then
    log_error "Backup file is not valid JSON: $full_path"
    exit 1
  fi

  # Create backup of current state before rollback
  if [[ -f "$state_file" ]]; then
    ensure_dir "$backup_dir"
    local pre_rollback_backup="${backup_dir}/pre-rollback-$(date +%Y%m%d%H%M%S).json"
    cp "$state_file" "$pre_rollback_backup"
    log_info "Created pre-rollback backup: $(basename "$pre_rollback_backup")"
  fi

  # Perform rollback
  cp "$full_path" "$state_file"
  log_success "Rolled back to: $(basename "$full_path")"

  # Show what was restored
  if ! is_json_output; then
    echo ""
    log_info "Restored state:"
    local version
    version=$(jq -r '.schema_version // .version // "unknown"' "$state_file" 2>/dev/null)
    echo "  Version: $version"

    local interview_status orch_status
    interview_status=$(jq -r '.interview.status // "unknown"' "$state_file" 2>/dev/null)
    orch_status=$(jq -r '.orchestration.status // .orchestration.phase.status // "unknown"' "$state_file" 2>/dev/null)
    echo "  Interview: $interview_status"
    echo "  Orchestration: $orch_status"
  else
    echo "{\"rolledBack\": true, \"from\": \"$(basename "$full_path")\"}"
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
    infer)
      cmd_infer "${1:-}"
      ;;
    rollback)
      cmd_rollback "${1:-}"
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
