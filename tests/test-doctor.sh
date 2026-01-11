#!/usr/bin/env bash
#
# Test Suite: Doctor (Diagnostics)
#
# Tests for speckit doctor command:
#   - System checks
#   - Project structure checks
#   - State validation
#   - Git checks
#   - Auto-fix functionality
#

# =============================================================================
# Test Functions
# =============================================================================

test_doctor_system_check() {
  git init -q .

  # Run system check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check system 2>&1)

  # Should check for jq
  assert_contains "$output" "jq" "Checks jq installation"

  # Should report system directory
  assert_contains "$output" "System" "Reports system status"
}

test_doctor_project_check_empty() {
  git init -q .

  # Run project check on empty project
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check project 2>&1)

  # Should report .specify missing
  assert_contains "$output" ".specify" "Reports on .specify"
}

test_doctor_project_check_initialized() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  # Run project check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check project 2>&1)

  # Should report directories exist
  assert_matches "$output" "exists|OK|✓" "Reports directories exist"
}

test_doctor_state_check_valid() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  # Run state check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check state 2>&1)

  # Should report valid state
  assert_contains "$output" "State" "Checks state file"
  assert_matches "$output" "Version|version|v2" "Reports version"
}

test_doctor_state_check_invalid() {
  git init -q .
  mkdir -p .specify

  # Create invalid state
  echo "not json" > .specify/orchestration-state.json

  # Run state check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check state 2>&1)

  # Should report invalid JSON
  assert_matches "$output" "Invalid|invalid|error|ERROR" "Reports invalid JSON"
}

test_doctor_git_check() {
  git init -q .

  # Run git check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check git 2>&1)

  # Should report git status
  assert_matches "$output" "Git|git" "Checks git status"
  assert_matches "$output" "branch|Branch" "Reports branch"
}

test_doctor_git_check_not_repo() {
  # Don't init git

  # Run git check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check git 2>&1)

  # Should report not a git repo
  assert_matches "$output" "not|Not|ERROR" "Reports not a git repo"
}

test_doctor_fix_creates_structure() {
  git init -q .

  # Run with --fix
  bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --fix 2>&1

  # Should create .specify structure
  assert_dir_exists ".specify" "Creates .specify with --fix"
}

test_doctor_fix_creates_state() {
  git init -q .
  mkdir -p .specify

  # No state file exists

  # Run with --fix
  bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --fix 2>&1

  # Should create state file
  assert_file_exists ".specify/orchestration-state.json" "Creates state file with --fix"
}

test_doctor_fix_repairs_invalid_state() {
  git init -q .
  mkdir -p .specify

  # Create invalid state
  echo "not json" > .specify/orchestration-state.json

  # Run with --fix
  bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --fix 2>&1

  # State should now be valid
  assert_json_valid ".specify/orchestration-state.json" "Repairs invalid state"
}

test_doctor_all_checks() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run all checks
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" 2>&1)

  # Should include all sections
  assert_matches "$output" "system|System" "Includes system check"
  assert_matches "$output" "project|Project" "Includes project check"
  assert_matches "$output" "state|State" "Includes state check"
  assert_contains "$output" "Summary" "Includes summary"
}

test_doctor_summary_no_issues() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run doctor
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" 2>&1)

  # Should report no issues or passed
  assert_matches "$output" "pass|Pass|success|Success|OK|0 issue" "Reports passing status"
}

test_doctor_json_output() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run with JSON output
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --json 2>&1)

  # Should include JSON summary - extract multi-line JSON block
  # The JSON starts with {"issues" and ends with ]}
  if echo "$output" | grep -qE '^\{"issues"'; then
    local json_block
    # Extract from {"issues" to the last }
    json_block=$(echo "$output" | sed -n '/^{"issues"/,/^}/p' | tr '\n' ' ')
    echo "$json_block" | jq '.' >/dev/null 2>&1
    assert_equals "0" "$?" "JSON output is valid"
  else
    # JSON might be at the end in some format
    assert_matches "$output" "issues|warnings|fixed" "Contains JSON-like output"
  fi
}

test_doctor_paths_check() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run paths check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check paths 2>&1)

  # Should report on config paths
  assert_matches "$output" "path|Path" "Checks configured paths"
}

test_doctor_templates_check() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run templates check
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-doctor.sh" --check templates 2>&1)

  # Should report on templates
  assert_matches "$output" "template|Template" "Checks templates"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "doctor checks system installation" test_doctor_system_check
  run_test "doctor checks empty project" test_doctor_project_check_empty
  run_test "doctor checks initialized project" test_doctor_project_check_initialized
  run_test "doctor validates good state" test_doctor_state_check_valid
  run_test "doctor detects invalid state" test_doctor_state_check_invalid
  run_test "doctor checks git status" test_doctor_git_check
  run_test "doctor handles non-git repo" test_doctor_git_check_not_repo
  run_test "doctor --fix creates structure" test_doctor_fix_creates_structure
  run_test "doctor --fix creates state" test_doctor_fix_creates_state
  run_test "doctor --fix repairs invalid state" test_doctor_fix_repairs_invalid_state
  run_test "doctor runs all checks" test_doctor_all_checks
  run_test "doctor reports success" test_doctor_summary_no_issues
  run_test "doctor supports JSON output" test_doctor_json_output
  run_test "doctor checks paths" test_doctor_paths_check
  run_test "doctor checks templates" test_doctor_templates_check
}
