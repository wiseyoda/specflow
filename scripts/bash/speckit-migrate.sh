#!/usr/bin/env bash
#
# speckit-migrate.sh - Migration utilities for SpecKit
#
# Usage:
#   speckit migrate roadmap            Migrate ROADMAP.md from 2.0 to 2.1 format
#   speckit migrate roadmap --dry-run  Preview changes without applying
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
speckit migrate - Migration utilities for SpecKit

USAGE:
    speckit migrate <target> [options]

TARGETS:
    roadmap             Migrate ROADMAP.md from 2.0 to 2.1 format
                        Converts 3-digit phases (001, 002) to 4-digit (0010, 0020)

OPTIONS:
    --dry-run           Preview changes without applying
    --no-backup         Skip creating backup file
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit migrate roadmap              # Migrate and create backup
    speckit migrate roadmap --dry-run    # Preview changes only
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get ROADMAP.md path
get_roadmap_path() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  if [[ -f "$state_file" ]]; then
    local config_path
    config_path=$(json_get "$state_file" ".config.roadmap_path" 2>/dev/null || echo "")
    if [[ -n "$config_path" && "$config_path" != "null" ]]; then
      echo "${repo_root}/${config_path}"
      return
    fi
  fi

  echo "${repo_root}/ROADMAP.md"
}

