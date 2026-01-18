#!/usr/bin/env bash
#
# specflow-doctor.sh - Diagnostics and auto-fix for SpecFlow projects
#
# Usage:
#   specflow doctor              Run all diagnostics
#   specflow doctor --fix        Auto-fix issues where possible
#   specflow doctor --check X    Check specific area
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Constants
# =============================================================================

# Use centralized path helper from common.sh
SPECFLOW_SYSTEM_DIR="$(get_specflow_system_dir)"
readonly SPECFLOW_SYSTEM_DIR

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
specflow doctor - Diagnostics and auto-fix for SpecFlow projects

USAGE:
    specflow doctor [options]
    specflow doctor --check <area>

OPTIONS:
    --fix               Auto-fix issues where possible
    --check <area>      Check specific area only
    --json              Output in JSON format
    -v, --verbose       Show detailed output
    -h, --help          Show this help

CHECK AREAS:
    system              SpecFlow system installation
    project             Project structure (.specify/)
    state               State file validity
    manifest            Version manifest validity and compatibility
    paths               Config path existence
    git                 Git repository status
    templates           Template versions
    version             Version file and updates
    roadmap             ROADMAP.md format version
    reality             State vs actual files comparison
    all                 Run all checks (default)

EXAMPLES:
    specflow doctor                  # Run all checks
    specflow doctor --fix            # Run and fix issues
    specflow doctor --check state    # Check state file only
    specflow doctor --check git      # Check git status only
EOF
}

# =============================================================================
# Check Functions
# =============================================================================

# Track issues for summary (POSIX-compatible, newline-delimited)
ISSUES=""
WARNINGS=""
FIXED=""
SUGGESTIONS=""

add_issue() {
  if [[ -n "$ISSUES" ]]; then
    ISSUES="${ISSUES}"$'\n'"$1"
  else
    ISSUES="$1"
  fi
}

add_warning() {
  if [[ -n "$WARNINGS" ]]; then
    WARNINGS="${WARNINGS}"$'\n'"$1"
  else
    WARNINGS="$1"
  fi
}

add_fixed() {
  if [[ -n "$FIXED" ]]; then
    FIXED="${FIXED}"$'\n'"$1"
  else
    FIXED="$1"
  fi
}

# Add a suggested fix command (deduplicates)
add_suggestion() {
  local cmd="$1"
  # Check if already suggested (avoid duplicates)
  if [[ -n "$SUGGESTIONS" ]]; then
    if ! echo "$SUGGESTIONS" | grep -qF "$cmd"; then
      SUGGESTIONS="${SUGGESTIONS}"$'\n'"$cmd"
    fi
  else
    SUGGESTIONS="$cmd"
  fi
}

