#!/usr/bin/env bash
#
# speckit-templates.sh - Template versioning and management
#
# Usage:
#   speckit templates check           Compare versions, show outdated
#   speckit templates update [file]   Update specific template
#   speckit templates update-all      Update all templates
#   speckit templates diff [file]     Show differences
#   speckit templates list            List available templates
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# =============================================================================
# Constants
# =============================================================================

readonly SPECKIT_SYSTEM_DIR="${HOME}/.claude/speckit-system"
readonly SYSTEM_TEMPLATES="${SPECKIT_SYSTEM_DIR}/templates"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit templates - Template versioning and management

USAGE:
    speckit templates <command> [options]

COMMANDS:
    check               Compare project templates with system versions
                        Shows which templates have updates available

    update <file>       Update a specific template to latest version
                        Creates backup of existing file

    update-all          Update all outdated templates
                        Creates backups of existing files

    diff <file>         Show differences between project and system template

    list                List all available system templates

    copy <file>         Copy a system template to project templates

OPTIONS:
    --json              Output in JSON format
    --no-backup         Don't create backup when updating
    -h, --help          Show this help

EXAMPLES:
    speckit templates check
    speckit templates update spec-template.md
    speckit templates diff plan-template.md
    speckit templates list
EOF
}

# =============================================================================
# Helpers
# =============================================================================

# Get project templates directory
get_project_templates() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/.specify/templates"
}

# Extract version from template file
# Looks for: version: X.X or <!-- version: X.X --> or # version: X.X
get_template_version() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi

  # Try YAML frontmatter first (version: 'X.X' or version: X.X)
  local version
  version=$(grep -oE "^version:\s*['\"]?[0-9]+\.[0-9]+['\"]?" "$file" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo "")

  if [[ -z "$version" ]]; then
    # Try YAML/shell comment format (# version: X.X)
    version=$(grep -oE '^#\s*version:\s*[0-9]+\.[0-9]+' "$file" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo "")
  fi

  if [[ -z "$version" ]]; then
    # Try HTML comment format
    version=$(grep -oE '<!--\s*version:\s*[0-9]+\.[0-9]+\s*-->' "$file" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo "")
  fi

  if [[ -z "$version" ]]; then
    # Try description field with version
    version=$(grep -oE "description:.*version\s*[0-9]+\.[0-9]+" "$file" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo "")
  fi

  echo "$version"
}

# Compare versions (returns: 0=equal, 1=first>second, 2=first<second)
compare_versions() {
  local v1="$1"
  local v2="$2"

  if [[ -z "$v1" || -z "$v2" ]]; then
    echo "0"
    return
  fi

  if [[ "$v1" == "$v2" ]]; then
    echo "0"
  else
    # Split into major.minor
    local v1_major v1_minor v2_major v2_minor
    v1_major="${v1%%.*}"
    v1_minor="${v1##*.}"
    v2_major="${v2%%.*}"
    v2_minor="${v2##*.}"

    if [[ "$v1_major" -gt "$v2_major" ]] || \
       [[ "$v1_major" -eq "$v2_major" && "$v1_minor" -gt "$v2_minor" ]]; then
      echo "1"
    else
      echo "2"
    fi
  fi
}

# Create backup of file
create_backup() {
  local file="$1"
  local backup="${file}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$file" "$backup"
  echo "$backup"
}

# =============================================================================
# Commands
# =============================================================================

