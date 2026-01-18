#!/usr/bin/env bash
#
# common.sh - Shared functions for SpecFlow scripts
#
# Source this file at the start of each script:
#   source "$(dirname "$0")/lib/common.sh"
#

# Guard against double-sourcing
if [[ -n "${SPECFLOW_COMMON_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
SPECFLOW_COMMON_LOADED=1

# Strict mode
set -euo pipefail

# =============================================================================
# Colors (disabled if not a terminal or NO_COLOR is set)
# =============================================================================

if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  readonly RED='\033[0;31m'
  readonly GREEN='\033[0;32m'
  readonly YELLOW='\033[0;33m'
  readonly BLUE='\033[0;34m'
  readonly MAGENTA='\033[0;35m'
  readonly CYAN='\033[0;36m'
  readonly BOLD='\033[1m'
  readonly DIM='\033[2m'
  readonly RESET='\033[0m'
else
  readonly RED=''
  readonly GREEN=''
  readonly YELLOW=''
  readonly BLUE=''
  readonly MAGENTA=''
  readonly CYAN=''
  readonly BOLD=''
  readonly DIM=''
  readonly RESET=''
fi

# =============================================================================
# Logging
# =============================================================================

log_info() {
  echo -e "${BLUE}INFO${RESET}: $*"
}

log_success() {
  echo -e "${GREEN}OK${RESET}: $*"
}

log_warn() {
  echo -e "${YELLOW}WARN${RESET}: $*" >&2
}

log_error() {
  echo -e "${RED}ERROR${RESET}: $*" >&2
}

log_debug() {
  if [[ "${SPECFLOW_DEBUG:-}" == "1" ]]; then
    echo -e "${DIM}DEBUG: $*${RESET}" >&2
  fi
}

# Log a step in a process
log_step() {
  echo -e "${CYAN}==>${RESET} ${BOLD}$*${RESET}"
}

# =============================================================================
# Output Formatting
# =============================================================================

# Print a header
print_header() {
  local title="$1"
  local width="${2:-60}"
  local line
  line=$(printf '%*s' "$width" '' | tr ' ' '=')
  echo ""
  echo -e "${BOLD}${line}${RESET}"
  echo -e "${BOLD}  $title${RESET}"
  echo -e "${BOLD}${line}${RESET}"
}

# Print a section
print_section() {
  local title="$1"
  echo ""
  echo -e "${BOLD}## $title${RESET}"
  echo ""
}

# Print status with icon
print_status() {
  local status="$1"
  local message="$2"
  case "$status" in
    ok|pass|complete|completed)
      echo -e "  ${GREEN}✓${RESET} $message"
      ;;
    warn|warning)
      echo -e "  ${YELLOW}!${RESET} $message"
      ;;
    error|fail|failed)
      echo -e "  ${RED}✗${RESET} $message"
      ;;
    skip|skipped)
      echo -e "  ${DIM}○${RESET} $message"
      ;;
    pending)
      echo -e "  ${BLUE}◯${RESET} $message"
      ;;
    progress|in_progress)
      echo -e "  ${CYAN}◉${RESET} $message"
      ;;
    *)
      echo -e "  • $message"
      ;;
  esac
}

# Print a command summary (first 3 lines are user-critical)
# Use this at the end of commands to provide clear status
#
# Args:
#   $1 - status: ok, warn, error
#   $2 - action: what was done (e.g., "Created project structure")
#   $3 - detail: key result (e.g., "5 directories, 3 files")
#   $4 - hint: next step (e.g., "Run /specflow.init to start")
#
print_summary() {
  local status="${1:-ok}"
  local action="${2:-Action completed}"
  local detail="${3:-}"
  local hint="${4:-}"

  echo ""

  # Line 1: Status + Action
  case "$status" in
    ok|success)
      echo -e "${GREEN}OK${RESET}: $action"
      ;;
    warn|warning)
      echo -e "${YELLOW}WARN${RESET}: $action"
      ;;
    error|fail)
      echo -e "${RED}ERROR${RESET}: $action"
      ;;
    *)
      echo -e "${BLUE}INFO${RESET}: $action"
      ;;
  esac

  # Line 2: Detail (if provided)
  if [[ -n "$detail" ]]; then
    echo "  $detail"
  fi

  # Line 3: Hint/Next step (if provided)
  if [[ -n "$hint" ]]; then
    echo "  Next: $hint"
  fi

  echo ""
}