# Check SpecFlow system installation
check_system() {
  local fix="${1:-false}"

  log_step "Checking SpecFlow system installation"

  # Check system directory
  if [[ -d "$SPECFLOW_SYSTEM_DIR" ]]; then
    print_status ok "System directory exists: $SPECFLOW_SYSTEM_DIR"
  else
    print_status error "System directory missing: $SPECFLOW_SYSTEM_DIR"
    add_issue "SpecFlow system not installed"
    return 1
  fi

  # Check CLI
  if [[ -x "${SPECFLOW_SYSTEM_DIR}/bin/specflow" ]]; then
    print_status ok "CLI executable found"
  else
    print_status error "CLI not found or not executable"
    add_issue "specflow CLI missing"
  fi

  # Check required scripts
  local required_scripts=("lib/common.sh" "lib/json.sh" "specflow-state.sh" "specflow-scaffold.sh")
  for script in "${required_scripts[@]}"; do
    if [[ -f "${SPECFLOW_SYSTEM_DIR}/scripts/bash/${script}" ]]; then
      print_status ok "Script: $script"
    else
      print_status error "Missing script: $script"
      add_issue "Missing script: $script"
    fi
  done

  # Check jq dependency
  if command_exists jq; then
    local jq_version
    jq_version=$(jq --version 2>/dev/null || echo "unknown")
    print_status ok "jq installed ($jq_version)"
  else
    print_status error "jq not installed"
    add_issue "jq is required but not installed"
  fi

  # Check templates directory
  if [[ -d "${SPECFLOW_SYSTEM_DIR}/templates" ]]; then
    local template_count
    template_count=$(find "${SPECFLOW_SYSTEM_DIR}/templates" -name "*.md" -o -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
    print_status ok "Templates directory ($template_count files)"
  else
    print_status warn "Templates directory missing"
    add_warning "No templates directory found"
  fi
}

# Check project structure
check_project() {
  local fix="${1:-false}"

  log_step "Checking project structure"

  local repo_root
  repo_root="$(get_repo_root)"
  local specify_dir="${repo_root}/.specify"

  # Check .specify directory
  if [[ -d "$specify_dir" ]]; then
    print_status ok ".specify/ directory exists"
  else
    print_status error ".specify/ directory missing"
    add_issue "Not a SpecFlow project (no .specify/)"

    if [[ "$fix" == "true" ]]; then
      log_info "Creating .specify/ structure..."
      if bash "${SCRIPT_DIR}/specflow-scaffold.sh" 2>/dev/null; then
        add_fixed "Created .specify/ directory structure"
        print_status ok "Created .specify/ structure"
      fi
    fi
    return
  fi

  # Check subdirectories (v2.1 structure)
  local required_dirs=("memory" "discovery" "phases" "history" "issues")
  local optional_dirs=("templates" "archive")
  local memory_subdirs=("adrs" "pdrs")

  for dir in "${required_dirs[@]}"; do
    if [[ -d "${specify_dir}/${dir}" ]]; then
      print_status ok "Directory: .specify/${dir}/"
    else
      print_status warn "Missing: .specify/${dir}/"
      add_warning "Missing directory: .specify/${dir}/"

      if [[ "$fix" == "true" ]]; then
        mkdir -p "${specify_dir}/${dir}"
        add_fixed "Created .specify/${dir}/"
      else
        add_suggestion "specflow doctor --fix"
      fi
    fi
  done

  # Check memory subdirectories
  for subdir in "${memory_subdirs[@]}"; do
    if [[ -d "${specify_dir}/memory/${subdir}" ]]; then
      print_status ok "Directory: .specify/memory/${subdir}/"
    else
      print_status warn "Missing: .specify/memory/${subdir}/"
      add_warning "Missing directory: .specify/memory/${subdir}/"

      if [[ "$fix" == "true" ]]; then
        mkdir -p "${specify_dir}/memory/${subdir}"
        add_fixed "Created .specify/memory/${subdir}/"
      else
        add_suggestion "specflow doctor --fix"
      fi
    fi
  done

  for dir in "${optional_dirs[@]}"; do
    if [[ -d "${specify_dir}/${dir}" ]]; then
      print_status ok "Directory: .specify/${dir}/"
    fi
  done

  # Check specs directory
  local specs_dir="${repo_root}/specs"
  if [[ -d "$specs_dir" ]]; then
    local spec_count
    spec_count=$(find "$specs_dir" -maxdepth 1 -type d -name "[0-9]*" 2>/dev/null | wc -l | tr -d ' ')
    print_status ok "specs/ directory ($spec_count feature(s))"
  else
    print_status pending "specs/ directory (none yet)"
  fi

  # Check ROADMAP.md
  if [[ -f "${repo_root}/ROADMAP.md" ]]; then
    print_status ok "ROADMAP.md exists"
  else
    print_status warn "ROADMAP.md missing"
    add_warning "ROADMAP.md not found"
    add_suggestion "specflow doctor --fix"

    if [[ "$fix" == "true" ]]; then
      local project_name
      project_name=$(basename "$repo_root")
      cat > "${repo_root}/ROADMAP.md" << EOF
# ${project_name} Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.

**Project**: ${project_name}
**Created**: $(date +%Y-%m-%d)
**Schema Version**: 2.1 (ABBC numbering)
**Status**: Not Started

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | (first-phase) | ⬜ Not Started | (define gate) |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phases

### 0010 - (First Phase Name)

**Goal**: (Define the goal)

**Verification Gate**: (How to verify completion)

EOF
      add_fixed "Created ROADMAP.md stub"
      print_status ok "Created ROADMAP.md"
    fi
  fi

  # Check CLAUDE.md
  if [[ -f "${repo_root}/CLAUDE.md" ]]; then
    print_status ok "CLAUDE.md exists"
  else
    print_status pending "CLAUDE.md (not created yet)"
  fi
}

# Check state file
check_state() {
  local fix="${1:-false}"

  log_step "Checking state file"

  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    print_status error "State file not found: $state_file"
    add_issue "State file missing"

    if [[ "$fix" == "true" ]]; then
      log_info "Initializing state file..."
      if bash "${SCRIPT_DIR}/specflow-state.sh" init --force 2>/dev/null; then
        add_fixed "Created state file"
        print_status ok "Created state file"
      fi
    fi
    return
  fi

  print_status ok "State file exists"

  # Validate JSON syntax
  if jq '.' "$state_file" >/dev/null 2>&1; then
    print_status ok "Valid JSON syntax"
  else
    print_status error "Invalid JSON syntax"
    add_issue "State file has invalid JSON"

    if [[ "$fix" == "true" ]]; then
      log_info "Reinitializing state file..."
      if bash "${SCRIPT_DIR}/specflow-state.sh" init --force 2>/dev/null; then
        add_fixed "Recreated state file with valid JSON"
      fi
    fi
    return
  fi

  # Check version (schema_version for v2.0, version for v1.x)
  local version
  version=$(jq -r '.schema_version // .version // empty' "$state_file" 2>/dev/null || echo "")
  if [[ -n "$version" ]]; then
    print_status ok "Schema version: $version"
    if [[ "$version" == "1.0" ]]; then
      add_warning "State file is v1.0 - run 'specflow state migrate' to upgrade"
    elif [[ "$version" != "2.0" ]]; then
      add_warning "State file version $version (latest is 2.0)"
    fi
  else
    print_status warn "Missing version field"
    add_warning "State file missing version"
  fi

  # Check required sections
  local sections=("config" "project" "interview" "orchestration")
  local missing_sections=()
  for section in "${sections[@]}"; do
    if jq -e ".$section" "$state_file" >/dev/null 2>&1; then
      print_status ok "Section: $section"
    else
      print_status error "Missing section: $section"
      add_issue "State missing section: $section"
      missing_sections+=("$section")
    fi
  done

  # Fix missing sections by re-initializing state
  if [[ ${#missing_sections[@]} -gt 0 && "$fix" == "true" ]]; then
    log_info "Re-initializing state to add missing sections..."
    if bash "${SCRIPT_DIR}/specflow-state.sh" init --force 2>/dev/null; then
      add_fixed "Re-initialized state file with all sections"
      print_status ok "Re-initialized state file"
    else
      print_status error "Failed to re-initialize state"
    fi
  fi

  # Staleness detection: Check if state claims in_progress but is stale
  local step_status
  step_status=$(jq -r '.orchestration.step.status // empty' "$state_file" 2>/dev/null || echo "")

  if [[ "$step_status" == "in_progress" ]]; then
    local last_updated
    last_updated=$(jq -r '.last_updated // empty' "$state_file" 2>/dev/null || echo "")

    if [[ -n "$last_updated" ]]; then
      # Get timestamps in seconds
      local now_ts last_ts diff_minutes
      now_ts=$(date +%s)

      # Try to parse ISO timestamp (cross-platform approach)
      if command -v gdate >/dev/null 2>&1; then
        # macOS with coreutils
        last_ts=$(gdate -d "$last_updated" +%s 2>/dev/null || echo "0")
      else
        # Linux
        last_ts=$(date -d "$last_updated" +%s 2>/dev/null || echo "0")
      fi

      if [[ "$last_ts" -gt 0 ]]; then
        diff_minutes=$(( (now_ts - last_ts) / 60 ))

        # Stale if > 5 minutes without update
        if [[ "$diff_minutes" -gt 5 ]]; then
          local step_current
          step_current=$(jq -r '.orchestration.step.current // "unknown"' "$state_file" 2>/dev/null || echo "unknown")
          print_status warn "Step '$step_current' shows in_progress but last update was ${diff_minutes}m ago"
          add_warning "Potentially stale state: in_progress for ${diff_minutes} minutes"

          if [[ "$fix" == "true" ]]; then
            log_info "Marking stale step as 'pending' for retry..."
            if jq '.orchestration.step.status = "pending"' "$state_file" > "${state_file}.tmp" && \
               mv "${state_file}.tmp" "$state_file"; then
              add_fixed "Reset stale in_progress step to pending"
              print_status ok "Reset step status to pending"
            fi
          fi
        else
          print_status ok "Step in_progress (active: ${diff_minutes}m ago)"
        fi
      fi
    fi
  fi

  # Check for failed status (requires user intervention)
  if [[ "$step_status" == "failed" ]]; then
    local step_current
    step_current=$(jq -r '.orchestration.step.current // "unknown"' "$state_file" 2>/dev/null || echo "unknown")
    print_status warn "Step '$step_current' is in failed state"
    add_warning "Failed step detected: $step_current"
    add_suggestion "specflow state set \"orchestration.step.status=pending\" # to retry"
  fi
}

# Check version manifest
check_manifest() {
  local fix="${1:-false}"

  log_step "Checking version manifest"

  local repo_root
  repo_root="$(get_repo_root)"
  local manifest_file="${repo_root}/.specify/manifest.json"

  if [[ ! -f "$manifest_file" ]]; then
    print_status warn "Manifest file not found: .specify/manifest.json"
    add_warning "Version manifest missing"

    if [[ "$fix" == "true" ]]; then
      log_info "Creating version manifest..."
      if bash "${SCRIPT_DIR}/specflow-manifest.sh" init 2>/dev/null; then
        add_fixed "Created version manifest"
        print_status ok "Created manifest.json"
      else
        print_status error "Failed to create manifest"
      fi
    else
      add_suggestion "specflow doctor --fix"
    fi
    return
  fi

  print_status ok "Manifest file exists"

  # Validate JSON syntax
  if ! jq '.' "$manifest_file" >/dev/null 2>&1; then
    print_status error "Invalid JSON in manifest.json"
    add_issue "Manifest has invalid JSON"

    if [[ "$fix" == "true" ]]; then
      log_info "Recreating manifest..."
      if bash "${SCRIPT_DIR}/specflow-manifest.sh" init --force 2>/dev/null; then
        add_fixed "Recreated manifest with valid JSON"
      fi
    fi
    return
  fi

  # Check manifest schema version
  local manifest_schema
  manifest_schema=$(jq -r '.manifest_schema // empty' "$manifest_file" 2>/dev/null)
  if [[ -n "$manifest_schema" ]]; then
    print_status ok "Manifest schema: v$manifest_schema"
  else
    print_status warn "Missing manifest_schema field"
    add_warning "Manifest missing schema version"
  fi

  # Check specflow version
  local manifest_specflow_version
  manifest_specflow_version=$(jq -r '.specflow_version // empty' "$manifest_file" 2>/dev/null)
  if [[ -n "$manifest_specflow_version" ]]; then
    print_status ok "SpecFlow version in manifest: v$manifest_specflow_version"

    # Compare with actual CLI version
    if command_exists specflow; then
      local cli_version
      cli_version=$(specflow version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
      if [[ "$cli_version" != "unknown" && "$cli_version" != "$manifest_specflow_version" ]]; then
        print_status warn "CLI version mismatch: manifest=${manifest_specflow_version}, installed=${cli_version}"
        add_warning "Manifest version differs from installed CLI"
        add_suggestion "specflow manifest upgrade"
      fi
    fi
  else
    print_status warn "Missing specflow_version in manifest"
    add_warning "Manifest missing SpecFlow version"
  fi

  # Check minimum CLI compatibility
  local min_cli
  min_cli=$(jq -r '.compatibility.min_cli // empty' "$manifest_file" 2>/dev/null)
  if [[ -n "$min_cli" ]]; then
    if command_exists specflow; then
      local cli_version
      cli_version=$(specflow version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "0.0.0")

      # Simple version comparison (major.minor.patch)
      local min_major min_minor min_patch cli_major cli_minor cli_patch
      IFS='.' read -r min_major min_minor min_patch <<< "$min_cli"
      IFS='.' read -r cli_major cli_minor cli_patch <<< "$cli_version"

      local cli_ok=true
      if [[ "$cli_major" -lt "$min_major" ]]; then
        cli_ok=false
      elif [[ "$cli_major" -eq "$min_major" && "$cli_minor" -lt "$min_minor" ]]; then
        cli_ok=false
      elif [[ "$cli_major" -eq "$min_major" && "$cli_minor" -eq "$min_minor" && "$cli_patch" -lt "$min_patch" ]]; then
        cli_ok=false
      fi

      if [[ "$cli_ok" == "true" ]]; then
        print_status ok "CLI meets minimum: v$cli_version >= v$min_cli"
      else
        print_status error "CLI too old: v$cli_version < v$min_cli required"
        add_issue "CLI version $cli_version below required minimum $min_cli"
        add_suggestion "./install.sh --upgrade"
      fi
    fi
  fi

  # Check schema versions match actual files
  local state_schema
  state_schema=$(jq -r '.schema.state // empty' "$manifest_file" 2>/dev/null)
  if [[ -n "$state_schema" ]]; then
    local state_file
    state_file="$(get_state_file)"
    if [[ -f "$state_file" ]]; then
      local actual_state_schema
      actual_state_schema=$(jq -r '.schema_version // .version // empty' "$state_file" 2>/dev/null)
      if [[ -n "$actual_state_schema" && "$actual_state_schema" != "$state_schema" ]]; then
        print_status warn "State schema mismatch: manifest=${state_schema}, actual=${actual_state_schema}"
        add_warning "State schema version differs from manifest"
      else
        print_status ok "State schema matches: v$state_schema"
      fi
    fi
  fi

  # Run full validation
  log_info "Running manifest validation..."
  if bash "${SCRIPT_DIR}/specflow-manifest.sh" validate >/dev/null 2>&1; then
    print_status ok "Manifest validation passed"
  else
    print_status warn "Manifest validation has warnings"
    add_warning "Manifest has validation issues"
    add_suggestion "specflow manifest validate"
  fi
}

# Check config paths exist
check_paths() {
  local fix="${1:-false}"

  log_step "Checking configured paths"

  local state_file
  state_file="$(get_state_file)"
  local repo_root
  repo_root="$(get_repo_root)"

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file to check paths"
    return
  fi

  # Get config paths
  local paths
  paths=$(jq -r '.config // .project | to_entries[] | "\(.key)=\(.value)"' "$state_file" 2>/dev/null || echo "")

  if [[ -z "$paths" ]]; then
    print_status warn "No config paths defined"
    return
  fi

  while IFS='=' read -r key value; do
    [[ -z "$key" || "$value" == "null" ]] && continue

    # Skip non-path keys
    [[ ! "$key" =~ _path$ ]] && continue

    # Special handling for scripts_path - should point to central installation
    if [[ "$key" == "scripts_path" ]]; then
      if [[ "$value" == "~/.claude/specflow-system/scripts/" || "$value" == "${HOME}/.claude/specflow-system/scripts/" ]]; then
        # Expand ~ for checking
        local expanded_path="${value/#\~/$HOME}"
        if [[ -d "$expanded_path" ]]; then
          print_status ok "$key: $value (central)"
        else
          print_status error "$key: $value (central install missing)"
          add_issue "Central scripts not installed at $value"
        fi
      elif [[ "$value" == ".specify/scripts/" || "$value" == ".specify/scripts" ]]; then
        print_status warn "$key: $value (deprecated embedded path)"
        add_warning "scripts_path uses deprecated embedded location"
        if [[ "$fix" == "true" ]]; then
          jq '.config.scripts_path = "~/.claude/specflow-system/scripts/"' "$state_file" > "${state_file}.tmp" && mv "${state_file}.tmp" "$state_file"
          add_fixed "Updated scripts_path to central installation"
          print_status ok "Updated scripts_path to central"
        else
          add_suggestion "specflow doctor --fix"
        fi
      else
        print_status warn "$key: $value (non-standard path)"
      fi
      continue
    fi

    local full_path="${repo_root}/${value}"

    # For files, check if exists
    if [[ "$key" == "roadmap_path" ]]; then
      if [[ -f "$full_path" ]]; then
        print_status ok "$key: $value"
      else
        print_status pending "$key: $value (not created yet)"
      fi
    else
      # For directories
      if [[ -d "$full_path" ]]; then
        print_status ok "$key: $value"
      else
        print_status warn "$key: $value (directory missing)"
        add_warning "Config path missing: $value"

        if [[ "$fix" == "true" ]]; then
          mkdir -p "$full_path"
          add_fixed "Created directory: $value"
        fi
      fi
    fi
  done <<< "$paths"
}

# Check git status
check_git() {
  local fix="${1:-false}"

  log_step "Checking git repository"

  if ! is_git_repo; then
    print_status error "Not a git repository"
    add_issue "Not in a git repository"
    return
  fi

  print_status ok "Git repository detected"

  # Check for .gitignore
  local repo_root
  repo_root="$(get_repo_root)"

  if [[ -f "${repo_root}/.gitignore" ]]; then
    print_status ok ".gitignore exists"

    # Check if .specify is ignored (it shouldn't be entirely)
    if grep -qE '^\.specify/?$' "${repo_root}/.gitignore" 2>/dev/null; then
      print_status warn ".specify/ is fully ignored in .gitignore"
      add_warning ".specify/ should not be fully ignored"
    fi
  else
    print_status pending "No .gitignore file"
  fi

  # Check for uncommitted changes
  local changes
  changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$changes" -eq 0 ]]; then
    print_status ok "Working tree clean"
  else
    print_status pending "$changes uncommitted change(s)"
  fi

  # Check current branch
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  print_status ok "Current branch: $branch"

  # Check if ahead/behind remote
  local upstream
  upstream=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
  if [[ -n "$upstream" ]]; then
    local ahead behind
    ahead=$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo "0")
    behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo "0")

    if [[ "$behind" -gt 0 ]]; then
      print_status warn "Behind upstream by $behind commit(s)"
      add_warning "Branch is behind upstream"
    elif [[ "$ahead" -gt 0 ]]; then
      print_status pending "Ahead of upstream by $ahead commit(s)"
    else
      print_status ok "Up to date with upstream"
    fi
  else
    print_status pending "No upstream tracking branch"
  fi
}

# Check templates
check_templates() {
  local fix="${1:-false}"

  log_step "Checking templates"

  local repo_root
  repo_root="$(get_repo_root)"
  local project_templates="${repo_root}/.specify/templates"
  local system_templates="${SPECFLOW_SYSTEM_DIR}/templates"

  if [[ ! -d "$system_templates" ]]; then
    print_status warn "System templates not found"
    add_warning "No system templates directory"
    return
  fi

  if [[ ! -d "$project_templates" ]]; then
    print_status pending "No project templates (using system defaults)"
    return
  fi

  # Use specflow templates check for accurate comparison
  # This ensures doctor uses the same logic as the templates command
  local templates_output
  if templates_output=$(bash "${SCRIPT_DIR}/specflow-templates.sh" check 2>/dev/null); then
    # Parse the output - count outdated and new templates
    local outdated current new_templates
    outdated=$(echo "$templates_output" | grep -c '^[[:space:]]*!' 2>/dev/null) || outdated=0
    current=$(echo "$templates_output" | grep -c '^[[:space:]]*✓' 2>/dev/null) || current=0
    new_templates=$(echo "$templates_output" | grep -c '^[[:space:]]*◯' 2>/dev/null) || new_templates=0

    if [[ "$outdated" -gt 0 || "$new_templates" -gt 0 ]]; then
      # Show individual template status
      while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*✓ ]]; then
          # Extract filename and version from "  ✓ filename.md (vX.X)"
          local name version
          name=$(echo "$line" | sed 's/^[[:space:]]*✓[[:space:]]*//' | sed 's/ (v.*//')
          version=$(echo "$line" | grep -oE 'v[0-9]+\.[0-9]+' | sed 's/^v//' || echo "")
          if [[ -n "$version" ]]; then
            print_status ok "$name (v$version)"
          else
            print_status ok "$name"
          fi
        elif [[ "$line" =~ ^[[:space:]]*! ]]; then
          # Extract from "  ! filename.md: vX.X -> vY.Y available"
          local info
          info=$(echo "$line" | sed 's/^[[:space:]]*![[:space:]]*//')
          print_status warn "$info"
        elif [[ "$line" =~ ^[[:space:]]*◯ ]]; then
          # New template not in project: "  ◯ filename.md (vX.X) - not in project"
          local info
          info=$(echo "$line" | sed 's/^[[:space:]]*◯[[:space:]]*//')
          print_status pending "$info"
        fi
      done <<< "$templates_output"

      [[ "$outdated" -gt 0 ]] && add_warning "$outdated template(s) have updates available"
      if [[ "$new_templates" -gt 0 ]]; then
        add_issue "$new_templates required template(s) missing from project"
      fi
      add_suggestion "specflow templates sync"
    else
      # All current - show summary
      print_status ok "All $current template(s) are current"
    fi
  else
    # Fallback: basic check if templates script fails
    local count=0
    while IFS= read -r sys_template; do
      local filename
      filename=$(basename "$sys_template")
      local proj_template="${project_templates}/${filename}"
      if [[ -f "$proj_template" ]]; then
        print_status ok "$filename"
        ((count++)) || true
      fi
    done < <(find "$system_templates" \( -name "*.md" -o -name "*.yaml" \) 2>/dev/null)
    print_status ok "$count template(s) found"
  fi
}

# Check version file
check_version() {
  local fix="${1:-false}"

  log_step "Checking version"

  # Check for VERSION file in system installation
  local version_file="${SPECFLOW_SYSTEM_DIR}/VERSION"

  if [[ -f "$version_file" ]]; then
    local installed_version
    installed_version=$(cat "$version_file" | tr -d '\n')
    print_status ok "VERSION file exists: v${installed_version}"

    # Check if specflow command returns same version
    if command_exists specflow; then
      local cli_version
      cli_version=$(specflow version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
      if [[ "$cli_version" == "$installed_version" ]]; then
        print_status ok "CLI version matches: v${cli_version}"
      else
        print_status warn "CLI version mismatch: file=${installed_version}, cli=${cli_version}"
        add_warning "Version mismatch between VERSION file and CLI"
      fi
    fi
  else
    print_status error "VERSION file missing: $version_file"
    add_issue "VERSION file not found in installation"

    if [[ "$fix" == "true" ]]; then
      # Try to get version from CLI and create file
      if command_exists specflow; then
        local cli_version
        cli_version=$(specflow version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "2.0.0")
        echo "$cli_version" > "$version_file"
        add_fixed "Created VERSION file with v${cli_version}"
        print_status ok "Created VERSION file"
      fi
    fi
  fi
}

# Check ROADMAP format version
check_roadmap() {
  local fix="${1:-false}"

  log_step "Checking ROADMAP format"

  local repo_root
  repo_root="$(get_repo_root)"
  local roadmap_path="${repo_root}/ROADMAP.md"

  if [[ ! -f "$roadmap_path" ]]; then
    print_status pending "ROADMAP.md not found (not created yet)"
    return
  fi

  # Detect format using same logic as specflow-migrate.sh
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
    print_status error "ROADMAP has mixed format (both 3-digit and 4-digit phases)"
    add_issue "ROADMAP.md has inconsistent phase number format"
    add_suggestion "specflow migrate roadmap --dry-run"
  elif $has_4digit; then
    print_status ok "ROADMAP format: 2.1 (4-digit phases)"

    # Check for modular vs inline format
    local has_inline_phases=false
    local has_phase_files=false
    local phases_dir="${repo_root}/.specify/phases"

    # Check if ROADMAP has inline phase sections (### NNNN - ...)
    if grep -qE '^###[[:space:]]*[0-9]{4}[[:space:]]*-' "$roadmap_path" 2>/dev/null; then
      has_inline_phases=true
    fi

    # Check if phase files exist
    if [[ -d "$phases_dir" ]] && [[ -n "$(find "$phases_dir" -maxdepth 1 -name '*.md' 2>/dev/null | head -1)" ]]; then
      has_phase_files=true
    fi

    if $has_inline_phases && ! $has_phase_files; then
      print_status warn "ROADMAP has inline phases (modular format recommended)"
      add_warning "ROADMAP.md has inline phase sections - consider migrating to modular format"
      if [[ "$fix" == "true" ]]; then
        log_info "Migrating to modular format..."
        if bash "${SCRIPT_DIR}/specflow-phase.sh" migrate --collapse 2>/dev/null; then
          add_fixed "Migrated ROADMAP to modular format with phase files"
          print_status ok "Migrated to modular format"
        else
          print_status error "Failed to migrate to modular format"
          add_issue "Modular format migration failed"
        fi
      else
        add_suggestion "specflow phase migrate --collapse"
      fi
    elif $has_inline_phases && $has_phase_files; then
      print_status warn "ROADMAP has both inline phases and phase files (mixed state)"
      add_warning "ROADMAP.md has inline phases but .specify/phases/ also has files"
      add_suggestion "specflow phase migrate --collapse"
    elif $has_phase_files; then
      print_status ok "ROADMAP uses modular format (phases in .specify/phases/)"
    fi

  elif $has_3digit; then
    print_status warn "ROADMAP format: 2.0 (3-digit phases) - upgrade available"
    add_warning "ROADMAP.md uses legacy 3-digit phases"

    if [[ "$fix" == "true" ]]; then
      log_info "Migrating ROADMAP to 4-digit phases..."
      if bash "${SCRIPT_DIR}/specflow-migrate.sh" roadmap 2>/dev/null; then
        add_fixed "Migrated ROADMAP.md to 2.1 format (4-digit phases)"
        print_status ok "Migrated ROADMAP to 2.1 format"
      else
        print_status error "Failed to migrate ROADMAP"
        add_issue "ROADMAP migration failed"
      fi
    else
      add_suggestion "specflow migrate roadmap"
    fi
  else
    print_status ok "ROADMAP exists (no phases defined yet)"
  fi
}

# Check reality - state vs actual files
check_reality() {
  local fix="${1:-false}"

  log_step "Checking state vs reality"

  local state_file
  state_file="$(get_state_file)"

  if [[ ! -f "$state_file" ]]; then
    print_status skip "No state file to compare"
    return
  fi

  # If fix mode, offer to use file-based inference
  if [[ "$fix" == "true" ]]; then
    log_info "Running file-based state inference..."
    if bash "${SCRIPT_DIR}/specflow-state.sh" infer --apply 2>/dev/null; then
      add_fixed "Recovered state from file system"
    fi
    return
  fi

  local repo_root
  repo_root="$(get_repo_root)"

  # Check specify step completion vs spec.md existence
  local specify_status
  specify_status=$(jq -r '.orchestration.steps.specify.status // "pending"' "$state_file" 2>/dev/null)
  local current_phase
  current_phase=$(jq -r '.orchestration.phase_number // empty' "$state_file" 2>/dev/null)

  if [[ -n "$current_phase" ]]; then
    local phase_dir
    phase_dir=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "${current_phase}-*" 2>/dev/null | head -1)

    # Check spec.md
    if [[ "$specify_status" == "completed" ]]; then
      if [[ -n "$phase_dir" && -f "${phase_dir}/spec.md" ]]; then
        print_status ok "Specify: state=completed, spec.md exists"
      else
        print_status error "Specify: state=completed but spec.md missing"
        add_issue "State says specify complete but spec.md not found"
      fi
    elif [[ "$specify_status" == "pending" ]]; then
      if [[ -n "$phase_dir" && -f "${phase_dir}/spec.md" ]]; then
        print_status warn "Specify: state=pending but spec.md exists"
        add_warning "spec.md exists but state says specify pending"
      else
        print_status ok "Specify: state=pending, no spec.md"
      fi
    fi

    # Check plan.md
    local plan_status
    plan_status=$(jq -r '.orchestration.steps.plan.status // "pending"' "$state_file" 2>/dev/null)

    if [[ "$plan_status" == "completed" ]]; then
      if [[ -n "$phase_dir" && -f "${phase_dir}/plan.md" ]]; then
        print_status ok "Plan: state=completed, plan.md exists"
      else
        print_status error "Plan: state=completed but plan.md missing"
        add_issue "State says plan complete but plan.md not found"
      fi
    elif [[ "$plan_status" == "pending" ]]; then
      if [[ -n "$phase_dir" && -f "${phase_dir}/plan.md" ]]; then
        print_status warn "Plan: state=pending but plan.md exists"
        add_warning "plan.md exists but state says plan pending"
      fi
    fi

    # Check tasks.md
    local tasks_status
    tasks_status=$(jq -r '.orchestration.steps.tasks.status // "pending"' "$state_file" 2>/dev/null)

    if [[ "$tasks_status" == "completed" ]]; then
      if [[ -n "$phase_dir" && -f "${phase_dir}/tasks.md" ]]; then
        print_status ok "Tasks: state=completed, tasks.md exists"
      else
        print_status error "Tasks: state=completed but tasks.md missing"
        add_issue "State says tasks complete but tasks.md not found"
      fi
    elif [[ "$tasks_status" == "pending" ]]; then
      if [[ -n "$phase_dir" && -f "${phase_dir}/tasks.md" ]]; then
        print_status warn "Tasks: state=pending but tasks.md exists"
        add_warning "tasks.md exists but state says tasks pending"
      fi
    fi
  else
    print_status ok "No active phase - skipping file checks"
  fi

  # Compare task completion count
  local state_tasks_completed
  state_tasks_completed=$(jq -r '.orchestration.steps.implement.tasks_completed // 0' "$state_file" 2>/dev/null)
  local state_tasks_total
  state_tasks_total=$(jq -r '.orchestration.steps.implement.tasks_total // 0' "$state_file" 2>/dev/null)

  if [[ -n "${phase_dir:-}" && -f "${phase_dir}/tasks.md" ]]; then
    local file_completed file_total
    # Use grep | wc -l instead of grep -c to avoid exit code 1 when count is 0
    file_completed=$(grep '^\s*- \[x\]' "${phase_dir}/tasks.md" 2>/dev/null | wc -l | tr -d ' ')
    file_total=$(grep '^\s*- \[' "${phase_dir}/tasks.md" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$state_tasks_completed" -eq "$file_completed" && "$state_tasks_total" -eq "$file_total" ]]; then
      print_status ok "Task counts: ${file_completed}/${file_total} (in sync)"
    else
      print_status warn "Task counts: state=${state_tasks_completed}/${state_tasks_total}, file=${file_completed}/${file_total}"
      add_warning "Task completion counts don't match"

      if [[ "$fix" == "true" ]]; then
        json_set "$state_file" ".orchestration.steps.implement.tasks_completed" "$file_completed"
        json_set "$state_file" ".orchestration.steps.implement.tasks_total" "$file_total"
        add_fixed "Updated task counts from file"
        print_status ok "Fixed task counts"
      fi
    fi
  fi
}

# =============================================================================
# Main Check Runner
# =============================================================================

run_checks() {
  local check_area="${1:-all}"
  local fix="${2:-false}"

  case "$check_area" in
    system)
      check_system "$fix"
      ;;
    project)
      check_project "$fix"
      ;;
    state)
      check_state "$fix"
      ;;
    manifest)
      check_manifest "$fix"
      ;;
    paths)
      check_paths "$fix"
      ;;
    git)
      check_git "$fix"
      ;;
    templates)
      check_templates "$fix"
      ;;
    version)
      check_version "$fix"
      ;;
    roadmap)
      check_roadmap "$fix"
      ;;
    reality)
      check_reality "$fix"
      ;;
    all)
      check_system "$fix"
      echo ""
      check_project "$fix"
      echo ""
      check_state "$fix"
      echo ""
      check_manifest "$fix"
      echo ""
      check_paths "$fix"
      echo ""
      check_git "$fix"
      echo ""
      check_templates "$fix"
      echo ""
      check_version "$fix"
      echo ""
      check_roadmap "$fix"
      echo ""
      check_reality "$fix"
      ;;
    *)
      log_error "Unknown check area: $check_area"
      log_info "Valid areas: system, project, state, manifest, paths, git, templates, version, roadmap, reality, all"
      exit 1
      ;;
  esac
}

