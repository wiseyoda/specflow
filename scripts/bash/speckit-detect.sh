#!/usr/bin/env bash
#
# speckit-detect.sh - Detect existing content and documentation in a project
#
# Usage:
#   speckit detect                  Scan for all detectable patterns
#   speckit detect --check docs     Check for existing documentation
#   speckit detect --check speckit  Check for SpecKit artifacts
#   speckit detect --check state    Check state file format/version
#
# This command is non-destructive - it only reads and reports.
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
SPECKIT_SYSTEM_DIR="$(get_speckit_system_dir)"
readonly SPECKIT_SYSTEM_DIR
readonly CURRENT_STATE_VERSION="2.0"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit detect - Detect existing content and documentation

USAGE:
    speckit detect [options]
    speckit detect --check <area>

OPTIONS:
    --check <area>      Check specific area only
    --json              Output in JSON format
    -h, --help          Show this help

CHECK AREAS:
    system              SpecKit system installation
    speckit             SpecKit project artifacts
    docs                Existing documentation
    state               State file format/version
    files               Key files (CLAUDE.md, ROADMAP.md)
    all                 Run all checks (default)

WHAT IT DETECTS:
    System Installation:
    • SpecKit CLI availability
    • System version vs installed version
    • Required dependencies (jq, git)

    SpecKit Artifacts:
    • .specify/ directory structure
    • State file existence and format
    • Discovery state (interview progress)
    • Specs directory and features

    Existing Documentation:
    • docs/ directory patterns
    • ADR/RFC patterns
    • API documentation (OpenAPI, Swagger)
    • Architecture documentation
    • Contributing guides

    Key Files:
    • CLAUDE.md (agent instructions)
    • ROADMAP.md (development phases)
    • README.md
    • ARCHITECTURE.md, CONTRIBUTING.md

EXAMPLES:
    speckit detect                  # Scan everything
    speckit detect --check docs     # Check for existing docs only
    speckit detect --json           # Output as JSON
EOF
}

# =============================================================================
# Detection Functions
# =============================================================================

# Detect system installation status
detect_system() {
  local results=()

  # Three-line rule: Status output first, skip decorative headers
  # Check if CLI is available
  if command_exists speckit; then
    local version
    if [[ -f "${SPECKIT_SYSTEM_DIR}/VERSION" ]]; then
      version=$(cat "${SPECKIT_SYSTEM_DIR}/VERSION" 2>/dev/null || echo "unknown")
    else
      version="unknown"
    fi
    print_status ok "SpecKit CLI installed (v${version})"
    results+=("\"cli\": {\"installed\": true, \"version\": \"$version\"}")
  else
    print_status error "SpecKit CLI not installed"
    results+=("\"cli\": {\"installed\": false, \"version\": null}")
  fi

  # Check jq
  if command_exists jq; then
    print_status ok "jq available"
    results+=("\"jq\": true")
  else
    print_status error "jq not installed"
    results+=("\"jq\": false")
  fi

  # Check git
  if command_exists git; then
    print_status ok "git available"
    results+=("\"git\": true")
  else
    print_status error "git not installed"
    results+=("\"git\": false")
  fi

  if is_json_output; then
    echo "{$(IFS=,; echo "${results[*]}")}"
  fi
}