# =============================================================================
# POSIX Compatibility
# =============================================================================

# Platform-aware sed in-place editing
# Usage: sed_in_place "file" "sed_expression"
# Works on both macOS (BSD sed) and Linux (GNU sed)
sed_in_place() {
  local file="$1"
  shift
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@" "$file"
  else
    sed -i "$@" "$file"
  fi
}

# =============================================================================
# Path Utilities
# =============================================================================

# Get the repository root (where .git is)
# Can be overridden with SPECFLOW_PROJECT_ROOT env var (useful for testing)
get_repo_root() {
  if [[ -n "${SPECFLOW_PROJECT_ROOT:-}" ]]; then
    echo "$SPECFLOW_PROJECT_ROOT"
    return
  fi
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

# Get the SpecFlow system directory
get_specflow_system_dir() {
  echo "${HOME}/.claude/specflow-system"
}

# Get the SpecFlow registry file path
get_specflow_registry() {
  echo "${HOME}/.specflow/registry.json"
}

# Get the project's .specify directory
get_specify_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  echo "${repo_root}/.specify"
}

# Get the state file path
get_state_file() {
  echo "$(get_specify_dir)/orchestration-state.json"
}

# Check if we're in a git repository
is_git_repo() {
  git rev-parse --git-dir &>/dev/null
}

# Check if we're in a SpecFlow project
is_specflow_project() {
  [[ -d "$(get_specify_dir)" ]]
}

# =============================================================================
# Dependency Checking
# =============================================================================

# Check if a command exists
command_exists() {
  command -v "$1" &>/dev/null
}

# Require a command or exit with error
require_command() {
  local cmd="$1"
  local install_hint="${2:-}"

  if ! command_exists "$cmd"; then
    log_error "Required command not found: $cmd"
    if [[ -n "$install_hint" ]]; then
      echo "  Install with: $install_hint" >&2
    fi
    exit 1
  fi
}

# Check for jq (required for JSON operations)
require_jq() {
  if ! command_exists jq; then
    log_error "jq is required for JSON operations but not installed."
    echo "" >&2
    echo "Install jq:" >&2
    echo "  macOS:  brew install jq" >&2
    echo "  Ubuntu: sudo apt-get install jq" >&2
    echo "  Fedora: sudo dnf install jq" >&2
    exit 1
  fi
}

# =============================================================================
# File Operations
# =============================================================================

# Ensure a directory exists
ensure_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    mkdir -p "$dir"
    log_debug "Created directory: $dir"
  fi
}

# Check if file exists and is readable
file_exists() {
  [[ -f "$1" ]] && [[ -r "$1" ]]
}

# Get file modification timestamp (ISO format)
get_file_mtime() {
  local file="$1"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%S" "$file"
  else
    stat -c "%y" "$file" | cut -d'.' -f1 | tr ' ' 'T'
  fi
}

# =============================================================================
# Date/Time
# =============================================================================

# Get current ISO timestamp
iso_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Get current date
current_date() {
  date +"%Y-%m-%d"
}

# =============================================================================
# User Interaction
# =============================================================================

