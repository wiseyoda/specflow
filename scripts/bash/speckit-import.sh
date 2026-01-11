#!/usr/bin/env bash
#
# speckit-import.sh - Import existing documentation into SpecKit
#
# Usage:
#   speckit import adrs <path>     Import ADRs from directory
#   speckit import adrs --dry-run  Preview import without changes
#
# This command copies documents into .specify/memory/ structure
# while preserving original files.
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
speckit import - Import existing documentation

USAGE:
    speckit import <type> <path> [options]

TYPES:
    adrs <path>         Import Architecture Decision Records

OPTIONS:
    --dry-run           Preview import without making changes
    --force             Overwrite existing files
    --json              Output in JSON format
    -h, --help          Show this help

EXAMPLES:
    speckit import adrs docs/adr
    speckit import adrs ./architecture/decisions --dry-run
    speckit import adrs adr --force

WHAT IT DOES:
    1. Scans source path for ADR files (NNN-*.md, ADR-NNN-*.md)
    2. Creates .specify/memory/adrs/ directory
    3. Copies ADR files preserving original names
    4. Generates adr-index.md with title and status

NOTE:
    Original files are never modified or deleted.
EOF
}

# =============================================================================
# ADR Import Functions
# =============================================================================

# Extract title from ADR file (first H1)
extract_adr_title() {
  local file="$1"
  local title
  title=$(grep -m1 "^# " "$file" 2>/dev/null | sed 's/^# //' || echo "")
  if [[ -z "$title" ]]; then
    title=$(basename "$file" .md)
  fi
  echo "$title"
}

# Extract status from ADR file
extract_adr_status() {
  local file="$1"
  local status="Unknown"

  # Look for Status: line or status field
  if grep -qiE "^status[:\s]" "$file" 2>/dev/null; then
    status=$(grep -iE "^status[:\s]" "$file" | head -1 | sed 's/^[Ss]tatus[:\s]*//' | tr -d '\r')
  elif grep -qiE "\*\*Status\*\*" "$file" 2>/dev/null; then
    status=$(grep -iE "\*\*Status\*\*" "$file" | head -1 | sed 's/.*\*\*Status\*\*[:\s]*//' | tr -d '\r')
  fi

  echo "$status"
}

# Find ADR files in directory
find_adr_files() {
  local dir="$1"
  find "$dir" -maxdepth 1 -type f \( \
    -name "[0-9][0-9][0-9]-*.md" -o \
    -name "[0-9][0-9][0-9][0-9]-*.md" -o \
    -name "ADR-[0-9]*-*.md" -o \
    -name "adr-[0-9]*-*.md" \
  \) 2>/dev/null | sort
}

