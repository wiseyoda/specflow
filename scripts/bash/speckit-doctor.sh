#!/usr/bin/env bash
#
# speckit-doctor.sh - Diagnostics and auto-fix for SpecKit projects
#
# Usage:
#   speckit doctor              Run all diagnostics
#   speckit doctor --fix        Auto-fix issues where possible
#   speckit doctor --check X    Check specific area
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Constants
# =============================================================================

readonly SPECKIT_SYSTEM_DIR="${HOME}/.claude/speckit-system"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit doctor - Diagnostics and auto-fix for SpecKit projects

USAGE:
    speckit doctor [options]
    speckit doctor --check <area>

OPTIONS:
    --fix               Auto-fix issues where possible
    --check <area>      Check specific area only
    --json              Output in JSON format
    -v, --verbose       Show detailed output
    -h, --help          Show this help

CHECK AREAS:
    system              SpecKit system installation
    project             Project structure (.specify/)
    state               State file validity
    paths               Config path existence
    git                 Git repository status
    templates           Template versions
    all                 Run all checks (default)

EXAMPLES:
    speckit doctor                  # Run all checks
    speckit doctor --fix            # Run and fix issues
    speckit doctor --check state    # Check state file only
    speckit doctor --check git      # Check git status only
EOF
}

# =============================================================================
# Check Functions
# =============================================================================

# Track issues for summary
declare -a ISSUES=()
declare -a WARNINGS=()
declare -a FIXED=()

add_issue() {
  ISSUES+=("$1")
}

add_warning() {
  WARNINGS+=("$1")
}

add_fixed() {
  FIXED+=("$1")
}

# Check SpecKit system installation
check_system() {
  local fix="${1:-false}"

  log_step "Checking SpecKit system installation"

  # Check system directory
  if [[ -d "$SPECKIT_SYSTEM_DIR" ]]; then
    print_status ok "System directory exists: $SPECKIT_SYSTEM_DIR"
  else
    print_status error "System directory missing: $SPECKIT_SYSTEM_DIR"
    add_issue "SpecKit system not installed"
    return 1
  fi

  # Check CLI
  if [[ -x "${SPECKIT_SYSTEM_DIR}/bin/speckit" ]]; then
    print_status ok "CLI executable found"
  else
    print_status error "CLI not found or not executable"
    add_issue "speckit CLI missing"
  fi

  # Check required scripts
  local required_scripts=("lib/common.sh" "lib/json.sh" "speckit-state.sh" "speckit-scaffold.sh")
  for script in "${required_scripts[@]}"; do
    if [[ -f "${SPECKIT_SYSTEM_DIR}/scripts/bash/${script}" ]]; then
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
  if [[ -d "${SPECKIT_SYSTEM_DIR}/templates" ]]; then
    local template_count
    template_count=$(find "${SPECKIT_SYSTEM_DIR}/templates" -name "*.md" -o -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
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
    add_issue "Not a SpecKit project (no .specify/)"

    if [[ "$fix" == "true" ]]; then
      log_info "Creating .specify/ structure..."
      if bash "${SCRIPT_DIR}/speckit-scaffold.sh" 2>/dev/null; then
        add_fixed "Created .specify/ directory structure"
        print_status ok "Created .specify/ structure"
      fi
    fi
    return
  fi

  # Check subdirectories
  local subdirs=("discovery" "memory" "templates" "scripts")
  for dir in "${subdirs[@]}"; do
    if [[ -d "${specify_dir}/${dir}" ]]; then
      print_status ok "Directory: .specify/${dir}/"
    else
      print_status warn "Missing: .specify/${dir}/"
      add_warning "Missing directory: .specify/${dir}/"

      if [[ "$fix" == "true" ]]; then
        mkdir -p "${specify_dir}/${dir}"
        add_fixed "Created .specify/${dir}/"
      fi
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
    print_status pending "ROADMAP.md (not created yet)"
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
      if bash "${SCRIPT_DIR}/speckit-state.sh" init --force 2>/dev/null; then
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
      if bash "${SCRIPT_DIR}/speckit-state.sh" init --force 2>/dev/null; then
        add_fixed "Recreated state file with valid JSON"
      fi
    fi
    return
  fi

  # Check version
  local version
  version=$(jq -r '.version // empty' "$state_file" 2>/dev/null || echo "")
  if [[ -n "$version" ]]; then
    print_status ok "Version: $version"
    if [[ "$version" != "2.0" ]]; then
      add_warning "State file version $version (latest is 2.0)"
    fi
  else
    print_status warn "Missing version field"
    add_warning "State file missing version"
  fi

  # Check required sections
  local sections=("config" "project" "interview" "orchestration")
  for section in "${sections[@]}"; do
    if jq -e ".$section" "$state_file" >/dev/null 2>&1; then
      print_status ok "Section: $section"
    else
      print_status error "Missing section: $section"
      add_issue "State missing section: $section"
    fi
  done
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
  local system_templates="${SPECKIT_SYSTEM_DIR}/templates"

  if [[ ! -d "$system_templates" ]]; then
    print_status warn "System templates not found"
    add_warning "No system templates directory"
    return
  fi

  if [[ ! -d "$project_templates" ]]; then
    print_status pending "No project templates (using system defaults)"
    return
  fi

  # Compare template versions
  local outdated=0
  while IFS= read -r sys_template; do
    local filename
    filename=$(basename "$sys_template")
    local proj_template="${project_templates}/${filename}"

    if [[ -f "$proj_template" ]]; then
      # Check for version header
      local sys_version proj_version
      sys_version=$(grep -oE 'version:\s*[0-9.]+' "$sys_template" 2>/dev/null | head -1 | grep -oE '[0-9.]+' || echo "")
      proj_version=$(grep -oE 'version:\s*[0-9.]+' "$proj_template" 2>/dev/null | head -1 | grep -oE '[0-9.]+' || echo "")

      if [[ -n "$sys_version" && -n "$proj_version" ]]; then
        if [[ "$sys_version" != "$proj_version" ]]; then
          print_status warn "$filename: $proj_version -> $sys_version available"
          ((outdated++))
        else
          print_status ok "$filename: v$proj_version"
        fi
      else
        # Compare by modification time as fallback
        if [[ "$sys_template" -nt "$proj_template" ]]; then
          print_status warn "$filename: newer version available"
          ((outdated++))
        else
          print_status ok "$filename"
        fi
      fi
    fi
  done < <(find "$system_templates" -name "*.md" -o -name "*.yaml" 2>/dev/null)

  if [[ $outdated -gt 0 ]]; then
    add_warning "$outdated template(s) have updates available"
    log_info "Run 'speckit templates check' for details"
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
    paths)
      check_paths "$fix"
      ;;
    git)
      check_git "$fix"
      ;;
    templates)
      check_templates "$fix"
      ;;
    all)
      check_system "$fix"
      echo ""
      check_project "$fix"
      echo ""
      check_state "$fix"
      echo ""
      check_paths "$fix"
      echo ""
      check_git "$fix"
      echo ""
      check_templates "$fix"
      ;;
    *)
      log_error "Unknown check area: $check_area"
      log_info "Valid areas: system, project, state, paths, git, templates, all"
      exit 1
      ;;
  esac
}