cmd_check() {
  if [[ ! -d "$SYSTEM_TEMPLATES" ]]; then
    log_error "System templates not found: $SYSTEM_TEMPLATES"
    exit 1
  fi

  local project_templates
  project_templates="$(get_project_templates)"

  if is_json_output; then
    local results="[]"
  else
    print_header "Template Version Check"
    echo ""
  fi

  local outdated=0
  local total=0

  while IFS= read -r sys_template; do
    local filename
    filename=$(basename "$sys_template")
    local proj_template="${project_templates}/${filename}"

    ((total++)) || true

    local sys_version proj_version status
    sys_version=$(get_template_version "$sys_template")
    proj_version=""
    status="system_only"

    if [[ -f "$proj_template" ]]; then
      proj_version=$(get_template_version "$proj_template")

      if [[ -n "$sys_version" && -n "$proj_version" ]]; then
        local cmp
        cmp=$(compare_versions "$sys_version" "$proj_version")
        if [[ "$cmp" == "1" ]]; then
          status="outdated"
          ((outdated++)) || true
        elif [[ "$cmp" == "2" ]]; then
          status="newer"
        else
          status="current"
        fi
      elif [[ "$sys_template" -nt "$proj_template" ]]; then
        status="outdated"
        ((outdated++)) || true
      else
        status="current"
      fi
    fi

    if is_json_output; then
      results=$(echo "$results" | jq \
        --arg file "$filename" \
        --arg sys_ver "${sys_version:-unknown}" \
        --arg proj_ver "${proj_version:-none}" \
        --arg status "$status" \
        '. + [{"file": $file, "system_version": $sys_ver, "project_version": $proj_ver, "status": $status}]')
    else
      case "$status" in
        current)
          print_status ok "$filename (v$proj_version)"
          ;;
        outdated)
          print_status warn "$filename: v${proj_version:-?} -> v${sys_version:-?} available"
          ;;
        newer)
          print_status ok "$filename (v$proj_version - newer than system)"
          ;;
        system_only)
          print_status pending "$filename (v${sys_version:-?}) - not in project"
          ;;
      esac
    fi
  done < <(find "$SYSTEM_TEMPLATES" -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -type f 2>/dev/null | sort)

  if is_json_output; then
    echo "{\"total\": $total, \"outdated\": $outdated, \"templates\": $results}"
  else
    echo ""
    if [[ $outdated -gt 0 ]]; then
      log_warn "$outdated template(s) have updates available"
      log_info "Run 'speckit templates update-all' to update"
    else
      log_success "All project templates are current"
    fi
  fi
}

cmd_update() {
  local filename="$1"
  local no_backup="${2:-false}"

  if [[ -z "$filename" ]]; then
    log_error "Template filename required"
    echo "Usage: speckit templates update <file>"
    exit 1
  fi

  local sys_template="${SYSTEM_TEMPLATES}/${filename}"
  local project_templates
  project_templates="$(get_project_templates)"
  local proj_template="${project_templates}/${filename}"

  if [[ ! -f "$sys_template" ]]; then
    log_error "System template not found: $filename"
    exit 1
  fi

  # Ensure project templates directory exists
  if [[ ! -d "$project_templates" ]]; then
    mkdir -p "$project_templates"
  fi

  # Create backup if project template exists
  if [[ -f "$proj_template" && "$no_backup" != "true" ]]; then
    local backup
    backup=$(create_backup "$proj_template")
    log_info "Created backup: $(basename "$backup")"
  fi

  # Copy template
  cp "$sys_template" "$proj_template"

  local version
  version=$(get_template_version "$proj_template")
  log_success "Updated $filename to v${version:-latest}"

  if is_json_output; then
    echo "{\"updated\": \"$filename\", \"version\": \"${version:-unknown}\"}"
  fi
}

cmd_update_all() {
  local no_backup="${1:-false}"

  if [[ ! -d "$SYSTEM_TEMPLATES" ]]; then
    log_error "System templates not found"
    exit 1
  fi

  local project_templates
  project_templates="$(get_project_templates)"

  local updated=0

  while IFS= read -r sys_template; do
    local filename
    filename=$(basename "$sys_template")
    local proj_template="${project_templates}/${filename}"

    # Only update if project template exists and is outdated
    if [[ -f "$proj_template" ]]; then
      local sys_version proj_version
      sys_version=$(get_template_version "$sys_template")
      proj_version=$(get_template_version "$proj_template")

      local should_update=false

      if [[ -n "$sys_version" && -n "$proj_version" ]]; then
        local cmp
        cmp=$(compare_versions "$sys_version" "$proj_version")
        [[ "$cmp" == "1" ]] && should_update=true
      elif [[ "$sys_template" -nt "$proj_template" ]]; then
        should_update=true
      fi

      if [[ "$should_update" == "true" ]]; then
        if [[ "$no_backup" != "true" ]]; then
          create_backup "$proj_template" >/dev/null
        fi
        cp "$sys_template" "$proj_template"
        ((updated++)) || true
        print_status ok "Updated: $filename"
      fi
    fi
  done < <(find "$SYSTEM_TEMPLATES" -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -type f 2>/dev/null)

  echo ""
  if [[ $updated -gt 0 ]]; then
    log_success "Updated $updated template(s)"
  else
    log_info "All templates already current"
  fi

  if is_json_output; then
    echo "{\"updated\": $updated}"
  fi
}

