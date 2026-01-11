#!/usr/bin/env bash
#
# SpecKit E2E Test Runner
#
# Usage:
#   ./tests/test-runner.sh              Run all tests
#   ./tests/test-runner.sh state        Run specific test suite
#   ./tests/test-runner.sh --list       List available test suites
#   ./tests/test-runner.sh --verbose    Show detailed output
#

set -uo pipefail
# Note: -e is intentionally omitted to allow tests to fail without stopping

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_TEMP_DIR=""
VERBOSE="${VERBOSE:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# =============================================================================
# Test Framework
# =============================================================================

# Setup test environment
setup_test_env() {
  TEST_TEMP_DIR=$(mktemp -d)
  export TEST_TEMP_DIR
  export PROJECT_ROOT

  # Add project bin to PATH for testing
  export PATH="${PROJECT_ROOT}/bin:$PATH"

  # Source the common library for testing
  if [[ -f "${PROJECT_ROOT}/scripts/bash/lib/common.sh" ]]; then
    source "${PROJECT_ROOT}/scripts/bash/lib/common.sh"
  fi

  echo -e "${BLUE}Test environment:${RESET}"
  echo "  Temp dir: ${TEST_TEMP_DIR}"
  echo "  Project:  ${PROJECT_ROOT}"
  echo ""
}

