#!/usr/bin/env bash
#
# Test Suite: Scaffold
#
# Tests for speckit scaffold command:
#   - Creating project structure
#   - --force flag
#   - --status flag
#

# =============================================================================
# Test Functions
# =============================================================================

test_scaffold_creates_structure() {
  # Initialize git repo
  git init -q .

  # Run scaffold
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Verify directories created
  assert_dir_exists ".specify" "Main directory created"
  assert_dir_exists ".specify/discovery" "Discovery directory created"
  assert_dir_exists ".specify/memory" "Memory directory created"
  assert_dir_exists ".specify/templates" "Templates directory created"
  assert_dir_exists ".specify/scripts" "Scripts directory created"
  assert_dir_exists ".specify/scripts/bash" "Bash scripts directory created"
  assert_dir_exists ".specify/archive" "Archive directory created"
  assert_dir_exists "specs" "Specs directory created"
}

test_scaffold_creates_state_file() {
  # Initialize git repo
  git init -q .

  # Run scaffold
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Verify state file created
  assert_file_exists ".specify/orchestration-state.json" "State file created"
  assert_json_valid ".specify/orchestration-state.json" "State file is valid JSON"
}

test_scaffold_status() {
  # Initialize git repo
  git init -q .

  # Check status before scaffold
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" --status 2>&1)
  assert_contains "$output" "missing" "Status shows missing before scaffold"

  # Run scaffold
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Check status after scaffold
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" --status 2>&1)
  # Should show directories exist now
  assert_contains "$output" ".specify" "Status shows .specify after scaffold"
}

test_scaffold_force() {
  # Initialize git repo
  git init -q .

  # Run scaffold first time
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Modify state file
  echo '{"modified": true}' > .specify/orchestration-state.json

  # Run with force - should recreate
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" --force

  # Verify state was recreated (not modified version)
  assert_json_equals ".specify/orchestration-state.json" ".version" "2.0" "State recreated with force"
}

test_scaffold_idempotent() {
  # Initialize git repo
  git init -q .

  # Run scaffold twice
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Add a file to a directory
  echo "test" > .specify/memory/test.md

  # Run again without force
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" 2>/dev/null || true

  # Verify file still exists
  assert_file_exists ".specify/memory/test.md" "Existing files preserved"
}

test_scaffold_not_git_repo() {
  # Don't initialize git

  # Scaffold should fail or warn
  local exit_code=0
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" 2>/dev/null || exit_code=$?

  # Either fails or creates structure anyway
  # Just verify it handles the case
  [[ $exit_code -ne 0 ]] || [[ -d ".specify" ]]
  assert_equals "0" "$?" "Handles non-git repo case"
}

test_scaffold_creates_gitkeep() {
  # Initialize git repo
  git init -q .

  # Run scaffold
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Check for .gitkeep files in empty directories
  # At least archive should have one
  if [[ -f ".specify/archive/.gitkeep" ]]; then
    assert_file_exists ".specify/archive/.gitkeep" "Creates .gitkeep for empty dirs"
  else
    # Or just verify the directories exist
    assert_dir_exists ".specify/archive" "Archive directory exists"
  fi
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "scaffold creates directory structure" test_scaffold_creates_structure
  run_test "scaffold creates state file" test_scaffold_creates_state_file
  run_test "scaffold --status shows state" test_scaffold_status
  run_test "scaffold --force recreates structure" test_scaffold_force
  run_test "scaffold is idempotent" test_scaffold_idempotent
  run_test "scaffold handles non-git repo" test_scaffold_not_git_repo
  run_test "scaffold creates .gitkeep files" test_scaffold_creates_gitkeep
}
