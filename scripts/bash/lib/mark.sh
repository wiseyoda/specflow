#!/usr/bin/env bash
#
# lib/mark.sh - Shared helpers for marking checkbox items
#
# Provides:
#   expand_range()        - Expand ID ranges (V-001..V-010 -> V-001 V-002 ...)
#   parse_ids_and_file()  - Separate IDs from .md file in arguments
#   mark_checkbox_item()  - Mark a single checkbox item complete in a file
#
# Usage:
#   source "${SCRIPT_DIR}/lib/mark.sh"
#

# Guard against double-sourcing
[[ -n "${_LIB_MARK_LOADED:-}" ]] && return 0
_LIB_MARK_LOADED=1

# =============================================================================
# Range Expansion
# =============================================================================

# Expand a range like V-001..V-010 into individual IDs
# Supports formats: V-001..V-010, CHK001..CHK010, FR-01..FR-05, A1..A5, T001..T010
# Usage: expand_range "V-001..V-010"
# Output: One ID per line
expand_range() {
  local range="$1"

  # Check if it's a range (contains ..)
  if [[ "$range" != *..* ]]; then
    echo "$range"
    return
  fi

  local start="${range%..*}"
  local end="${range#*..}"

  # Extract prefix and numeric parts
  # Supports: V-001, CHK001, FR-01, A1, T001, A1.1 (but not ranges of hierarchical)
  local prefix_start prefix_end num_start num_end

  if [[ "$start" =~ ^([A-Za-z]+-?)([0-9]+)$ ]]; then
    prefix_start="${BASH_REMATCH[1]}"
    num_start="${BASH_REMATCH[2]}"
  elif [[ "$start" =~ ^([A-Za-z])([0-9]+)$ ]]; then
    # Simple format like A1, T001
    prefix_start="${BASH_REMATCH[1]}"
    num_start="${BASH_REMATCH[2]}"
  else
    # Not a valid format, return as-is
    echo "$range"
    return
  fi

  if [[ "$end" =~ ^([A-Za-z]+-?)([0-9]+)$ ]]; then
    prefix_end="${BASH_REMATCH[1]}"
    num_end="${BASH_REMATCH[2]}"
  elif [[ "$end" =~ ^([A-Za-z])([0-9]+)$ ]]; then
    prefix_end="${BASH_REMATCH[1]}"
    num_end="${BASH_REMATCH[2]}"
  else
    echo "$range"
    return
  fi

  # Prefixes must match
  if [[ "$prefix_start" != "$prefix_end" ]]; then
    echo "$range"
    return
  fi

  # Get the width for zero-padding
  local width=${#num_start}

  # Generate the range
  local i
  for ((i = 10#$num_start; i <= 10#$num_end; i++)); do
    printf "%s%0${width}d\n" "$prefix_start" "$i"
  done
}

# =============================================================================
# Argument Parsing
# =============================================================================

# Parse arguments to separate IDs from the file
# File is detected by .md extension
# Sets global arrays: MARK_IDS and MARK_FILE
# Usage: parse_ids_and_file "$@"
#        echo "File: $MARK_FILE"
#        echo "IDs: ${MARK_IDS[@]}"
parse_ids_and_file() {
  MARK_FILE=""
  MARK_IDS=()

  for arg in "$@"; do
    if [[ "$arg" == *.md ]]; then
      MARK_FILE="$arg"
    else
      MARK_IDS+=("$arg")
    fi
  done
}

# Expand all IDs (including ranges) into individual IDs
# Usage: expand_all_ids "${MARK_IDS[@]}"
# Output: One ID per line
expand_all_ids() {
  local ids=("$@")
  for id in "${ids[@]}"; do
    expand_range "$id"
  done
}

# =============================================================================
# Checkbox Marking
# =============================================================================

# Mark a single checkbox item complete in a file
# Returns: 0=marked, 1=not found, 2=already complete
# Usage: mark_checkbox_item "V-001" "/path/to/file.md" "regex_pattern"
#   - item_id: The ID to mark (e.g., V-001, T001, A1.1)
#   - file: Path to the markdown file
#   - pattern: Optional regex pattern override for matching the ID
#              Default matches: **ID** or ID after checkbox
mark_checkbox_item() {
  local item_id="$1"
  local file="$2"
  local pattern="${3:-}"

  # Escape special regex characters in ID (dots for A1.1 format)
  local escaped_id="${item_id//./\\.}"

  # Default pattern: checkbox followed by optional bold markers, then the ID
  if [[ -z "$pattern" ]]; then
    pattern="^\s*-\s*\[[x ]\].*\*?\*?${escaped_id}\*?\*?"
  fi

  # Check if item exists and is not already complete
  if ! grep -qE "^\s*-\s*\[ \].*\*?\*?${escaped_id}\*?\*?" "$file" 2>/dev/null; then
    # Check if it's already complete
    if grep -qE "^\s*-\s*\[x\].*\*?\*?${escaped_id}\*?\*?" "$file" 2>/dev/null; then
      return 2
    fi
    return 1
  fi

  # Mark the item complete using sed
  # Handle both **ID** (bold) and ID (plain) formats
  # macOS sed requires -i '' for in-place editing
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^\([[:space:]]*-[[:space:]]*\)\[ \]\(.*${escaped_id}.*\)$/\1[x]\2/" "$file"
  else
    sed -i "s/^\([[:space:]]*-[[:space:]]*\)\[ \]\(.*${escaped_id}.*\)$/\1[x]\2/" "$file"
  fi

  return 0
}

# =============================================================================
# Batch Marking with Summary
# =============================================================================

# Mark multiple items and return summary
# Sets globals: MARK_RESULT_MARKED, MARK_RESULT_SKIPPED, MARK_RESULT_NOT_FOUND, MARK_RESULT_ERRORS
# Usage: mark_items_batch file.md id1 id2 id3...
# Returns: 0 if all succeeded, 1 if any not found
mark_items_batch() {
  local file="$1"
  shift
  local ids=("$@")

  MARK_RESULT_MARKED=0
  MARK_RESULT_SKIPPED=0
  MARK_RESULT_NOT_FOUND=0
  MARK_RESULT_ERRORS=()

  for item_id in "${ids[@]}"; do
    local result=0
    mark_checkbox_item "$item_id" "$file" || result=$?

    case $result in
      0) ((MARK_RESULT_MARKED++)) || true ;;
      1)
        MARK_RESULT_ERRORS+=("$item_id: not found")
        ((MARK_RESULT_NOT_FOUND++)) || true
        ;;
      2) ((MARK_RESULT_SKIPPED++)) || true ;;
    esac
  done

  [[ $MARK_RESULT_NOT_FOUND -gt 0 ]] && return 1
  return 0
}