# Confirm action (returns 0 for yes, 1 for no)
confirm() {
  local prompt="${1:-Continue?}"
  local default="${2:-n}"

  local yn_prompt
  if [[ "$default" == "y" ]]; then
    yn_prompt="[Y/n]"
  else
    yn_prompt="[y/N]"
  fi

  read -r -p "$prompt $yn_prompt " response
  response="${response:-$default}"

  case "$response" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

# =============================================================================
# Validation
# =============================================================================

# Validate that we're in a valid working context
validate_context() {
  if ! is_git_repo; then
    log_error "Not in a git repository"
    exit 1
  fi
}

# Validate that a SpecFlow project exists
validate_specflow_project() {
  if ! is_specflow_project; then
    log_error "Not a SpecFlow project (no .specify/ directory)"
    log_info "Run 'specflow scaffold' to initialize, or use /specflow.init"
    exit 1
  fi
}

# Validate that state file exists
validate_state_file() {
  local state_file
  state_file="$(get_state_file)"
  if [[ ! -f "$state_file" ]]; then
    log_error "State file not found: $state_file"
    log_info "Run 'specflow state init' to create one"
    exit 1
  fi
}

# =============================================================================
# JSON Output Mode
# =============================================================================

# Global flag for JSON output
SPECFLOW_JSON_OUTPUT="${SPECFLOW_JSON_OUTPUT:-0}"

# Enable JSON output mode
enable_json_output() {
  SPECFLOW_JSON_OUTPUT=1
}

# Check if JSON output is enabled
is_json_output() {
  [[ "$SPECFLOW_JSON_OUTPUT" == "1" ]]
}

# Output as JSON if JSON mode, otherwise run callback
output_or_json() {
  local json_data="$1"
  local callback="${2:-}"

  if is_json_output; then
    echo "$json_data"
  elif [[ -n "$callback" ]]; then
    $callback
  fi
}

# =============================================================================
# Argument Parsing Helpers
# =============================================================================

# Parse common flags from arguments
# Sets globals: SPECFLOW_VERBOSE, SPECFLOW_JSON_OUTPUT, REMAINING_ARGS
parse_common_flags() {
  SPECFLOW_VERBOSE=0
  SPECFLOW_JSON_OUTPUT=0
  REMAINING_ARGS=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -v|--verbose)
        SPECFLOW_VERBOSE=1
        shift
        ;;
      --json)
        SPECFLOW_JSON_OUTPUT=1
        shift
        ;;
      -h|--help)
        # Let individual scripts handle help
        REMAINING_ARGS+=("$1")
        shift
        ;;
      *)
        REMAINING_ARGS+=("$1")
        shift
        ;;
    esac
  done
}

# =============================================================================
# Exit Codes
# =============================================================================

readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_WARNING=2
readonly EXIT_USAGE=64  # EX_USAGE from sysexits.h

# =============================================================================
# Atomic File Operations
# =============================================================================

# Atomically write content to a file (write to temp, then move)
# Usage: atomic_write "content" "destination_file"
atomic_write() {
  local content="$1"
  local dest="$2"
  local temp_file

  temp_file=$(mktemp) || {
    log_error "Failed to create temporary file"
    return 1
  }

  # Write content to temp file
  if ! echo "$content" > "$temp_file" 2>/dev/null; then
    rm -f "$temp_file"
    log_error "Failed to write to temporary file"
    return 1
  fi

  # Move temp file to destination (atomic on POSIX systems)
  if ! mv "$temp_file" "$dest" 2>/dev/null; then
    rm -f "$temp_file"
    log_error "Failed to move temporary file to destination: $dest"
    return 1
  fi

  return 0
}

# Atomically update a file using a transform command
# Usage: atomic_transform "sed -e 's/foo/bar/'" "file"
atomic_transform() {
  local transform_cmd="$1"
  local file="$2"
  local temp_file

  if [[ ! -f "$file" ]]; then
    log_error "File not found: $file"
    return 1
  fi

  temp_file=$(mktemp) || {
    log_error "Failed to create temporary file"
    return 1
  }

  # Apply transform
  if ! eval "$transform_cmd \"$file\"" > "$temp_file" 2>/dev/null; then
    rm -f "$temp_file"
    log_error "Transform failed on: $file"
    return 1
  fi

  # Verify output is not empty (unless original was empty)
  if [[ ! -s "$temp_file" ]] && [[ -s "$file" ]]; then
    rm -f "$temp_file"
    log_error "Transform produced empty output, aborting"
    return 1
  fi

  # Move temp to destination
  if ! mv "$temp_file" "$file" 2>/dev/null; then
    rm -f "$temp_file"
    log_error "Failed to replace file: $file"
    return 1
  fi

  return 0
}

# Safely update file in place with cleanup on failure
# Usage: safe_file_update "file" "transform_function"
# The transform function receives temp_file as argument
safe_file_update() {
  local file="$1"
  local transform_func="$2"
  local temp_file
  local backup_file

  if [[ ! -f "$file" ]]; then
    log_error "File not found: $file"
    return 1
  fi

  temp_file=$(mktemp)
  backup_file="${file}.bak.$$"

  # Cleanup function
  cleanup() {
    rm -f "$temp_file" "$backup_file" 2>/dev/null || true
  }
  trap cleanup EXIT

  # Copy original to temp
  cp "$file" "$temp_file" || {
    log_error "Failed to copy file to temp"
    return 1
  }

  # Apply transform
  if ! "$transform_func" "$temp_file"; then
    log_error "Transform function failed"
    return 1
  fi

  # Create backup
  cp "$file" "$backup_file" || {
    log_error "Failed to create backup"
    return 1
  }

  # Replace original
  if mv "$temp_file" "$file"; then
    rm -f "$backup_file"
    return 0
  else
    # Restore from backup
    mv "$backup_file" "$file" 2>/dev/null || true
    log_error "Failed to update file, restored from backup"
    return 1
  fi
}