cmd_diff() {
  local filename="$1"

  if [[ -z "$filename" ]]; then
    log_error "Template filename required"
    echo "Usage: speckit templates diff <file>"
    exit 1
  fi

  local sys_template="${SYSTEM_TEMPLATES}/${filename}"
  local project_templates
  project_templates="$(get_project_templates)"
  local proj_template="${project_templates}/${filename}"

  if [[ ! -f "$sys_template" ]]; then
    log_error "System template not found: $filename"
    exit 1
  fi

  if [[ ! -f "$proj_template" ]]; then
    log_error "Project template not found: $filename"
    log_info "Run 'speckit templates copy $filename' to create it"
    exit 1
  fi

  local sys_version proj_version
  sys_version=$(get_template_version "$sys_template")
  proj_version=$(get_template_version "$proj_template")

  if ! is_json_output; then
    print_header "Template Diff: $filename"
    echo ""
    echo "  System version:  ${sys_version:-unknown}"
    echo "  Project version: ${proj_version:-unknown}"
    echo ""
  fi

  # Show diff
  if command_exists diff; then
    if diff -u "$proj_template" "$sys_template" 2>/dev/null; then
      log_info "Files are identical"
    fi
  else
    log_warn "diff command not available"
  fi
}

cmd_list() {
  if [[ ! -d "$SYSTEM_TEMPLATES" ]]; then
    log_error "System templates not found"
    exit 1
  fi

  if is_json_output; then
    local templates="[]"
    while IFS= read -r template; do
      local filename version
      filename=$(basename "$template")
      version=$(get_template_version "$template")
      templates=$(echo "$templates" | jq \
        --arg file "$filename" \
        --arg version "${version:-unknown}" \
        '. + [{"file": $file, "version": $version}]')
    done < <(find "$SYSTEM_TEMPLATES" -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -type f 2>/dev/null | sort)
    echo "$templates"
  else
    print_header "Available Templates"
    echo ""
    while IFS= read -r template; do
      local filename version
      filename=$(basename "$template")
      version=$(get_template_version "$template")
      echo "  $filename (v${version:-?})"
    done < <(find "$SYSTEM_TEMPLATES" -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -type f 2>/dev/null | sort)
  fi
}

cmd_copy() {
  local filename="$1"

  if [[ -z "$filename" ]]; then
    log_error "Template filename required"
    echo "Usage: speckit templates copy <file>"
    exit 1
  fi

  local sys_template="${SYSTEM_TEMPLATES}/${filename}"
  local project_templates
  project_templates="$(get_project_templates)"
  local proj_template="${project_templates}/${filename}"

  if [[ ! -f "$sys_template" ]]; then
    log_error "System template not found: $filename"
    exit 1
  fi

  if [[ -f "$proj_template" ]]; then
    log_warn "Project template already exists: $filename"
    if ! confirm "Overwrite?"; then
      exit 0
    fi
  fi

  # Ensure directory exists
  mkdir -p "$project_templates"

  cp "$sys_template" "$proj_template"
  log_success "Copied $filename to project templates"

  if is_json_output; then
    echo "{\"copied\": \"$filename\"}"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  parse_common_flags "$@"
  set -- "${REMAINING_ARGS[@]:-}"

  local no_backup=false

  # Check for --no-backup flag
  local args=()
  for arg in "$@"; do
    if [[ "$arg" == "--no-backup" ]]; then
      no_backup=true
    else
      args+=("$arg")
    fi
  done
  set -- "${args[@]}"

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local command="$1"
  shift

  case "$command" in
    check)
      cmd_check
      ;;
    update)
      cmd_update "${1:-}" "$no_backup"
      ;;
    update-all)
      cmd_update_all "$no_backup"
      ;;
    diff)
      cmd_diff "${1:-}"
      ;;
    list|ls)
      cmd_list
      ;;
    copy|cp)
      cmd_copy "${1:-}"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown command: $command"
      echo "Run 'speckit templates --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