# Print mark results summary (requires common.sh to be sourced)
# Usage: print_mark_summary [file_path]
print_mark_summary() {
  local file_path="${1:-}"

  if [[ $MARK_RESULT_MARKED -gt 0 ]]; then
    echo -e "${GREEN:-}OK${RESET:-}: Marked $MARK_RESULT_MARKED item(s) complete"
  fi
  if [[ $MARK_RESULT_SKIPPED -gt 0 ]]; then
    echo -e "${YELLOW:-}WARN${RESET:-}: $MARK_RESULT_SKIPPED item(s) already complete"
  fi
  if [[ $MARK_RESULT_NOT_FOUND -gt 0 ]]; then
    echo -e "${RED:-}ERROR${RESET:-}: $MARK_RESULT_NOT_FOUND item(s) not found"
    for err in "${MARK_RESULT_ERRORS[@]}"; do
      echo "  - $err"
    done
  fi
}

# Output mark results as JSON
# Usage: print_mark_summary_json
print_mark_summary_json() {
  local errors_json="[]"
  for err in "${MARK_RESULT_ERRORS[@]}"; do
    errors_json=$(echo "$errors_json" | jq --arg e "$err" '. + [$e]')
  done
  echo "{\"marked\": $MARK_RESULT_MARKED, \"skipped\": $MARK_RESULT_SKIPPED, \"not_found\": $MARK_RESULT_NOT_FOUND, \"errors\": $errors_json}"
}
