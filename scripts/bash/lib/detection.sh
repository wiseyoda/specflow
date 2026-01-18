#!/usr/bin/env bash
#
# detection.sh - Project type detection library for SpecFlow
#
# Functions:
#   detect_project_type [path]  - Detect project type from markers
#   select_template_section     - Extract language section from template
#
# Project Types: typescript, javascript, rust, go, python, bash, generic
#

# Guard against double-sourcing
[[ -n "${_SPECFLOW_DETECTION_SH:-}" ]] && return 0
readonly _SPECFLOW_DETECTION_SH=1

# =============================================================================
# Project Type Detection
# =============================================================================

# Detect project type from root-level files
# Priority order (most specific first):
#   1. tsconfig.json → TypeScript
#   2. package.json (without tsconfig) → JavaScript
#   3. Cargo.toml → Rust
#   4. go.mod → Go
#   5. pyproject.toml / requirements.txt → Python
#   6. *.sh in root → Bash
#   7. (none) → Generic
#
# Args:
#   $1 - Path to check (default: current directory)
#
# Returns:
#   Prints one of: typescript, javascript, rust, go, python, bash, generic
#
detect_project_type() {
  local root="${1:-.}"

  # Resolve to absolute path
  if [[ -d "$root" ]]; then
    root="$(cd "$root" && pwd)"
  else
    echo "generic"
    return 0
  fi

  # Priority order: most specific first
  if [[ -f "${root}/tsconfig.json" ]]; then
    echo "typescript"
  elif [[ -f "${root}/package.json" ]]; then
    echo "javascript"
  elif [[ -f "${root}/Cargo.toml" ]]; then
    echo "rust"
  elif [[ -f "${root}/go.mod" ]]; then
    echo "go"
  elif [[ -f "${root}/pyproject.toml" ]] || [[ -f "${root}/requirements.txt" ]]; then
    echo "python"
  elif ls "${root}"/*.sh 1>/dev/null 2>&1; then
    echo "bash"
  else
    echo "generic"
  fi
}

# =============================================================================
# Template Section Extraction
# =============================================================================

# Extract language-specific section from template content
# Templates use markers: <!-- LANG:xxx --> ... <!-- /LANG:xxx -->
#
# Args:
#   $1 - Language type (typescript, python, rust, go, bash, generic)
#
# Input:
#   Content from stdin
#
# Returns:
#   Prints the content between the language markers
#   Falls back to generic section if specified language not found
#
# Usage:
#   cat template.md | select_template_section typescript
#   select_template_section python < template.md
#
select_template_section() {
  local lang="${1:-generic}"
  local content
  local section

  # Read content from stdin
  content="$(cat)"

  # Try to extract the specified language section using awk (more portable than sed)
  section=$(echo "$content" | awk -v lang="$lang" '
    BEGIN { printing = 0 }
    $0 ~ "<!-- LANG:" lang " -->" { printing = 1; next }
    $0 ~ "<!-- /LANG:" lang " -->" { printing = 0; next }
    printing { print }
  ')

  # If section is empty and lang is not generic, fall back to generic
  if [[ -z "$section" ]] && [[ "$lang" != "generic" ]]; then
    section=$(echo "$content" | awk '
      BEGIN { printing = 0 }
      /<!-- LANG:generic -->/ { printing = 1; next }
      /<!-- \/LANG:generic -->/ { printing = 0; next }
      printing { print }
    ')
  fi

  # If still empty, return the original content (template may not have sections)
  if [[ -z "$section" ]]; then
    echo "$content"
  else
    echo "$section"
  fi
}

# =============================================================================
# Utility Functions
# =============================================================================

# Get human-readable name for project type
#
# Args:
#   $1 - Project type code
#
# Returns:
#   Human-readable name
#
get_project_type_name() {
  local type="${1:-generic}"

  case "$type" in
    typescript) echo "TypeScript" ;;
    javascript) echo "JavaScript/Node.js" ;;
    rust)       echo "Rust" ;;
    go)         echo "Go" ;;
    python)     echo "Python" ;;
    bash)       echo "Bash/Shell" ;;
    generic)    echo "Generic" ;;
    *)          echo "Unknown" ;;
  esac
}

# Check if project type is valid
#
# Args:
#   $1 - Project type to validate
#
# Returns:
#   0 if valid, 1 if invalid
#
is_valid_project_type() {
  local type="${1:-}"

  case "$type" in
    typescript|javascript|rust|go|python|bash|generic)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
