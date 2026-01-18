#!/usr/bin/env bash
#
# specflow-gate.sh - Validation gate enforcement
#
# Usage:
#   specflow gate <step>          Validate gate for step (specify, plan, tasks, implement)
#   specflow gate all             Run all gates for current state
#   specflow gate status          Show gate status summary
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
specflow gate - Validation gate enforcement

USAGE:
    specflow gate <command> [options]

COMMANDS:
    specify         Validate spec.md before planning
                    Checks: file exists, required sections, no placeholders

    plan            Validate plan.md before task generation
                    Checks: file exists, required sections, tech stack defined

    tasks           Validate tasks.md before implementation
                    Checks: file exists, phases defined, task format valid

    implement       Validate implementation before verification
                    Checks: all tasks complete, tests passing

    all             Run all applicable gates for current phase

    status          Show gate status summary

OPTIONS:
    --strict        Fail on warnings (default: only fail on errors)
    --json          Output in JSON format
    -h, --help      Show this help

EXAMPLES:
    specflow gate specify
    specflow gate plan --strict
    specflow gate all
    specflow gate status
EOF
}

# =============================================================================
# Validation Patterns
# =============================================================================

# Placeholder patterns that indicate incomplete content
PLACEHOLDER_PATTERNS=(
  '\[PLACEHOLDER\]'
  '\[TBD\]'
  '\[TODO\]'
  '\[FILL IN\]'
  '\[INSERT\]'
  '\[DESCRIBE\]'
  '\[ADD\]'
  '<<.*>>'
  '\.\.\.'           # Three dots often indicate incomplete
)

# Note: Required sections are passed directly to check_sections() function
# as name/pattern argument pairs for POSIX compatibility

# =============================================================================
# Test Runner Detection
# =============================================================================