show_summary() {
  # Count items (POSIX-compatible, newline-delimited strings)
  local issue_count=0
  local warning_count=0
  local fixed_count=0

  if [[ -n "$ISSUES" ]]; then
    issue_count=$(echo "$ISSUES" | wc -l | tr -d ' ')
  fi
  if [[ -n "$WARNINGS" ]]; then
    warning_count=$(echo "$WARNINGS" | wc -l | tr -d ' ')
  fi
  if [[ -n "$FIXED" ]]; then
    fixed_count=$(echo "$FIXED" | wc -l | tr -d ' ')
  fi

  echo ""
  # Three-Line Rule: Summary first
  if [[ $issue_count -eq 0 && $warning_count -eq 0 ]]; then
    echo -e "${GREEN}OK${RESET}: All checks passed"
    if [[ $fixed_count -gt 0 ]]; then
      echo "  Fixed: $fixed_count issue(s)"
    fi
  elif [[ $issue_count -eq 0 ]]; then
    echo -e "${YELLOW}WARN${RESET}: $warning_count warning(s)"
    if [[ $fixed_count -gt 0 ]]; then
      echo "  Fixed: $fixed_count issue(s)"
    fi
  else
    echo -e "${RED}ERROR${RESET}: $issue_count issue(s), $warning_count warning(s)"
    if [[ $fixed_count -gt 0 ]]; then
      echo "  Fixed: $fixed_count issue(s)"
    else
      echo "  Run: specflow doctor --fix"
    fi
  fi

  # Details (line 4+)
  if [[ $fixed_count -gt 0 ]]; then
    echo ""
    echo -e "${GREEN}Fixed:${RESET}"
    while IFS= read -r item; do
      [[ -n "$item" ]] && echo "  - $item"
    done <<< "$FIXED"
  fi

  if [[ $issue_count -gt 0 ]]; then
    echo ""
    echo -e "${RED}Issues:${RESET}"
    while IFS= read -r item; do
      [[ -n "$item" ]] && echo "  - $item"
    done <<< "$ISSUES"
  fi

  if [[ $warning_count -gt 0 ]]; then
    echo ""
    echo -e "${YELLOW}Warnings:${RESET}"
    while IFS= read -r item; do
      [[ -n "$item" ]] && echo "  - $item"
    done <<< "$WARNINGS"
  fi

  # Show suggested fix commands
  if [[ -n "$SUGGESTIONS" ]]; then
    echo ""
    echo -e "${CYAN}Suggested fixes:${RESET}"
    while IFS= read -r cmd; do
      [[ -n "$cmd" ]] && echo "  ${DIM}\$${RESET} $cmd"
    done <<< "$SUGGESTIONS"
  fi

  if is_json_output; then
    local issues_json warnings_json fixed_json suggestions_json
    if [[ -n "$ISSUES" ]]; then
      issues_json=$(echo "$ISSUES" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      issues_json="[]"
    fi
    if [[ -n "$WARNINGS" ]]; then
      warnings_json=$(echo "$WARNINGS" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      warnings_json="[]"
    fi
    if [[ -n "$FIXED" ]]; then
      fixed_json=$(echo "$FIXED" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      fixed_json="[]"
    fi
    if [[ -n "$SUGGESTIONS" ]]; then
      suggestions_json=$(echo "$SUGGESTIONS" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      suggestions_json="[]"
    fi

    echo ""
    echo "{\"issues\": $issues_json, \"warnings\": $warnings_json, \"fixed\": $fixed_json, \"suggestions\": $suggestions_json}"
  fi

  # Return appropriate exit code
  if [[ $issue_count -gt 0 ]]; then
    return 1
  elif [[ $warning_count -gt 0 ]]; then
    return 2
  fi
  return 0
}

# =============================================================================
# Main
# =============================================================================

main() {
  local fix=false
  local check_area="all"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --fix)
        fix=true
        shift
        ;;
      --check)
        check_area="${2:-all}"
        shift 2
        ;;
      --json)
        enable_json_output
        shift
        ;;
      -v|--verbose)
        export SPECFLOW_DEBUG=1
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Run 'specflow doctor --help' for usage"
        exit 1
        ;;
    esac
  done

  run_checks "$check_area" "$fix"
  show_summary
}

main "$@"