# Cleanup test environment
cleanup_test_env() {
  if [[ -n "$TEST_TEMP_DIR" && -d "$TEST_TEMP_DIR" ]]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

# Log functions
log_test() {
  echo -e "${BLUE}TEST${RESET}: $*"
}

log_pass() {
  echo -e "${GREEN}PASS${RESET}: $*"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
  echo -e "${RED}FAIL${RESET}: $*"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_skip() {
  echo -e "${YELLOW}SKIP${RESET}: $*"
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

log_info() {
  if [[ "$VERBOSE" == "true" ]]; then
    echo -e "${BLUE}INFO${RESET}: $*"
  fi
}

# Run a single test
run_test() {
  local test_name="$1"
  local test_fn="$2"

  TESTS_RUN=$((TESTS_RUN + 1))

  log_test "$test_name"

  # Create isolated test directory
  local test_dir="${TEST_TEMP_DIR}/${test_name//[^a-zA-Z0-9_]/_}"
  mkdir -p "$test_dir"

  # Run test in subshell, capture output
  # Set SPECKIT_PROJECT_ROOT so scripts use test_dir as repo root
  local test_output
  local test_result=0
  test_output=$( (cd "$test_dir" && SPECKIT_PROJECT_ROOT="$test_dir" $test_fn) 2>&1 ) || test_result=$?

  # Show output if verbose or failed
  if [[ "$VERBOSE" == "true" ]] || [[ $test_result -ne 0 ]]; then
    echo "$test_output"
  fi

  if [[ $test_result -eq 0 ]]; then
    log_pass "$test_name"
    return 0
  else
    log_fail "$test_name"
    return 1
  fi
}

# Assert functions
assert_equals() {
  local expected="$1"
  local actual="$2"
  local msg="${3:-Values should be equal}"

  if [[ "$expected" == "$actual" ]]; then
    log_info "  ✓ $msg"
    return 0
  else
    echo "  Expected: $expected"
    echo "  Actual:   $actual"
    return 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local msg="${3:-Should contain substring}"

  if [[ "$haystack" == *"$needle"* ]]; then
    log_info "  ✓ $msg"
    return 0
  else
    echo "  String: $haystack"
    echo "  Missing: $needle"
    return 1
  fi
}

assert_matches() {
  local haystack="$1"
  local pattern="$2"
  local msg="${3:-Should match pattern}"

  if [[ "$haystack" =~ $pattern ]]; then
    log_info "  ✓ $msg"
    return 0
  else
    echo "  String: $haystack"
    echo "  Pattern: $pattern"
    return 1
  fi
}

assert_file_exists() {
  local file="$1"
  local msg="${2:-File should exist}"

  if [[ -f "$file" ]]; then
    log_info "  ✓ $msg: $file"
    return 0
  else
    echo "  Missing file: $file"
    return 1
  fi
}

assert_dir_exists() {
  local dir="$1"
  local msg="${2:-Directory should exist}"

  if [[ -d "$dir" ]]; then
    log_info "  ✓ $msg: $dir"
    return 0
  else
    echo "  Missing directory: $dir"
    return 1
  fi
}

assert_command_succeeds() {
  local cmd="$1"
  local msg="${2:-Command should succeed}"

  if eval "$cmd" >/dev/null 2>&1; then
    log_info "  ✓ $msg"
    return 0
  else
    echo "  Command failed: $cmd"
    return 1
  fi
}

assert_command_fails() {
  local cmd="$1"
  local msg="${2:-Command should fail}"

  if ! eval "$cmd" >/dev/null 2>&1; then
    log_info "  ✓ $msg"
    return 0
  else
    echo "  Command should have failed: $cmd"
    return 1
  fi
}

assert_json_valid() {
  local file="$1"
  local msg="${2:-JSON should be valid}"

  if jq '.' "$file" >/dev/null 2>&1; then
    log_info "  ✓ $msg"
    return 0
  else
    echo "  Invalid JSON in: $file"
    return 1
  fi
}

assert_json_equals() {
  local file="$1"
  local key="$2"
  local expected="$3"
  local msg="${4:-JSON value should match}"

  local actual
  actual=$(jq -r "$key" "$file" 2>/dev/null)

  if [[ "$actual" == "$expected" ]]; then
    log_info "  ✓ $msg: $key = $expected"
    return 0
  else
    echo "  Key: $key"
    echo "  Expected: $expected"
    echo "  Actual: $actual"
    return 1
  fi
}

# =============================================================================
# Test Suite Discovery
# =============================================================================

list_test_suites() {
  echo "Available test suites:"
  for suite in "${SCRIPT_DIR}"/test-*.sh; do
    if [[ -f "$suite" && "$suite" != *"test-runner.sh" ]]; then
      local name
      name=$(basename "$suite" .sh | sed 's/test-//')
      echo "  - $name"
    fi
  done
}

run_test_suite() {
  local suite_name="$1"
  local suite_file="${SCRIPT_DIR}/test-${suite_name}.sh"

  if [[ ! -f "$suite_file" ]]; then
    echo -e "${RED}ERROR${RESET}: Test suite not found: $suite_name"
    echo "Run with --list to see available suites"
    exit 1
  fi

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  Test Suite: ${suite_name}${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
  echo ""

  # Source and run the test suite
  source "$suite_file"

  # Convention: test suite should define run_tests function
  if declare -f run_tests >/dev/null; then
    run_tests
  else
    echo -e "${YELLOW}WARN${RESET}: No run_tests function in $suite_file"
  fi
}

run_all_tests() {
  for suite in "${SCRIPT_DIR}"/test-*.sh; do
    if [[ -f "$suite" && "$suite" != *"test-runner.sh" ]]; then
      local name
      name=$(basename "$suite" .sh | sed 's/test-//')
      run_test_suite "$name"
    fi
  done
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  Test Summary${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo "  Total:   ${TESTS_RUN}"
  echo -e "  ${GREEN}Passed:  ${TESTS_PASSED}${RESET}"
  echo -e "  ${RED}Failed:  ${TESTS_FAILED}${RESET}"
  echo -e "  ${YELLOW}Skipped: ${TESTS_SKIPPED}${RESET}"
  echo ""

  if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}All tests passed!${RESET}"
    return 0
  else
    echo -e "${RED}${BOLD}${TESTS_FAILED} test(s) failed${RESET}"
    return 1
  fi
}

# =============================================================================
# Main
# =============================================================================

show_help() {
  cat << 'EOF'
SpecKit E2E Test Runner

USAGE:
    ./tests/test-runner.sh [options] [suite...]

OPTIONS:
    --list, -l      List available test suites
    --verbose, -v   Show detailed output
    --help, -h      Show this help

SUITES:
    state           State management tests
    scaffold        Project scaffolding tests
    git             Git operations tests
    roadmap         ROADMAP.md operations tests
    detect          Detection command tests
    reconcile       Reconciliation tests
    migrate         State migration tests
    doctor          Diagnostics tests
    all             Run all test suites (default)

EXAMPLES:
    ./tests/test-runner.sh              # Run all tests
    ./tests/test-runner.sh state        # Run state tests only
    ./tests/test-runner.sh -v state git # Run state and git tests verbosely
EOF
}

main() {
  local suites=()

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --list|-l)
        list_test_suites
        exit 0
        ;;
      --verbose|-v)
        VERBOSE=true
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      -*)
        echo "Unknown option: $1"
        exit 1
        ;;
      *)
        suites+=("$1")
        shift
        ;;
    esac
  done

  # Banner
  echo ""
  echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║              SpecKit E2E Test Suite                           ║${RESET}"
  echo -e "${BOLD}╚═══════════════════════════════════════════════════════════════╝${RESET}"
  echo ""

  # Setup
  setup_test_env
  trap cleanup_test_env EXIT

  # Check prerequisites
  if ! command -v jq &>/dev/null; then
    echo -e "${RED}ERROR${RESET}: jq is required for tests"
    exit 1
  fi

  # Run tests
  if [[ ${#suites[@]} -eq 0 ]]; then
    run_all_tests
  else
    for suite in "${suites[@]}"; do
      run_test_suite "$suite"
    done
  fi

  # Summary
  print_summary
}

# Export functions for test suites
export -f log_test log_pass log_fail log_skip log_info
export -f run_test
export -f assert_equals assert_contains assert_matches assert_file_exists assert_dir_exists
export -f assert_command_succeeds assert_command_fails
export -f assert_json_valid assert_json_equals

main "$@"
