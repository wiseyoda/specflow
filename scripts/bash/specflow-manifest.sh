#!/usr/bin/env bash
#
# specflow-manifest.sh - Centralized version manifest management
#
# The manifest (.specify/manifest.json) is the single source of truth for
# all version information in a SpecFlow project.
#
# Usage:
#   specflow manifest init              Initialize manifest for project
#   specflow manifest get [key]         Get manifest value(s)
#   specflow manifest set <key> <val>   Set manifest value
#   specflow manifest validate          Validate manifest and compatibility
#   specflow manifest upgrade           Check for and apply upgrades
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Version Constants - SINGLE SOURCE OF TRUTH
# =============================================================================

# Current versions - update these when releasing new versions
readonly SPECFLOW_VERSION="2.1.0"
readonly STATE_SCHEMA_VERSION="2.0"
readonly ROADMAP_FORMAT_VERSION="2.1"
readonly COMMANDS_VERSION="2.0"
readonly MANIFEST_SCHEMA_VERSION="1.0"

# Minimum compatible versions
readonly MIN_CLI_VERSION="2.0.0"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
specflow manifest - Centralized version manifest management

USAGE:
    specflow manifest <command> [options]

COMMANDS:
    init                Initialize manifest for project
    get [key]           Get manifest value (or all if no key)
    set <key> <value>   Set manifest value
    validate            Validate manifest and check compatibility
    upgrade             Check for and apply available upgrades
    status              Show version status summary

OPTIONS:
    --force             Overwrite existing manifest (init)
    --json              Output in JSON format
    -h, --help          Show this help

MANIFEST KEYS:
    specflow_version     SpecFlow system version
    state_schema        State file schema version
    roadmap_format      ROADMAP.md format version
    commands_version    Slash commands version
    min_cli             Minimum compatible CLI version

EXAMPLES:
    specflow manifest init               # Create manifest
    specflow manifest get                # Show all versions
    specflow manifest get roadmap_format # Get specific version
    specflow manifest validate           # Check compatibility
    specflow manifest upgrade            # Apply upgrades

VERSION HISTORY:
    2.1.0 - Added manifest system, 4-digit phases
    2.0.0 - Initial v2 release with web UI support
EOF
}

# =============================================================================
# Helpers
# =============================================================================

get_manifest_path() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/.specify/manifest.json"
}

manifest_exists() {
  local manifest_path
  manifest_path="$(get_manifest_path)"
  [[ -f "$manifest_path" ]]
}

# Compare semantic versions: returns 0 if v1 >= v2, 1 otherwise
version_gte() {
  local v1="$1"
  local v2="$2"

  # Handle empty versions
  [[ -z "$v1" ]] && return 1
  [[ -z "$v2" ]] && return 0

  # Split into components
  local v1_major v1_minor v1_patch
  local v2_major v2_minor v2_patch

  IFS='.' read -r v1_major v1_minor v1_patch <<< "$v1"
  IFS='.' read -r v2_major v2_minor v2_patch <<< "$v2"

  # Default to 0 if missing
  v1_major=${v1_major:-0}
  v1_minor=${v1_minor:-0}
  v1_patch=${v1_patch:-0}
  v2_major=${v2_major:-0}
  v2_minor=${v2_minor:-0}
  v2_patch=${v2_patch:-0}

  # Compare
  if [[ $v1_major -gt $v2_major ]]; then return 0; fi
  if [[ $v1_major -lt $v2_major ]]; then return 1; fi
  if [[ $v1_minor -gt $v2_minor ]]; then return 0; fi
  if [[ $v1_minor -lt $v2_minor ]]; then return 1; fi
  if [[ $v1_patch -ge $v2_patch ]]; then return 0; fi
  return 1
}

# Get current date in ISO format
get_iso_date() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# =============================================================================
# Commands
# =============================================================================

