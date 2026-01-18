#!/usr/bin/env bash
#
# Test Suite: State Management
#
# Tests for specflow state commands:
#   - init, get, set, validate, reset, migrate, path
#

# =============================================================================
# Test Functions
# =============================================================================

test_state_init() {
  # Initialize git repo (required for state operations)
  git init -q .
  mkdir -p .specify

  # Run state init
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Verify state file created
  assert_file_exists ".specify/orchestration-state.json" "State file created"

  # Verify valid JSON
  assert_json_valid ".specify/orchestration-state.json" "State file is valid JSON"

  # Verify version
  assert_json_equals ".specify/orchestration-state.json" ".version" "2.0" "Version is 2.0"

  # Verify required sections
  assert_json_equals ".specify/orchestration-state.json" ".config.roadmap_path" "ROADMAP.md" "Config has roadmap_path"
}

test_state_get() {
  # Setup
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Test get full state
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" get)
  assert_contains "$output" '"version": "2.0"' "Full state contains version"

  # Test get specific key
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" get .version)
  assert_equals "2.0" "$output" "Get specific key returns value"

  # Test get nested key
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" get .config.roadmap_path)
  assert_equals "ROADMAP.md" "$output" "Get nested key returns value"

  # Test get section
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" get .config)
  assert_contains "$output" "roadmap_path" "Get section returns object"
}

test_state_set() {
  # Setup
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Set a value
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".project.name=TestProject"

  # Verify it was set
  assert_json_equals ".specify/orchestration-state.json" ".project.name" "TestProject" "Value was set"

  # Set nested value
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.step=plan"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.step" "plan" "Nested value was set"

  # Verify timestamp was updated
  local timestamp
  timestamp=$(jq -r '.last_updated' .specify/orchestration-state.json)
  assert_contains "$timestamp" "20" "Timestamp was updated"
}

test_state_validate() {
  # Setup valid state
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Validate should succeed
  assert_command_succeeds "bash ${PROJECT_ROOT}/scripts/bash/specflow-state.sh validate" "Valid state passes validation"

  # Corrupt the state
  echo "not json" > .specify/orchestration-state.json

  # Validate should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-state.sh validate" "Invalid JSON fails validation"
}

test_state_reset() {
  # Setup
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Set some values
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".project.name=TestProject"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".interview.status=in_progress"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.step=plan"

  # Reset (should preserve config but reset interview/orchestration)
  echo "y" | bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" reset

  # Verify interview was reset
  assert_json_equals ".specify/orchestration-state.json" ".interview.status" "not_started" "Interview was reset"

  # Verify orchestration was reset (v2.0 format uses step.current)
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.step.current" "null" "Orchestration was reset"
}

test_state_path() {
  # Setup
  git init -q .
  mkdir -p .specify

  # Get path
  local path
  path=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" path)

  # Should end with the expected filename
  assert_contains "$path" "orchestration-state.json" "Path contains correct filename"
}

test_state_json_output() {
  # Setup
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Test JSON output flag
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" get --json)

  # Should be valid JSON
  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"
}

test_state_no_file() {
  # Setup git repo but no state file
  git init -q .
  mkdir -p .specify

  # Get should fail gracefully
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-state.sh get" "Get fails without state file"

  # Set should fail gracefully
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-state.sh set .foo=bar" "Set fails without state file"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "state init creates valid state file" test_state_init
  run_test "state get retrieves values correctly" test_state_get
  run_test "state set updates values" test_state_set
  run_test "state validate checks file validity" test_state_validate
  run_test "state reset clears interview and orchestration" test_state_reset
  run_test "state path returns correct path" test_state_path
  run_test "state supports JSON output" test_state_json_output
  run_test "state commands fail gracefully without file" test_state_no_file
}