# =============================================================================
# Phase Number Validation
# =============================================================================

# Validate phase number format (ABBC or ABC)
# Usage: validate_phase_number "0041" "2.1" -> returns 0 (success)
#        validate_phase_number "041" "2.0"  -> returns 0 (success)
validate_phase_number() {
  local phase="$1"
  local format="${2:-2.1}"

  case "$format" in
    2.0)
      [[ "$phase" =~ ^[0-9]{3}$ ]]
      ;;
    2.1)
      [[ "$phase" =~ ^[0-9]{4}$ ]]
      ;;
    *)
      return 1
      ;;
  esac
}

# Normalize phase number with fuzzy matching
# Tries exact match first, then tries appending 0 for 3-digit inputs
# This handles both v1→v2 migration (001→0010) and partial matches (014→0140)
#
# Usage: normalize_phase_fuzzy "014" "/path/to/ROADMAP.md"
# Returns: The matched phase number (e.g., "0140") or empty string if not found
#
# Examples:
#   normalize_phase_fuzzy "014" "$roadmap"  -> "0140" (if 0140 exists)
#   normalize_phase_fuzzy "0140" "$roadmap" -> "0140" (exact match)
#   normalize_phase_fuzzy "001" "$roadmap"  -> "0010" (v1→v2 migration)
#   normalize_phase_fuzzy "14" "$roadmap"   -> "0140" (if 0140 exists)
#
normalize_phase_fuzzy() {
  local input="$1"
  local roadmap_path="$2"

  # Strip any non-numeric characters (e.g., "Phase 014" → "014")
  input=$(echo "$input" | tr -cd '0-9')

  if [[ -z "$input" ]]; then
    return 1
  fi

  # Convert to number (handles leading zeros) and back to 4-digit format
  local num
  num=$((10#${input})) 2>/dev/null || return 1

  # Try 4-digit format first (exact match)
  local phase4
  phase4=$(printf "%04d" "$num")

  if [[ -n "$roadmap_path" ]] && [[ -f "$roadmap_path" ]]; then
    # Check if exact 4-digit phase exists
    if grep -qE "^\|[[:space:]]*${phase4}[[:space:]]*\|" "$roadmap_path" 2>/dev/null; then
      echo "$phase4"
      return 0
    fi

    # Fuzzy match: if input looks like a 3-digit v1 phase or truncated v2 phase,
    # try appending 0 (e.g., "014" → "0140", "001" → "0010")
    # This handles:
    #   - v1 migration: 001, 002, 003 → 0010, 0020, 0030
    #   - Truncated input: 014, 015 → 0140, 0150
    if [[ $num -lt 1000 ]]; then
      local phase_expanded
      phase_expanded=$(printf "%04d" $((num * 10)))
      if grep -qE "^\|[[:space:]]*${phase_expanded}[[:space:]]*\|" "$roadmap_path" 2>/dev/null; then
        log_debug "Fuzzy match: $input → $phase_expanded"
        echo "$phase_expanded"
        return 0
      fi
    fi

    # No match found in roadmap
    return 1
  fi

  # No roadmap provided, just return normalized 4-digit format
  echo "$phase4"
  return 0
}

# =============================================================================
# Input Sanitization
# =============================================================================

# Sanitize a string for use in grep/jq patterns
# Escapes characters that have special meaning in regex/jq
sanitize_for_pattern() {
  local input="$1"
  # Escape regex special characters: \ . * + ? ^ $ { } [ ] | ( )
  printf '%s' "$input" | sed 's/[\\.*+?^${}[\]|()]/\\&/g'
}

# Sanitize for jq string interpolation
# Escapes characters that could break jq queries
sanitize_for_jq() {
  local input="$1"
  # Escape backslash and double quotes for jq
  printf '%s' "$input" | sed 's/\\/\\\\/g; s/"/\\"/g'
}