cmd_init() {
  local force=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force) force=true; shift ;;
      *) shift ;;
    esac
  done

  local manifest_path
  manifest_path="$(get_manifest_path)"
  local repo_root
  repo_root="$(get_repo_root)"

  # Check if .specify exists
  if [[ ! -d "${repo_root}/.specify" ]]; then
    log_error ".specify/ directory not found"
    log_info "Run 'specflow scaffold' first to initialize project"
    exit 1
  fi

  # Check existing manifest
  if [[ -f "$manifest_path" ]] && [[ "$force" != "true" ]]; then
    log_warn "Manifest already exists: $manifest_path"
    log_info "Use --force to overwrite"
    exit 1
  fi

  # Detect current versions from existing files
  local detected_state_version="$STATE_SCHEMA_VERSION"
  local detected_roadmap_version="$ROADMAP_FORMAT_VERSION"

  # Check state file for schema version
  local state_file="${repo_root}/.specify/orchestration-state.json"
  if [[ -f "$state_file" ]]; then
    detected_state_version=$(jq -r '.schema_version // "2.0"' "$state_file" 2>/dev/null || echo "2.0")
  fi

  # Check ROADMAP format
  local roadmap_file="${repo_root}/ROADMAP.md"
  if [[ -f "$roadmap_file" ]]; then
    if grep -qE '^\|\s*[0-9]{4}\s*\|' "$roadmap_file" 2>/dev/null; then
      detected_roadmap_version="2.1"
    elif grep -qE '^\|\s*[0-9]{3}\s*\|' "$roadmap_file" 2>/dev/null; then
      detected_roadmap_version="2.0"
    fi
  fi

  # Create manifest
  local now
  now="$(get_iso_date)"

  cat > "$manifest_path" << EOF
{
  "manifest_schema": "${MANIFEST_SCHEMA_VERSION}",
  "specflow_version": "${SPECFLOW_VERSION}",
  "schema": {
    "state": "${detected_state_version}",
    "roadmap": "${detected_roadmap_version}",
    "commands": "${COMMANDS_VERSION}"
  },
  "compatibility": {
    "min_cli": "${MIN_CLI_VERSION}",
    "created_with": "${SPECFLOW_VERSION}",
    "created_at": "${now}"
  },
  "migrations": []
}
EOF

  log_success "Created manifest: $manifest_path"

  if is_json_output; then
    cat "$manifest_path"
  else
    echo ""
    echo "Detected versions:"
    echo "  State schema:    $detected_state_version"
    echo "  ROADMAP format:  $detected_roadmap_version"
    echo "  Commands:        $COMMANDS_VERSION"
  fi
}

cmd_get() {
  local key="${1:-}"

  local manifest_path
  manifest_path="$(get_manifest_path)"

  if [[ ! -f "$manifest_path" ]]; then
    log_error "Manifest not found: $manifest_path"
    log_info "Run 'specflow manifest init' to create"
    exit 1
  fi

  if [[ -z "$key" ]]; then
    # Return entire manifest
    if is_json_output; then
      cat "$manifest_path"
    else
      echo "SpecFlow Manifest"
      echo "================"
      echo ""
      echo "Core Version:     $(jq -r '.specflow_version' "$manifest_path")"
      echo ""
      echo "Schema Versions:"
      echo "  State:          $(jq -r '.schema.state' "$manifest_path")"
      echo "  ROADMAP:        $(jq -r '.schema.roadmap' "$manifest_path")"
      echo "  Commands:       $(jq -r '.schema.commands' "$manifest_path")"
      echo ""
      echo "Compatibility:"
      echo "  Min CLI:        $(jq -r '.compatibility.min_cli' "$manifest_path")"
      echo "  Created with:   $(jq -r '.compatibility.created_with' "$manifest_path")"
      echo "  Created at:     $(jq -r '.compatibility.created_at' "$manifest_path")"

      local migration_count
      migration_count=$(jq '.migrations | length' "$manifest_path")
      if [[ "$migration_count" -gt 0 ]]; then
        echo ""
        echo "Migrations: $migration_count applied"
      fi
    fi
  else
    # Get specific key
    local value
    case "$key" in
      specflow_version|specflow)
        value=$(jq -r '.specflow_version' "$manifest_path")
        ;;
      state_schema|state)
        value=$(jq -r '.schema.state' "$manifest_path")
        ;;
      roadmap_format|roadmap)
        value=$(jq -r '.schema.roadmap' "$manifest_path")
        ;;
      commands_version|commands)
        value=$(jq -r '.schema.commands' "$manifest_path")
        ;;
      min_cli)
        value=$(jq -r '.compatibility.min_cli' "$manifest_path")
        ;;
      *)
        # Try direct jq path
        value=$(jq -r ".$key // empty" "$manifest_path" 2>/dev/null || echo "")
        ;;
    esac

    if [[ -z "$value" || "$value" == "null" ]]; then
      log_error "Unknown key: $key"
      exit 1
    fi

    echo "$value"
  fi
}