# Generate ADR index file
generate_adr_index() {
  local target_dir="$1"
  local source_dir="$2"
  local adr_files="$3"
  local index_file="${target_dir}/adr-index.md"

  local today
  today=$(date +%Y-%m-%d)

  cat > "$index_file" << EOF
# Architecture Decision Records

**Imported from**: \`${source_dir}\`
**Import date**: ${today}
**Total ADRs**: $(echo "$adr_files" | wc -l | tr -d ' ')

## Index

| ID | Title | Status |
|----|-------|--------|
EOF

  # Add each ADR to index
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local basename
    basename=$(basename "$file")
    local title
    title=$(extract_adr_title "$file")
    local status
    status=$(extract_adr_status "$file")

    # Extract ID from filename
    local id
    id=$(echo "$basename" | sed -E 's/^(ADR-)?([0-9]+)-.*/\2/')

    echo "| ${id} | [${title}](./adrs/${basename}) | ${status} |" >> "$index_file"
  done <<< "$adr_files"

  cat >> "$index_file" << 'EOF'

## Notes

- ADRs are imported as-is, preserving original format
- Status extracted from ADR metadata if present
- Original files are not modified

EOF
}

# Import ADRs from directory
import_adrs() {
  local source_dir="$1"
  local dry_run="${DRY_RUN:-false}"
  local force="${FORCE:-false}"

  local repo_root
  repo_root="$(get_repo_root 2>/dev/null || pwd)"

  # Validate source directory
  if [[ ! -d "$source_dir" ]]; then
    log_error "Source directory not found: $source_dir"
    log_info "Run 'speckit detect --docs' to find ADR directories"
    return 1
  fi

  # Make source path absolute
  if [[ "$source_dir" != /* ]]; then
    source_dir="${repo_root}/${source_dir}"
  fi

  # Find ADR files
  local adr_files
  adr_files=$(find_adr_files "$source_dir")
  local adr_count=0
  if [[ -n "$adr_files" ]]; then
    adr_count=$(echo "$adr_files" | wc -l | tr -d ' ')
  fi

  if [[ "$adr_count" -eq 0 ]]; then
    log_error "No ADR files found in: $source_dir"
    log_info "Expected patterns: NNN-*.md, ADR-NNN-*.md"
    return 1
  fi

  # Target directory
  local target_dir="${repo_root}/.specify/memory"
  local adrs_dir="${target_dir}/adrs"

  # Summary
  local rel_source="${source_dir#$repo_root/}"
  if ! is_json_output; then
    print_header "ADR Import"
    echo ""
    echo "  Source: ${rel_source}"
    echo "  Target: .specify/memory/adrs/"
    echo "  Files:  ${adr_count} ADR(s)"
    echo ""
  fi

  # Check if target exists
  if [[ -d "$adrs_dir" ]] && [[ "$force" != "true" ]]; then
    local existing=0
    existing=$(find "$adrs_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [[ $existing -gt 0 ]]; then
      log_warn "Target directory already contains ${existing} file(s)"
      log_info "Use --force to overwrite"
      return 1
    fi
  fi

  # Dry run mode
  if [[ "$dry_run" == "true" ]]; then
    log_info "DRY RUN - No changes will be made"
    echo ""
    echo "Would copy:"
    while IFS= read -r file; do
      [[ -z "$file" ]] && continue
      echo "  $(basename "$file")"
    done <<< "$adr_files"
    echo ""
    echo "Would create:"
    echo "  .specify/memory/adrs/ (directory)"
    echo "  .specify/memory/adr-index.md"

    if is_json_output; then
      echo "{\"dry_run\": true, \"count\": $adr_count, \"source\": \"$rel_source\"}"
    fi
    return 0
  fi

  # Create target directory
  mkdir -p "$adrs_dir"

  # Copy files
  local copied=0
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local basename
    basename=$(basename "$file")
    cp "$file" "${adrs_dir}/${basename}"
    ((copied++)) || true
    if ! is_json_output; then
      echo "  Copied: ${basename}"
    fi
  done <<< "$adr_files"

  # Generate index
  generate_adr_index "$target_dir" "$rel_source" "$adr_files"

  echo ""
  log_success "Imported ${copied} ADR(s)"
  log_info "Index created: .specify/memory/adr-index.md"

  if is_json_output; then
    echo "{\"imported\": $copied, \"index\": \".specify/memory/adr-index.md\", \"source\": \"$rel_source\"}"
  fi

  return 0
}

# =============================================================================
# Main
# =============================================================================

DRY_RUN="false"
FORCE="false"

main() {
  # Parse global flags first
  local args=()
  for arg in "$@"; do
    case "$arg" in
      --dry-run)
        DRY_RUN="true"
        ;;
      --force)
        FORCE="true"
        ;;
      *)
        args+=("$arg")
        ;;
    esac
  done

  parse_common_flags "${args[@]}"
  set -- "${REMAINING_ARGS[@]:-}"

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local import_type="$1"
  shift

  case "$import_type" in
    adrs|adr)
      if [[ $# -eq 0 ]]; then
        log_error "Missing path argument"
        echo "Usage: speckit import adrs <path>"
        exit 1
      fi
      import_adrs "$1"
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown import type: $import_type"
      echo "Valid types: adrs"
      exit 1
      ;;
  esac
}

main "$@"