# Detect SpecKit artifacts
detect_speckit() {
  local repo_root
  repo_root="$(get_repo_root 2>/dev/null || pwd)"

  # Three-line rule: Status output first, skip decorative headers
  local has_specify=false
  local has_state=false
  local state_version=""
  local has_discovery=false
  local discovery_phase=0
  local has_specs=false
  local spec_count=0

  # Check .specify/
  if [[ -d "${repo_root}/.specify" ]]; then
    has_specify=true
    print_status ok ".specify/ directory exists"

    # Check subdirectories
    for dir in discovery memory templates scripts; do
      if [[ -d "${repo_root}/.specify/${dir}" ]]; then
        print_status ok "  └─ ${dir}/"
      else
        print_status pending "  └─ ${dir}/ (missing)"
      fi
    done
  else
    print_status pending ".specify/ directory (not initialized)"
  fi

  # Check state file
  local state_file="${repo_root}/.specify/orchestration-state.json"
  if [[ -f "$state_file" ]]; then
    has_state=true
    if jq '.' "$state_file" >/dev/null 2>&1; then
      state_version=$(jq -r '.version // "unknown"' "$state_file" 2>/dev/null)
      print_status ok "State file (v${state_version})"

      if [[ "$state_version" != "$CURRENT_STATE_VERSION" ]]; then
        print_status warn "  └─ Migration available: v${state_version} → v${CURRENT_STATE_VERSION}"
      fi
    else
      print_status error "State file (invalid JSON)"
    fi
  else
    print_status pending "State file (not created)"
  fi

  # Check discovery state (old format)
  local discovery_state="${repo_root}/.specify/discovery/state.md"
  if [[ -f "$discovery_state" ]]; then
    has_discovery=true
    # Try to extract phase from state.md
    discovery_phase=$(grep -oE 'current_phase:\s*[0-9]+' "$discovery_state" 2>/dev/null | grep -oE '[0-9]+' || echo "0")
    print_status ok "Discovery state (phase ${discovery_phase})"
  fi

  # Check specs/
  if [[ -d "${repo_root}/specs" ]]; then
    has_specs=true
    spec_count=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "[0-9]*" 2>/dev/null | wc -l | tr -d ' ')
    print_status ok "specs/ directory (${spec_count} feature(s))"
  else
    print_status pending "specs/ directory (not created)"
  fi

  if is_json_output; then
    cat << EOF
{
  "specify_dir": $has_specify,
  "state_file": $has_state,
  "state_version": $(if $has_state; then echo "\"$state_version\""; else echo "null"; fi),
  "needs_migration": $(if $has_state && [[ "$state_version" != "$CURRENT_STATE_VERSION" ]]; then echo "true"; else echo "false"; fi),
  "discovery_state": $has_discovery,
  "discovery_phase": $discovery_phase,
  "specs_dir": $has_specs,
  "spec_count": $spec_count
}
EOF
  fi
}