cmd_set() {
  local key="${1:-}"
  local value="${2:-}"

  # Support both "key=value" and "key value" formats
  if [[ -z "$value" && "$key" == *"="* ]]; then
    value="${key#*=}"
    key="${key%%=*}"
  fi

  if [[ -z "$key" || -z "$value" ]]; then
    log_error "Usage: specflow manifest set <key>=<value> or <key> <value>"
    exit 1
  fi

  local manifest_path
  manifest_path="$(get_manifest_path)"

  if [[ ! -f "$manifest_path" ]]; then
    log_error "Manifest not found: $manifest_path"
    log_info "Run 'specflow manifest init' to create"
    exit 1
  fi

  # Map friendly names to paths
  local jq_path
  case "$key" in
    specflow_version|specflow)
      jq_path=".specflow_version"
      ;;
    state_schema|state)
      jq_path=".schema.state"
      ;;
    roadmap_format|roadmap)
      jq_path=".schema.roadmap"
      ;;
    commands_version|commands)
      jq_path=".schema.commands"
      ;;
    min_cli)
      jq_path=".compatibility.min_cli"
      ;;
    *)
      log_error "Unknown key: $key"
      log_info "Valid keys: specflow_version, state_schema, roadmap_format, commands_version, min_cli"
      exit 1
      ;;
  esac

  # Update manifest
  local temp_file
  temp_file=$(mktemp)
  jq "$jq_path = \"$value\"" "$manifest_path" > "$temp_file"
  mv "$temp_file" "$manifest_path"

  log_success "Set $key = $value"
}

