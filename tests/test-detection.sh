#!/usr/bin/env bash
#
# test-detection.sh - Tests for project type detection library
#

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source test utilities
source "${SCRIPT_DIR}/test-runner.sh" 2>/dev/null || {
  # Minimal test utilities if runner not available
  TESTS_RUN=0
  TESTS_PASSED=0
  TESTS_FAILED=0

  assert_equals() {
    local expected="$1"
    local actual="$2"
    local msg="${3:-}"
    ((TESTS_RUN++))
    if [[ "$expected" == "$actual" ]]; then
      echo "  ✓ $msg"
      ((TESTS_PASSED++))
    else
      echo "  ✗ $msg"
      echo "    Expected: $expected"
      echo "    Actual:   $actual"
      ((TESTS_FAILED++))
    fi
  }

  print_summary() {
    echo ""
    echo "Tests: $TESTS_RUN | Passed: $TESTS_PASSED | Failed: $TESTS_FAILED"
    [[ $TESTS_FAILED -eq 0 ]]
  }
}

# Source the detection library
source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

# =============================================================================
# Test Setup
# =============================================================================

setup_test_dir() {
  local name="$1"
  local dir="/tmp/speckit-test-${name}-$$"
  mkdir -p "$dir"
  echo "$dir"
}

cleanup_test_dir() {
  local dir="$1"
  [[ -d "$dir" ]] && rm -rf "$dir"
}

# =============================================================================
# Tests: detect_project_type
# =============================================================================

echo "==> Testing detect_project_type()"

# Test TypeScript detection
test_typescript() {
  local dir
  dir=$(setup_test_dir "typescript")
  touch "${dir}/tsconfig.json"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "typescript" "$result" "Detects TypeScript from tsconfig.json"
  cleanup_test_dir "$dir"
}
test_typescript

# Test JavaScript detection
test_javascript() {
  local dir
  dir=$(setup_test_dir "javascript")
  touch "${dir}/package.json"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "javascript" "$result" "Detects JavaScript from package.json (no tsconfig)"
  cleanup_test_dir "$dir"
}
test_javascript

# Test TypeScript priority over package.json
test_typescript_priority() {
  local dir
  dir=$(setup_test_dir "ts-priority")
  touch "${dir}/tsconfig.json"
  touch "${dir}/package.json"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "typescript" "$result" "TypeScript takes priority over package.json"
  cleanup_test_dir "$dir"
}
test_typescript_priority

# Test Rust detection
test_rust() {
  local dir
  dir=$(setup_test_dir "rust")
  touch "${dir}/Cargo.toml"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "rust" "$result" "Detects Rust from Cargo.toml"
  cleanup_test_dir "$dir"
}
test_rust

# Test Go detection
test_go() {
  local dir
  dir=$(setup_test_dir "go")
  touch "${dir}/go.mod"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "go" "$result" "Detects Go from go.mod"
  cleanup_test_dir "$dir"
}
test_go

# Test Python detection (pyproject.toml)
test_python_pyproject() {
  local dir
  dir=$(setup_test_dir "python1")
  touch "${dir}/pyproject.toml"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "python" "$result" "Detects Python from pyproject.toml"
  cleanup_test_dir "$dir"
}
test_python_pyproject

# Test Python detection (requirements.txt)
test_python_requirements() {
  local dir
  dir=$(setup_test_dir "python2")
  touch "${dir}/requirements.txt"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "python" "$result" "Detects Python from requirements.txt"
  cleanup_test_dir "$dir"
}
test_python_requirements

# Test Bash detection
test_bash() {
  local dir
  dir=$(setup_test_dir "bash")
  touch "${dir}/script.sh"
  local result
  result=$(detect_project_type "$dir")
  assert_equals "bash" "$result" "Detects Bash from *.sh files"
  cleanup_test_dir "$dir"
}
test_bash

# Test Generic (empty project)
test_generic() {
  local dir
  dir=$(setup_test_dir "generic")
  local result
  result=$(detect_project_type "$dir")
  assert_equals "generic" "$result" "Defaults to generic for empty project"
  cleanup_test_dir "$dir"
}
test_generic

# Test non-existent directory
test_nonexistent() {
  local result
  result=$(detect_project_type "/nonexistent/path/$$")
  assert_equals "generic" "$result" "Returns generic for non-existent path"
}
test_nonexistent

# =============================================================================
# Tests: select_template_section
# =============================================================================

echo ""
echo "==> Testing select_template_section()"

# Test extracting TypeScript section
test_extract_typescript() {
  local template="Header
<!-- LANG:typescript -->
TypeScript content
<!-- /LANG:typescript -->
<!-- LANG:python -->
Python content
<!-- /LANG:python -->
Footer"

  local result
  result=$(echo "$template" | select_template_section "typescript")
  assert_equals "TypeScript content" "$result" "Extracts TypeScript section"
}
test_extract_typescript

# Test extracting Python section
test_extract_python() {
  local template="Header
<!-- LANG:typescript -->
TypeScript content
<!-- /LANG:typescript -->
<!-- LANG:python -->
Python content
<!-- /LANG:python -->
Footer"

  local result
  result=$(echo "$template" | select_template_section "python")
  assert_equals "Python content" "$result" "Extracts Python section"
}
test_extract_python

# Test fallback to generic when section not found
test_fallback_generic() {
  local template="Header
<!-- LANG:generic -->
Generic content
<!-- /LANG:generic -->
Footer"

  local result
  result=$(echo "$template" | select_template_section "rust")
  assert_equals "Generic content" "$result" "Falls back to generic when language not found"
}
test_fallback_generic

# Test returning full content when no sections
test_no_sections() {
  local template="Just plain content
No language sections here"

  local result
  result=$(echo "$template" | select_template_section "python")
  assert_equals "$template" "$result" "Returns full content when no sections exist"
}
test_no_sections

# =============================================================================
# Tests: is_valid_project_type
# =============================================================================

echo ""
echo "==> Testing is_valid_project_type()"

test_valid_types() {
  local types="typescript javascript rust go python bash generic"
  for type in $types; do
    if is_valid_project_type "$type"; then
      echo "  ✓ $type is valid"
      ((TESTS_PASSED++))
    else
      echo "  ✗ $type should be valid"
      ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
  done
}
test_valid_types

test_invalid_type() {
  if ! is_valid_project_type "invalid"; then
    echo "  ✓ 'invalid' is correctly rejected"
    ((TESTS_PASSED++))
  else
    echo "  ✗ 'invalid' should be rejected"
    ((TESTS_FAILED++))
  fi
  ((TESTS_RUN++))
}
test_invalid_type

# =============================================================================
# Summary
# =============================================================================

echo ""
print_summary
