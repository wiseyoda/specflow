#!/usr/bin/env bash
#
# test-detection.sh - Tests for project type detection library
#

# =============================================================================
# Test Setup
# =============================================================================

setup_test_dir() {
  local name="$1"
  local dir="${TEST_TEMP_DIR:-/tmp}/speckit-test-${name}-$$"
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

test_detection_typescript() {
  local dir
  dir=$(setup_test_dir "typescript")
  touch "${dir}/tsconfig.json"

  # Source detection library
  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "typescript" "$result" "Detects TypeScript from tsconfig.json"
}

test_detection_javascript() {
  local dir
  dir=$(setup_test_dir "javascript")
  touch "${dir}/package.json"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "javascript" "$result" "Detects JavaScript from package.json"
}

test_detection_typescript_priority() {
  local dir
  dir=$(setup_test_dir "ts-priority")
  touch "${dir}/tsconfig.json"
  touch "${dir}/package.json"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "typescript" "$result" "TypeScript takes priority over package.json"
}

test_detection_rust() {
  local dir
  dir=$(setup_test_dir "rust")
  touch "${dir}/Cargo.toml"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "rust" "$result" "Detects Rust from Cargo.toml"
}

test_detection_go() {
  local dir
  dir=$(setup_test_dir "go")
  touch "${dir}/go.mod"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "go" "$result" "Detects Go from go.mod"
}

test_detection_python_pyproject() {
  local dir
  dir=$(setup_test_dir "python1")
  touch "${dir}/pyproject.toml"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "python" "$result" "Detects Python from pyproject.toml"
}

test_detection_python_requirements() {
  local dir
  dir=$(setup_test_dir "python2")
  touch "${dir}/requirements.txt"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "python" "$result" "Detects Python from requirements.txt"
}

test_detection_bash() {
  local dir
  dir=$(setup_test_dir "bash")
  touch "${dir}/script.sh"

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "bash" "$result" "Detects Bash from *.sh files"
}

test_detection_generic() {
  local dir
  dir=$(setup_test_dir "generic")

  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "$dir")
  cleanup_test_dir "$dir"

  assert_equals "generic" "$result" "Defaults to generic for empty project"
}

test_detection_nonexistent() {
  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local result
  result=$(detect_project_type "/nonexistent/path/$$")

  assert_equals "generic" "$result" "Returns generic for non-existent path"
}

test_detection_valid_types() {
  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  local types="typescript javascript rust go python bash generic"
  local all_valid=true
  for type in $types; do
    if ! is_valid_project_type "$type"; then
      all_valid=false
      break
    fi
  done

  assert_equals "true" "$all_valid" "All standard project types are valid"
}

test_detection_invalid_type() {
  source "${PROJECT_ROOT}/scripts/bash/lib/detection.sh"

  if is_valid_project_type "invalid" 2>/dev/null; then
    return 1
  fi
  return 0
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "detect TypeScript from tsconfig.json" test_detection_typescript
  run_test "detect JavaScript from package.json" test_detection_javascript
  run_test "TypeScript priority over package.json" test_detection_typescript_priority
  run_test "detect Rust from Cargo.toml" test_detection_rust
  run_test "detect Go from go.mod" test_detection_go
  run_test "detect Python from pyproject.toml" test_detection_python_pyproject
  run_test "detect Python from requirements.txt" test_detection_python_requirements
  run_test "detect Bash from *.sh files" test_detection_bash
  run_test "default to generic for empty project" test_detection_generic
  run_test "return generic for non-existent path" test_detection_nonexistent
  run_test "all standard project types are valid" test_detection_valid_types
  run_test "invalid type is rejected" test_detection_invalid_type
}