cmd_validate() {
  local manifest_path
  manifest_path="$(get_manifest_path)"
  local repo_root
  repo_root="$(get_repo_root)"

  local issues=()
  local warnings=()

  log_step "Validating manifest"

  # Check manifest exists
  if [[ ! -f "$manifest_path" ]]; then
    log_error "Manifest not found: $manifest_path"
    log_info "Run 'specflow manifest init' to create"
    exit 1
  fi

  # Validate JSON syntax
  if ! jq '.' "$manifest_path" >/dev/null 2>&1; then
    log_error "Invalid JSON in manifest"
    exit 1
  fi
  print_status ok "Valid JSON syntax"

  # Check manifest schema version
  local manifest_schema
  manifest_schema=$(jq -r '.manifest_schema // ""' "$manifest_path")
  if [[ -z "$manifest_schema" ]]; then
    warnings+=("Missing manifest_schema field")
    print_status warn "Missing manifest_schema"
  else
    print_status ok "Manifest schema: $manifest_schema"
  fi

  # Check CLI compatibility
  local min_cli
  min_cli=$(jq -r '.compatibility.min_cli // ""' "$manifest_path")
  if [[ -n "$min_cli" ]]; then
    if version_gte "$SPECFLOW_VERSION" "$min_cli"; then
      print_status ok "CLI compatible (${SPECFLOW_VERSION} >= ${min_cli})"
    else
      issues+=("CLI version $SPECFLOW_VERSION < required $min_cli")
      print_status error "CLI too old: ${SPECFLOW_VERSION} < ${min_cli}"
    fi
  fi

  # Validate state schema matches actual state file
  local manifest_state_version
  manifest_state_version=$(jq -r '.schema.state // ""' "$manifest_path")
  local state_file="${repo_root}/.specify/orchestration-state.json"

  if [[ -f "$state_file" ]]; then
    local actual_state_version
    actual_state_version=$(jq -r '.schema_version // ""' "$state_file" 2>/dev/null || echo "")

    if [[ "$manifest_state_version" == "$actual_state_version" ]]; then
      print_status ok "State schema: $manifest_state_version (matches)"
    elif [[ -z "$actual_state_version" ]]; then
      warnings+=("State file missing schema_version")
      print_status warn "State file missing schema_version"
    else
      issues+=("State schema mismatch: manifest=$manifest_state_version, file=$actual_state_version")
      print_status error "State schema mismatch: manifest=$manifest_state_version, file=$actual_state_version"
    fi
  else
    print_status pending "State file not found (not initialized yet)"
  fi

  # Validate ROADMAP format matches actual file
  local manifest_roadmap_version
  manifest_roadmap_version=$(jq -r '.schema.roadmap // ""' "$manifest_path")
  local roadmap_file="${repo_root}/ROADMAP.md"

  if [[ -f "$roadmap_file" ]]; then
    local actual_roadmap_version="unknown"
    if grep -qE '^\|\s*[0-9]{4}\s*\|' "$roadmap_file" 2>/dev/null; then
      actual_roadmap_version="2.1"
    elif grep -qE '^\|\s*[0-9]{3}\s*\|' "$roadmap_file" 2>/dev/null; then
      actual_roadmap_version="2.0"
    fi

    if [[ "$manifest_roadmap_version" == "$actual_roadmap_version" ]]; then
      print_status ok "ROADMAP format: $manifest_roadmap_version (matches)"
    elif [[ "$actual_roadmap_version" == "unknown" ]]; then
      print_status ok "ROADMAP format: $manifest_roadmap_version (no phases yet)"
    else
      issues+=("ROADMAP format mismatch: manifest=$manifest_roadmap_version, file=$actual_roadmap_version")
      print_status error "ROADMAP format mismatch: manifest=$manifest_roadmap_version, file=$actual_roadmap_version"
    fi
  else
    print_status pending "ROADMAP.md not found (not created yet)"
  fi

  # Check for available upgrades
  local current_version
  current_version=$(jq -r '.specflow_version // ""' "$manifest_path")
  if [[ -n "$current_version" ]]; then
    if version_gte "$SPECFLOW_VERSION" "$current_version"; then
      if [[ "$SPECFLOW_VERSION" != "$current_version" ]]; then
        warnings+=("Upgrade available: $current_version -> $SPECFLOW_VERSION")
        print_status warn "Upgrade available: $current_version -> $SPECFLOW_VERSION"
      else
        print_status ok "SpecFlow version: $current_version (current)"
      fi
    else
      warnings+=("Project uses newer SpecFlow: $current_version (CLI: $SPECFLOW_VERSION)")
      print_status warn "Project uses newer version: $current_version"
    fi
  fi

  # Summary
  echo ""
  if [[ ${#issues[@]} -eq 0 && ${#warnings[@]} -eq 0 ]]; then
    log_success "Manifest is valid and compatible"
    return 0
  elif [[ ${#issues[@]} -eq 0 ]]; then
    log_warn "${#warnings[@]} warning(s)"
    return 0
  else
    log_error "${#issues[@]} issue(s), ${#warnings[@]} warning(s)"
    return 1
  fi
}

cmd_upgrade() {
  local manifest_path
  manifest_path="$(get_manifest_path)"
  local repo_root
  repo_root="$(get_repo_root)"

  if [[ ! -f "$manifest_path" ]]; then
    log_error "Manifest not found: $manifest_path"
    log_info "Run 'specflow manifest init' to create"
    exit 1
  fi

  local current_version
  current_version=$(jq -r '.specflow_version // ""' "$manifest_path")

  log_step "Checking for upgrades"
  echo "Current version: $current_version"
  echo "Latest version:  $SPECFLOW_VERSION"
  echo ""

  if [[ "$current_version" == "$SPECFLOW_VERSION" ]]; then
    log_success "Already at latest version"
    return 0
  fi

  if ! version_gte "$SPECFLOW_VERSION" "$current_version"; then
    log_warn "Project uses newer SpecFlow ($current_version)"
    log_info "Update your SpecFlow installation first"
    return 1
  fi

  # Determine what needs upgrading
  local upgrades_needed=()

  # Check ROADMAP format
  local manifest_roadmap
  manifest_roadmap=$(jq -r '.schema.roadmap // ""' "$manifest_path")
  if [[ "$manifest_roadmap" == "2.0" ]]; then
    upgrades_needed+=("roadmap:2.0->2.1")
  fi

  if [[ ${#upgrades_needed[@]} -eq 0 ]]; then
    log_info "No schema upgrades needed"

    # Just update version
    record_migration "$current_version" "$SPECFLOW_VERSION" "Version bump only"

    local temp_file
    temp_file=$(mktemp)
    jq ".specflow_version = \"$SPECFLOW_VERSION\"" "$manifest_path" > "$temp_file"
    mv "$temp_file" "$manifest_path"

    log_success "Updated to version $SPECFLOW_VERSION"
    return 0
  fi

  echo "Upgrades available:"
  for upgrade in "${upgrades_needed[@]}"; do
    echo "  - $upgrade"
  done
  echo ""

  # Apply upgrades
  for upgrade in "${upgrades_needed[@]}"; do
    case "$upgrade" in
      roadmap:2.0-\>2.1)
        log_step "Upgrading ROADMAP format: 2.0 -> 2.1"
        if bash "${SCRIPT_DIR}/specflow-migrate.sh" roadmap 2>/dev/null; then
          # Update manifest
          local temp_file
          temp_file=$(mktemp)
          jq '.schema.roadmap = "2.1"' "$manifest_path" > "$temp_file"
          mv "$temp_file" "$manifest_path"
          log_success "ROADMAP upgraded to 4-digit phases"
        else
          log_error "ROADMAP migration failed"
          return 1
        fi
        ;;
    esac
  done

  # Record migration and update version
  record_migration "$current_version" "$SPECFLOW_VERSION" "Applied: ${upgrades_needed[*]}"

  local temp_file
  temp_file=$(mktemp)
  jq ".specflow_version = \"$SPECFLOW_VERSION\"" "$manifest_path" > "$temp_file"
  mv "$temp_file" "$manifest_path"

  log_success "Upgraded to version $SPECFLOW_VERSION"
}

cmd_status() {
  local manifest_path
  manifest_path="$(get_manifest_path)"

  if [[ ! -f "$manifest_path" ]]; then
    echo "Manifest: NOT FOUND"
    echo ""
    echo "Run 'specflow manifest init' to create"
    exit 1
  fi

  local project_version
  project_version=$(jq -r '.specflow_version // "unknown"' "$manifest_path")

  echo "SpecFlow Version Status"
  echo "======================"
  echo ""
  echo "CLI Version:     $SPECFLOW_VERSION"
  echo "Project Version: $project_version"
  echo ""

  if [[ "$project_version" == "$SPECFLOW_VERSION" ]]; then
    echo "Status: UP TO DATE"
  elif version_gte "$SPECFLOW_VERSION" "$project_version"; then
    echo "Status: UPGRADE AVAILABLE"
    echo ""
    echo "Run 'specflow manifest upgrade' to upgrade"
  else
    echo "Status: PROJECT NEWER THAN CLI"
    echo ""
    echo "Update your SpecFlow installation"
  fi

  # Show schema versions
  echo ""
  echo "Schema Versions:"
  echo "  State:   $(jq -r '.schema.state // "?"' "$manifest_path") (current: $STATE_SCHEMA_VERSION)"
  echo "  ROADMAP: $(jq -r '.schema.roadmap // "?"' "$manifest_path") (current: $ROADMAP_FORMAT_VERSION)"
  echo "  Commands: $(jq -r '.schema.commands // "?"' "$manifest_path") (current: $COMMANDS_VERSION)"
}

# Record a migration in the manifest
record_migration() {
  local from_version="$1"
  local to_version="$2"
  local description="${3:-}"

  local manifest_path
  manifest_path="$(get_manifest_path)"

  local now
  now="$(get_iso_date)"

  local temp_file
  temp_file=$(mktemp)

  jq --arg from "$from_version" \
     --arg to "$to_version" \
     --arg date "$now" \
     --arg desc "$description" \
     '.migrations += [{"from": $from, "to": $to, "date": $date, "description": $desc}]' \
     "$manifest_path" > "$temp_file"

  mv "$temp_file" "$manifest_path"
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
      cmd_init "$@"
      ;;
    get)
      cmd_get "$@"
      ;;
    set)
      cmd_set "$@"
      ;;
    validate)
      cmd_validate "$@"
      ;;
    upgrade)
      cmd_upgrade "$@"
      ;;
    status)
      cmd_status "$@"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'specflow manifest --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