# Detect the appropriate test runner for the current project
# Returns: test command string (empty if no test runner found)
detect_test_runner() {
  local test_cmd=""

  # Python: pytest
  if [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]] || [[ -f "setup.py" ]]; then
    if grep -q "pytest" pyproject.toml 2>/dev/null || [[ -f "pytest.ini" ]]; then
      test_cmd="pytest"
    elif [[ -f "tox.ini" ]]; then
      test_cmd="tox"
    fi
  fi

  # Go: go test
  if [[ -z "$test_cmd" ]] && [[ -f "go.mod" ]]; then
    test_cmd="go test ./..."
  fi

  # Bash: bats
  if [[ -z "$test_cmd" ]] && ls tests/*.bats tests/*.sh 2>/dev/null | head -1 | grep -q "bats$"; then
    test_cmd="bats tests/"
  fi

  # Rust: cargo test
  if [[ -z "$test_cmd" ]] && [[ -f "Cargo.toml" ]]; then
    test_cmd="cargo test"
  fi

  # Node.js: npm test (fallback)
  if [[ -z "$test_cmd" ]] && [[ -f "package.json" ]]; then
    # Check if test script is configured
    if jq -e '.scripts.test' package.json >/dev/null 2>&1; then
      test_cmd="npm test"
    fi
  fi

  # SpecFlow project: custom test runner
  if [[ -z "$test_cmd" ]] && [[ -f "tests/test-runner.sh" ]]; then
    test_cmd="./tests/test-runner.sh"
  fi

  echo "$test_cmd"
}

# =============================================================================
# Gate Checks
# =============================================================================

# Check for placeholder text in file
check_placeholders() {
  local file="$1"
  local found=0

  for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    if grep -qiE "$pattern" "$file" 2>/dev/null; then
      ((found++)) || true
      if ! is_json_output; then
        local matches
        matches=$(grep -niE "$pattern" "$file" 2>/dev/null | head -3)
        log_warn "Found placeholder pattern '$pattern':"
        echo "$matches" | sed 's/^/    /'
      fi
    fi
  done

  return $found
}

# Check required sections exist
check_sections() {
  local file="$1"
  shift
  local missing=0

  while [[ $# -gt 0 ]]; do
    local name="$1"
    local pattern="$2"
    shift 2

    if ! grep -qE "$pattern" "$file" 2>/dev/null; then
      ((missing++)) || true
      if ! is_json_output; then
        log_warn "Missing required section: $name"
      fi
    fi
  done

  return $missing
}

# Check file exists and is not empty
check_file_exists() {
  local file="$1"
  local name="${2:-file}"

  if [[ ! -f "$file" ]]; then
    log_error "$name not found: $file"
    return 1
  fi

  if [[ ! -s "$file" ]]; then
    log_error "$name is empty: $file"
    return 1
  fi

  return 0
}

# =============================================================================
# Gate Commands
# =============================================================================

gate_specify() {
  local feature_dir
  feature_dir="$(get_feature_dir)"

  if [[ -z "$feature_dir" ]]; then
    log_error "Cannot determine feature directory"
    return 1
  fi

  local spec_file="${feature_dir}/spec.md"
  local errors=0
  local warnings=0

  # Three-line rule: Status first (via log_success/error below)
  # Check file exists
  if ! check_file_exists "$spec_file" "spec.md"; then
    ((errors++)) || true
  else
    log_success "spec.md exists"

    # Check required sections
    local section_errors
    section_errors=$(check_sections "$spec_file" \
      "Overview" "## Overview" \
      "User Stories" "## User Stories|## Features" \
      "Success Criteria" "## Acceptance|## Success|## Criteria" 2>&1) || ((warnings += $?))

    # Check for placeholders
    local placeholder_count
    placeholder_count=$(check_placeholders "$spec_file" 2>&1) || ((warnings += $?))

    if [[ $warnings -eq 0 ]]; then
      log_success "All required sections present"
      log_success "No placeholder text found"
    fi
  fi

  echo ""
  if [[ $errors -gt 0 ]]; then
    log_error "Gate FAILED: $errors errors"
    return 1
  elif [[ $warnings -gt 0 ]] && [[ "${STRICT_MODE:-}" == "true" ]]; then
    log_warn "Gate FAILED (strict mode): $warnings warnings"
    return 1
  elif [[ $warnings -gt 0 ]]; then
    log_warn "Gate PASSED with $warnings warnings"
    return 0
  else
    log_success "Gate PASSED"
    return 0
  fi
}

gate_plan() {
  local feature_dir
  feature_dir="$(get_feature_dir)"

  if [[ -z "$feature_dir" ]]; then
    log_error "Cannot determine feature directory"
    return 1
  fi

  local plan_file="${feature_dir}/plan.md"
  local errors=0
  local warnings=0

  # Three-line rule: Status first (via log_success/error below)
  # Check file exists
  if ! check_file_exists "$plan_file" "plan.md"; then
    ((errors++)) || true
  else
    log_success "plan.md exists"

    # Check required sections
    check_sections "$plan_file" \
      "Tech Stack" "## Tech|## Technology|## Stack" \
      "Architecture" "## Architecture|## Structure|## Design" \
      "Implementation" "## Implementation|## Approach|## Plan" 2>&1 || ((warnings += $?))

    # Check for placeholders
    check_placeholders "$plan_file" 2>&1 || ((warnings += $?))

    if [[ $warnings -eq 0 ]]; then
      log_success "All required sections present"
      log_success "No placeholder text found"
    fi
  fi

  echo ""
  if [[ $errors -gt 0 ]]; then
    log_error "Gate FAILED: $errors errors"
    return 1
  elif [[ $warnings -gt 0 ]] && [[ "${STRICT_MODE:-}" == "true" ]]; then
    log_warn "Gate FAILED (strict mode): $warnings warnings"
    return 1
  elif [[ $warnings -gt 0 ]]; then
    log_warn "Gate PASSED with $warnings warnings"
    return 0
  else
    log_success "Gate PASSED"
    return 0
  fi
}

gate_tasks() {
  local feature_dir
  feature_dir="$(get_feature_dir)"

  if [[ -z "$feature_dir" ]]; then
    log_error "Cannot determine feature directory"
    return 1
  fi

  local tasks_file="${feature_dir}/tasks.md"
  local errors=0
  local warnings=0

  # Three-line rule: Status first (via log_success/error below)
  # Check file exists
  if ! check_file_exists "$tasks_file" "tasks.md"; then
    ((errors++)) || true
  else
    log_success "tasks.md exists"

    # Check for at least one phase
    if ! grep -qE "^## Phase" "$tasks_file" 2>/dev/null; then
      log_error "No phases defined in tasks.md"
      ((errors++)) || true
    else
      log_success "Phases defined"
    fi

    # Check for valid task format
    local task_count
    task_count=$(grep -cE '^\s*-\s*\[[x ]\]\s*T[0-9]+' "$tasks_file" 2>/dev/null) || task_count=0

    if [[ $task_count -eq 0 ]]; then
      log_error "No valid tasks found (format: - [ ] T001 Description)"
      ((errors++)) || true
    else
      log_success "$task_count tasks defined"
    fi

    # Check for placeholders
    check_placeholders "$tasks_file" 2>&1 || ((warnings += $?))

    # Check for TXXX placeholder tasks
    if grep -qE '^\s*-\s*\[[x ]\]\s*TXXX' "$tasks_file" 2>/dev/null; then
      log_warn "Found TXXX placeholder tasks - replace with real task IDs"
      ((warnings++)) || true
    fi
  fi

  echo ""
  if [[ $errors -gt 0 ]]; then
    log_error "Gate FAILED: $errors errors"
    return 1
  elif [[ $warnings -gt 0 ]] && [[ "${STRICT_MODE:-}" == "true" ]]; then
    log_warn "Gate FAILED (strict mode): $warnings warnings"
    return 1
  elif [[ $warnings -gt 0 ]]; then
    log_warn "Gate PASSED with $warnings warnings"
    return 0
  else
    log_success "Gate PASSED"
    return 0
  fi
}

gate_implement() {
  local feature_dir
  feature_dir="$(get_feature_dir)"

  if [[ -z "$feature_dir" ]]; then
    log_error "Cannot determine feature directory"
    return 1
  fi

  local tasks_file="${feature_dir}/tasks.md"
  local errors=0
  local warnings=0

  # Three-line rule: Status first (via log_success/error below)
  # Check tasks file exists
  if ! check_file_exists "$tasks_file" "tasks.md"; then
    ((errors++)) || true
  else
    # Count tasks
    local total completed incomplete
    total=$(grep -cE '^\s*-\s*\[[x ]\]\s*T[0-9]+' "$tasks_file" 2>/dev/null) || total=0
    completed=$(grep -cE '^\s*-\s*\[x\]\s*T[0-9]+' "$tasks_file" 2>/dev/null) || completed=0
    incomplete=$((total - completed))

    echo "  Tasks: $completed / $total complete"

    if [[ $incomplete -gt 0 ]]; then
      log_error "$incomplete tasks incomplete"
      ((errors++)) || true

      # Show first few incomplete
      echo ""
      echo "  Incomplete tasks:"
      grep -E '^\s*-\s*\[ \]\s*T[0-9]+' "$tasks_file" 2>/dev/null | head -5 | sed 's/^/    /'
    else
      log_success "All tasks complete"
    fi
  fi

  # Check for test failures (detect appropriate test runner)
  local test_cmd
  test_cmd=$(detect_test_runner)

  if [[ -n "$test_cmd" ]]; then
    echo ""
    echo "  Checking tests ($test_cmd)..."
    local test_output
    local test_exit=0
    test_output=$($test_cmd 2>&1) || test_exit=$?

    if [[ $test_exit -eq 0 ]]; then
      log_success "Tests passing"
    else
      log_warn "Tests failed (exit code: $test_exit)"
      # Show first 10 lines of output for context
      if [[ -n "$test_output" ]]; then
        echo ""
        echo "  Test output (first 10 lines):"
        echo "$test_output" | head -10 | sed 's/^/    /'
      fi
      ((warnings++)) || true
    fi
  fi

  echo ""
  if [[ $errors -gt 0 ]]; then
    log_error "Gate FAILED: $errors errors"
    return 1
  elif [[ $warnings -gt 0 ]] && [[ "${STRICT_MODE:-}" == "true" ]]; then
    log_warn "Gate FAILED (strict mode): $warnings warnings"
    return 1
  elif [[ $warnings -gt 0 ]]; then
    log_warn "Gate PASSED with $warnings warnings"
    return 0
  else
    log_success "Gate PASSED"
    return 0
  fi
}

gate_all() {
  local feature_dir
  feature_dir="$(get_feature_dir)"
  local passed=0
  local failed=0

  # Three-line rule: Gate results will be shown via log_success/error
  # Determine which gates to run based on what files exist
  if [[ -f "${feature_dir}/spec.md" ]]; then
    if gate_specify; then
      ((passed++)) || true
    else
      ((failed++)) || true
    fi
    echo ""
  fi

  if [[ -f "${feature_dir}/plan.md" ]]; then
    if gate_plan; then
      ((passed++)) || true
    else
      ((failed++)) || true
    fi
    echo ""
  fi

  if [[ -f "${feature_dir}/tasks.md" ]]; then
    if gate_tasks; then
      ((passed++)) || true
    else
      ((failed++)) || true
    fi
    echo ""
  fi

  # Summary - Three-line rule compliant
  echo ""
  echo "Gates: $passed passed, $failed failed"

  if [[ $failed -gt 0 ]]; then
    log_error "Some gates failed"
    return 1
  else
    log_success "All gates passed"
    return 0
  fi
}

gate_status() {
  local feature_dir
  feature_dir="$(get_feature_dir)"

  if [[ -z "$feature_dir" ]]; then
    log_error "Cannot determine feature directory"
    return 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local rel_dir="${feature_dir#$repo_root/}"

  if is_json_output; then
    local status_json="{}"
    local gates=("specify:spec.md" "plan:plan.md" "tasks:tasks.md")

    for gate_info in "${gates[@]}"; do
      local gate="${gate_info%%:*}"
      local file="${gate_info#*:}"
      local file_status="missing"
      local gate_status="blocked"

      if [[ -f "${feature_dir}/${file}" ]]; then
        file_status="exists"
        gate_status="ready"
      fi

      status_json=$(echo "$status_json" | jq --arg gate "$gate" --arg file "$file_status" --arg status "$gate_status" \
        '. + {($gate): {"file": $file, "status": $status}}')
    done

    echo "$status_json"
  else
    # Three-line rule: Status output first
    local ready_count=0
    local pending_count=0
    local gates=("specify:spec.md" "plan:plan.md" "tasks:tasks.md" "implement:tasks.md")

    for gate_info in "${gates[@]}"; do
      local file="${gate_info#*:}"
      if [[ -f "${feature_dir}/${file}" ]]; then
        ((ready_count++)) || true
      else
        ((pending_count++)) || true
      fi
    done

    echo "Gate status: $ready_count ready, $pending_count pending"
    echo "Feature: $rel_dir"
    echo ""

    for gate_info in "${gates[@]}"; do
      local gate="${gate_info%%:*}"
      local file="${gate_info#*:}"

      if [[ -f "${feature_dir}/${file}" ]]; then
        print_status complete "$gate (${file} exists)"
      else
        print_status pending "$gate (${file} missing)"
      fi
    done
  fi
}

# Get feature directory (similar to other scripts)
get_feature_dir() {
  local repo_root
  repo_root="$(get_repo_root)"
  local state_file
  state_file="$(get_state_file)"

  if [[ -f "$state_file" ]]; then
    local phase_num
    phase_num=$(json_get "$state_file" ".orchestration.phase_number" 2>/dev/null || echo "")
    local specs_path
    specs_path=$(json_get "$state_file" ".config.specs_path" 2>/dev/null || echo "specs")
    specs_path="${specs_path%/}"

    if [[ -n "$phase_num" && "$phase_num" != "null" ]]; then
      local phase_dir
      phase_dir=$(find "${repo_root}/${specs_path}" -maxdepth 1 -type d -name "${phase_num}-*" 2>/dev/null | head -1)
      if [[ -n "$phase_dir" ]]; then
        echo "$phase_dir"
        return
      fi
    fi
  fi

  # Fallback: try git branch
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [[ "$branch" =~ ^([0-9]+)- ]]; then
    local num="${BASH_REMATCH[1]}"
    local phase_dir
    phase_dir=$(find "${repo_root}/specs" -maxdepth 1 -type d -name "${num}-*" 2>/dev/null | head -1)
    if [[ -n "$phase_dir" ]]; then
      echo "$phase_dir"
      return
    fi
  fi

  echo ""
}

# =============================================================================
# Main
# =============================================================================

STRICT_MODE="false"

main() {
  # Parse strict flag first
  local args=()
  for arg in "$@"; do
    if [[ "$arg" == "--strict" ]]; then
      STRICT_MODE="true"
    else
      args+=("$arg")
    fi
  done

  parse_common_flags "${args[@]}"
  set -- "${REMAINING_ARGS[@]:-}"

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local command="$1"
  shift

  case "$command" in
    specify|spec)
      gate_specify
      ;;
    plan)
      gate_plan
      ;;
    tasks)
      gate_tasks
      ;;
    implement|impl)
      gate_implement
      ;;
    all)
      gate_all
      ;;
    status|st)
      gate_status
      ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown gate: $command"
      echo "Valid gates: specify, plan, tasks, implement, all, status"
      exit 1
      ;;
  esac
}

main "$@"