# Detect roadmap format
detect_format() {
  local roadmap_path="$1"

  local has_3digit=false
  local has_4digit=false

  # Check for 3-digit phases that are NOT 4-digit
  if grep -E '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" 2>/dev/null | grep -qvE '^\|\s*[0-9]{4}\s*\|'; then
    has_3digit=true
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

# Convert 3-digit phase to 4-digit
# 001 -> 0010, 002 -> 0020, 012 -> 0120
convert_phase_number() {
  local old="$1"
  # Remove leading zeros, multiply by 10, pad to 4 digits
  local num=$((10#$old * 10))
  printf "%04d" "$num"
}

# =============================================================================
# Commands
# =============================================================================

cmd_roadmap() {
  local dry_run=false
  local no_backup=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        dry_run=true
        shift
        ;;
      --no-backup)
        no_backup=true
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  local roadmap_path
  roadmap_path="$(get_roadmap_path)"

  if [[ ! -f "$roadmap_path" ]]; then
    log_error "ROADMAP.md not found: $roadmap_path"
    exit 1
  fi

  # Detect current format
  local format
  format=$(detect_format "$roadmap_path")

  case "$format" in
    "2.1")
      log_success "ROADMAP.md is already in 2.1 format (4-digit phases)"
      if is_json_output; then
        echo '{"migrated": false, "reason": "already_current", "format": "2.1"}'
      fi
      exit 0
      ;;
    "mixed")
      log_error "ROADMAP.md has mixed format (both 3-digit and 4-digit phases)"
      echo "Please manually fix the format before migrating:"
      echo ""
      echo "3-digit phases found:"
      grep -E '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" | grep -vE '^\|\s*[0-9]{4}\s*\|' | head -5
      echo ""
      echo "4-digit phases found:"
      grep -E '^\|\s*[0-9]{4}\s*\|' "$roadmap_path" | head -5
      exit 1
      ;;
    "unknown")
      log_error "No phases found in ROADMAP.md"
      exit 1
      ;;
    "2.0")
      log_step "Migrating ROADMAP.md from 2.0 to 2.1 format"
      ;;
  esac

  # Collect all phase numbers to migrate
  local phases=()
  while read -r phase; do
    phase=$(echo "$phase" | tr -d ' ')
    phases+=("$phase")
  done < <(grep -oE '^\|\s*[0-9]{3}\s*\|' "$roadmap_path" | grep -oE '[0-9]{3}')

  if [[ ${#phases[@]} -eq 0 ]]; then
    log_error "No 3-digit phases found to migrate"
    exit 1
  fi

  # Show what will be changed
  echo "Phases to migrate:"
  for old_phase in "${phases[@]}"; do
    new_phase=$(convert_phase_number "$old_phase")
    echo "  $old_phase -> $new_phase"
  done
  echo ""

  if $dry_run; then
    log_info "Dry run - no changes made"
    if is_json_output; then
      local changes="[]"
      for old_phase in "${phases[@]}"; do
        new_phase=$(convert_phase_number "$old_phase")
        changes=$(echo "$changes" | jq --arg old "$old_phase" --arg new "$new_phase" '. + [{"old": $old, "new": $new}]')
      done
      echo "{\"dry_run\": true, \"changes\": $changes}"
    fi
    exit 0
  fi

  # Create backup
  if ! $no_backup; then
    local backup_path="${roadmap_path}.bak"
    cp "$roadmap_path" "$backup_path"
    log_info "Backup created: $backup_path"
  fi

  # Create temp file for atomic update
  local temp_file
  temp_file=$(mktemp)
  cp "$roadmap_path" "$temp_file"

  # Migrate each phase number
  for old_phase in "${phases[@]}"; do
    new_phase=$(convert_phase_number "$old_phase")

    # Update table rows: | 001 | -> | 0010 |
    sed -i.tmp "s/|[[:space:]]*${old_phase}[[:space:]]*|/| ${new_phase} |/g" "$temp_file"

    # Update section headers: ### 001 - -> ### 0010 -
    sed -i.tmp "s/^###[[:space:]]*${old_phase}[[:space:]]*-/### ${new_phase} -/g" "$temp_file"

    rm -f "${temp_file}.tmp"
  done

  mv "$temp_file" "$roadmap_path"

  # Update state file if exists
  local state_file
  state_file="$(get_state_file)"
  if [[ -f "$state_file" ]]; then
    local current_phase
    current_phase=$(json_get "$state_file" ".orchestration.phase.number" 2>/dev/null || echo "")

    if [[ -n "$current_phase" && "$current_phase" != "null" && ${#current_phase} -eq 3 ]]; then
      local new_state_phase
      new_state_phase=$(convert_phase_number "$current_phase")

      # Update phase number in state
      json_set "$state_file" ".orchestration.phase.number" "\"$new_state_phase\""

      # Update branch name
      local old_branch new_branch
      old_branch=$(json_get "$state_file" ".orchestration.phase.branch" 2>/dev/null || echo "")
      if [[ -n "$old_branch" && "$old_branch" != "null" ]]; then
        new_branch=$(echo "$old_branch" | sed "s/${current_phase}/${new_state_phase}/g")
        json_set "$state_file" ".orchestration.phase.branch" "\"$new_branch\""
      fi

      log_info "Updated state file phase: $current_phase -> $new_state_phase"
    fi
  fi

  log_success "Migrated ${#phases[@]} phase(s) from 2.0 to 2.1 format"

  # Update manifest to record the migration
  local manifest_script="${SCRIPT_DIR}/speckit-manifest.sh"
  if [[ -f "$manifest_script" ]]; then
    # Update roadmap format version in manifest
    bash "$manifest_script" set "schema.roadmap=2.1" 2>/dev/null || true

    # Record the migration in manifest
    local timestamp
    timestamp="$(iso_timestamp)"
    local repo_root
    repo_root="$(get_repo_root)"
    local manifest_file="${repo_root}/.specify/manifest.json"

    if [[ -f "$manifest_file" ]]; then
      local migration_entry
      migration_entry=$(jq -n \
        --arg from "2.0" \
        --arg to "2.1" \
        --arg at "$timestamp" \
        '{"from": $from, "to": $to, "target": "roadmap", "migrated_at": $at}')

      # Append to migrations array
      local temp_file
      temp_file=$(mktemp)
      jq --argjson entry "$migration_entry" '.migrations += [$entry]' "$manifest_file" > "$temp_file" && mv "$temp_file" "$manifest_file"
      log_info "Recorded migration in manifest"
    fi
  fi

  if is_json_output; then
    local changes="[]"
    for old_phase in "${phases[@]}"; do
      new_phase=$(convert_phase_number "$old_phase")
      changes=$(echo "$changes" | jq --arg old "$old_phase" --arg new "$new_phase" '. + [{"old": $old, "new": $new}]')
    done
    echo "{\"migrated\": true, \"count\": ${#phases[@]}, \"changes\": $changes}"
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

  local target="$1"
  shift

  case "$target" in
    roadmap)
      cmd_roadmap "$@"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown migration target: $target"
      echo "Run 'speckit migrate --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