# Detect existing documentation
detect_docs() {
  local repo_root
  repo_root="$(get_repo_root 2>/dev/null || pwd)"

  # Three-line rule: Status output first, skip decorative headers
  local found_patterns=()
  local adr_dir=""
  local adr_count=0

  # docs/ directory
  if [[ -d "${repo_root}/docs" ]]; then
    local doc_count=$(find "${repo_root}/docs" -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    print_status ok "docs/ directory (${doc_count} markdown files)"
    found_patterns+=("docs")

    # Check for ADR patterns inside docs/
    for dir in "docs/adr" "docs/ADR" "docs/adrs" "docs/ADRs" "docs/decisions" "doc/adr" "doc/decisions"; do
      if [[ -d "${repo_root}/${dir}" ]]; then
        adr_dir="${repo_root}/${dir}"
        break
      fi
    done

    if [[ -d "${repo_root}/docs/rfc" ]] || [[ -d "${repo_root}/docs/RFC" ]] || [[ -d "${repo_root}/docs/rfcs" ]]; then
      print_status ok "  └─ RFC directory detected"
      found_patterns+=("rfc")
    fi

    if [[ -d "${repo_root}/docs/api" ]] || ls "${repo_root}/docs/"*api* >/dev/null 2>&1; then
      print_status ok "  └─ API documentation detected"
      found_patterns+=("api-docs")
    fi
  fi

  # ADR at root level (check multiple patterns)
  if [[ -z "$adr_dir" ]]; then
    for dir in "adr" "ADR" "adrs" "ADRs" "architecture/decisions"; do
      if [[ -d "${repo_root}/${dir}" ]]; then
        adr_dir="${repo_root}/${dir}"
        break
      fi
    done
  fi

  # If ADR directory found, count ADR files
  if [[ -n "$adr_dir" ]]; then
    # Count files matching ADR naming patterns: NNN-*.md, ADR-NNN-*.md, NNNN-*.md
    adr_count=$(find "$adr_dir" -maxdepth 1 -type f \( \
      -name "[0-9][0-9][0-9]-*.md" -o \
      -name "[0-9][0-9][0-9][0-9]-*.md" -o \
      -name "ADR-[0-9]*-*.md" -o \
      -name "adr-[0-9]*-*.md" \
    \) 2>/dev/null | wc -l | tr -d ' ')

    local rel_dir="${adr_dir#$repo_root/}"
    print_status ok "ADR directory: ${rel_dir}/ (${adr_count} ADRs)"
    found_patterns+=("adr")

    if [[ $adr_count -gt 0 ]] && ! is_json_output; then
      echo -e "  ${DIM}Import with: speckit import adrs ${rel_dir}${RESET}"
    fi
  fi

  # OpenAPI / Swagger
  for file in openapi.yaml openapi.json swagger.yaml swagger.json api.yaml api.json; do
    if [[ -f "${repo_root}/${file}" ]]; then
      print_status ok "API specification: ${file}"
      found_patterns+=("openapi")
      break
    fi
  done

  # Key documentation files
  local key_docs=""
  [[ -f "${repo_root}/ARCHITECTURE.md" ]] && key_docs+="ARCHITECTURE.md, "
  [[ -f "${repo_root}/architecture.md" ]] && key_docs+="architecture.md, "
  [[ -f "${repo_root}/CONTRIBUTING.md" ]] && key_docs+="CONTRIBUTING.md, "
  [[ -f "${repo_root}/contributing.md" ]] && key_docs+="contributing.md, "
  [[ -f "${repo_root}/DESIGN.md" ]] && key_docs+="DESIGN.md, "
  [[ -f "${repo_root}/design.md" ]] && key_docs+="design.md, "
  key_docs="${key_docs%, }"

  if [[ -n "$key_docs" ]]; then
    print_status ok "Key docs: ${key_docs}"
    found_patterns+=("key-docs")
  fi

  # wiki/
  if [[ -d "${repo_root}/wiki" ]] || [[ -d "${repo_root}/.wiki" ]]; then
    print_status ok "Wiki directory"
    found_patterns+=("wiki")
  fi

  # .github/
  if [[ -d "${repo_root}/.github" ]]; then
    local github_items=""
    [[ -d "${repo_root}/.github/ISSUE_TEMPLATE" ]] && github_items+="issues, "
    [[ -f "${repo_root}/.github/PULL_REQUEST_TEMPLATE.md" ]] && github_items+="PRs, "
    [[ -f "${repo_root}/.github/CODEOWNERS" ]] && github_items+="CODEOWNERS, "
    [[ -d "${repo_root}/.github/workflows" ]] && github_items+="workflows, "
    github_items="${github_items%, }"

    if [[ -n "$github_items" ]]; then
      print_status ok ".github/ directory (${github_items})"
      found_patterns+=("github")
    fi
  fi

  if [[ ${#found_patterns[@]} -eq 0 ]]; then
    print_status pending "No existing documentation detected"
  fi

  if is_json_output; then
    local patterns_json=$(printf '%s\n' "${found_patterns[@]}" | jq -R -s 'split("\n") | map(select(. != ""))')
    local adr_dir_json="null"
    [[ -n "$adr_dir" ]] && adr_dir_json="\"${adr_dir#$repo_root/}\""
    echo "{\"patterns\": $patterns_json, \"has_existing_docs\": $(if [[ ${#found_patterns[@]} -gt 0 ]]; then echo "true"; else echo "false"; fi), \"adr_dir\": $adr_dir_json, \"adr_count\": $adr_count}"
  fi
}

# Detect key files
detect_files() {
  local repo_root
  repo_root="$(get_repo_root 2>/dev/null || pwd)"

  # Three-line rule: Status output first, skip decorative headers
  local files_found=()

  # CLAUDE.md
  if [[ -f "${repo_root}/CLAUDE.md" ]]; then
    local size=$(wc -c < "${repo_root}/CLAUDE.md" | tr -d ' ')
    print_status ok "CLAUDE.md (${size} bytes)"
    files_found+=("\"CLAUDE.md\": {\"exists\": true, \"size\": $size}")

    # Check if it looks like SpecKit CLAUDE.md or user's own
    if grep -q "SpecKit" "${repo_root}/CLAUDE.md" 2>/dev/null; then
      print_status ok "  └─ Contains SpecKit content"
    else
      print_status warn "  └─ Custom content (not SpecKit generated)"
    fi
  else
    print_status pending "CLAUDE.md (not created)"
    files_found+=("\"CLAUDE.md\": {\"exists\": false}")
  fi

  # ROADMAP.md
  if [[ -f "${repo_root}/ROADMAP.md" ]]; then
    local size=$(wc -c < "${repo_root}/ROADMAP.md" | tr -d ' ')
    print_status ok "ROADMAP.md (${size} bytes)"
    files_found+=("\"ROADMAP.md\": {\"exists\": true, \"size\": $size}")

    # Check format
    if grep -q "## Phase" "${repo_root}/ROADMAP.md" 2>/dev/null; then
      print_status ok "  └─ SpecKit format detected"
    fi
  else
    print_status pending "ROADMAP.md (not created)"
    files_found+=("\"ROADMAP.md\": {\"exists\": false}")
  fi

  # README.md
  if [[ -f "${repo_root}/README.md" ]]; then
    local size=$(wc -c < "${repo_root}/README.md" | tr -d ' ')
    print_status ok "README.md (${size} bytes)"
    files_found+=("\"README.md\": {\"exists\": true, \"size\": $size}")
  fi

  # ARCHITECTURE.md
  if [[ -f "${repo_root}/ARCHITECTURE.md" ]]; then
    local size=$(wc -c < "${repo_root}/ARCHITECTURE.md" | tr -d ' ')
    print_status ok "ARCHITECTURE.md (${size} bytes)"
    files_found+=("\"ARCHITECTURE.md\": {\"exists\": true, \"size\": $size}")
  fi

  # CONTRIBUTING.md
  if [[ -f "${repo_root}/CONTRIBUTING.md" ]]; then
    local size=$(wc -c < "${repo_root}/CONTRIBUTING.md" | tr -d ' ')
    print_status ok "CONTRIBUTING.md (${size} bytes)"
    files_found+=("\"CONTRIBUTING.md\": {\"exists\": true, \"size\": $size}")
  fi

  if is_json_output; then
    echo "{$(IFS=,; echo "${files_found[*]}")}"
  fi
}

# Detect state file format/version
detect_state() {
  local repo_root
  repo_root="$(get_repo_root 2>/dev/null || pwd)"

  # Three-line rule: Status output first, skip decorative headers
  local state_file="${repo_root}/.specify/orchestration-state.json"

  if [[ ! -f "$state_file" ]]; then
    print_status pending "State file not found"

    # Check for discovery state (old interview format)
    if [[ -f "${repo_root}/.specify/discovery/state.md" ]]; then
      print_status ok "Found discovery/state.md (interview state)"
      print_status warn "  └─ May need migration to JSON format"
    fi

    if is_json_output; then
      echo '{"exists": false, "valid": false}'
    fi
    return
  fi

  # Validate JSON
  if ! jq '.' "$state_file" >/dev/null 2>&1; then
    print_status error "State file has invalid JSON"
    if is_json_output; then
      echo '{"exists": true, "valid": false, "error": "invalid_json"}'
    fi
    return
  fi

  print_status ok "State file exists and is valid JSON"

  # Extract version
  local version=$(jq -r '.version // "unknown"' "$state_file")
  print_status ok "Version: ${version}"

  # Check format
  local format="unknown"
  if jq -e '.config' "$state_file" >/dev/null 2>&1; then
    format="v2.0"
    print_status ok "Format: v2.0 (current)"
  elif jq -e '.project.roadmap_path' "$state_file" >/dev/null 2>&1; then
    format="v1.0"
    print_status warn "Format: v1.0 (needs migration)"
    print_status warn "  └─ Run 'speckit state migrate' to upgrade"
  fi

  # Check sections
  local sections=("config" "project" "interview" "orchestration")
  local missing_sections=()

  for section in "${sections[@]}"; do
    if jq -e ".${section}" "$state_file" >/dev/null 2>&1; then
      print_status ok "Section: ${section}"
    else
      print_status warn "Section: ${section} (missing)"
      missing_sections+=("$section")
    fi
  done

  # Interview status
  local interview_status=$(jq -r '.interview.status // "not_started"' "$state_file" 2>/dev/null)
  print_status ok "Interview status: ${interview_status}"

  # Orchestration status
  local orch_status=$(jq -r '.orchestration.status // "not_started"' "$state_file" 2>/dev/null)
  local orch_step=$(jq -r '.orchestration.step // "none"' "$state_file" 2>/dev/null)
  print_status ok "Orchestration: ${orch_status} (step: ${orch_step})"

  if is_json_output; then
    cat << EOF
{
  "exists": true,
  "valid": true,
  "version": "$version",
  "format": "$format",
  "needs_migration": $(if [[ "$format" == "v1.0" ]]; then echo "true"; else echo "false"; fi),
  "missing_sections": $(printf '%s\n' "${missing_sections[@]}" | jq -R -s 'split("\n") | map(select(. != ""))'),
  "interview_status": "$interview_status",
  "orchestration_status": "$orch_status",
  "orchestration_step": "$orch_step"
}
EOF
  fi
}

# Run all detections
detect_all() {
  detect_system
  echo ""
  detect_speckit
  echo ""
  detect_docs
  echo ""
  detect_files
  echo ""
  detect_state
}

# =============================================================================
# Summary
# =============================================================================

show_summary() {
  local repo_root
  repo_root="$(get_repo_root 2>/dev/null || pwd)"

  # Determine project state first (before any output)
  local project_state="unknown"
  local recommended_action=""

  if [[ ! -d "${repo_root}/.specify" ]]; then
    project_state="new"
    recommended_action="Run /speckit.init to initialize"
  elif [[ ! -f "${repo_root}/.specify/orchestration-state.json" ]]; then
    project_state="partial"
    recommended_action="Run /speckit.init to complete setup"
  else
    local interview_status=$(jq -r '.interview.status // "not_started"' "${repo_root}/.specify/orchestration-state.json" 2>/dev/null)
    local orch_status=$(jq -r '.orchestration.status // "not_started"' "${repo_root}/.specify/orchestration-state.json" 2>/dev/null)

    if [[ "$interview_status" != "completed" ]]; then
      project_state="interview_in_progress"
      recommended_action="Run /speckit.init continue to resume interview"
    elif [[ ! -f "${repo_root}/ROADMAP.md" ]]; then
      project_state="needs_roadmap"
      recommended_action="Run /speckit.roadmap to create roadmap"
    elif [[ "$orch_status" == "in_progress" ]]; then
      project_state="orchestration_in_progress"
      recommended_action="Run /speckit.orchestrate continue to resume"
    else
      project_state="ready"
      recommended_action="Run /speckit.orchestrate to start next phase"
    fi
  fi

  # Three-line rule: Status first, then decorative header
  print_summary "info" "Project state: ${project_state}" \
    "Path: ${repo_root}" \
    "$recommended_action"

  # Check for warnings
  if [[ -f "${repo_root}/CLAUDE.md" ]] && ! grep -q "SpecKit" "${repo_root}/CLAUDE.md" 2>/dev/null; then
    echo ""
    log_warn "Existing CLAUDE.md will be preserved - SpecKit content will be added"
  fi

  if [[ -d "${repo_root}/docs" ]]; then
    echo ""
    log_info "Existing docs/ directory detected - SpecKit can coexist"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  local check_area="all"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --check)
        check_area="${2:-all}"
        shift 2
        ;;
      --docs)
        # Alias for --check docs
        check_area="docs"
        shift
        ;;
      --json)
        enable_json_output
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Run 'speckit detect --help' for usage"
        exit 1
        ;;
    esac
  done

  # Three-line rule: Skip decorative header, show status first in results
  case "$check_area" in
    system)
      detect_system
      ;;
    speckit)
      detect_speckit
      ;;
    docs)
      detect_docs
      ;;
    files)
      detect_files
      ;;
    state)
      detect_state
      ;;
    all)
      detect_all
      if ! is_json_output; then
        show_summary
      fi
      ;;
    *)
      log_error "Unknown check area: $check_area"
      log_info "Valid areas: system, speckit, docs, files, state, all"
      exit 1
      ;;
  esac
}

main "$@"