show_summary() {
  echo ""
  print_header "Summary"
  echo ""

  local issue_count=${#ISSUES[@]}
  local warning_count=${#WARNINGS[@]}
  local fixed_count=${#FIXED[@]}

  if [[ $fixed_count -gt 0 ]]; then
    echo -e "${GREEN}Fixed ($fixed_count):${RESET}"
    for item in "${FIXED[@]}"; do
      echo "  - $item"
    done
    echo ""
  fi

  if [[ $issue_count -gt 0 ]]; then
    echo -e "${RED}Issues ($issue_count):${RESET}"
    for item in "${ISSUES[@]}"; do
      echo "  - $item"
    done
    echo ""
  fi

  if [[ $warning_count -gt 0 ]]; then
    echo -e "${YELLOW}Warnings ($warning_count):${RESET}"
    for item in "${WARNINGS[@]}"; do
      echo "  - $item"
    done
    echo ""
  fi

  if [[ $issue_count -eq 0 && $warning_count -eq 0 ]]; then
    log_success "All checks passed!"
  elif [[ $issue_count -eq 0 ]]; then
    log_success "No critical issues found ($warning_count warning(s))"
  else
    log_error "Found $issue_count issue(s) and $warning_count warning(s)"
    if [[ $fixed_count -eq 0 ]]; then
      log_info "Run 'speckit doctor --fix' to auto-fix issues"
    fi
  fi

  if is_json_output; then
    local issues_json warnings_json fixed_json
    if [[ ${#ISSUES[@]} -gt 0 ]]; then
      issues_json=$(printf '%s\n' "${ISSUES[@]}" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      issues_json="[]"
    fi
    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
      warnings_json=$(printf '%s\n' "${WARNINGS[@]}" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      warnings_json="[]"
    fi
    if [[ ${#FIXED[@]} -gt 0 ]]; then
      fixed_json=$(printf '%s\n' "${FIXED[@]}" | jq -R -s 'split("\n") | map(select(. != ""))')
    else
      fixed_json="[]"
    fi

    echo ""
    echo "{\"issues\": $issues_json, \"warnings\": $warnings_json, \"fixed\": $fixed_json}"
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
        export SPECKIT_DEBUG=1
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Run 'speckit doctor --help' for usage"
        exit 1
        ;;
    esac
  done

  if ! is_json_output; then
    print_header "SpecKit Doctor"
    echo ""
  fi

  run_checks "$check_area" "$fix"
  show_summary
}

main "$@"
