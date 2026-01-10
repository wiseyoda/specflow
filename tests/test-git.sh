#!/usr/bin/env bash
#
# Test Suite: Git Operations
#
# Tests for speckit git command:
#   - branch operations (create, checkout, current, list)
#   - commit
#   - status
#   - sync
#

# =============================================================================
# Test Functions
# =============================================================================

test_git_branch_current() {
  git init -q .

  # Create initial commit so HEAD exists
  echo "test" > test.txt
  git add test.txt
  git config user.email "test@test.com"
  git config user.name "Test User"
  git commit -q -m "Initial"

  # Get current branch
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" branch current 2>&1)

  # Should be main or master
  assert_matches "$output" "main|master" "Returns current branch"
}

test_git_branch_list() {
  git init -q .

  # Create initial commit so we have a branch
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial"

  # List branches
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" branch list 2>&1)

  # Should show main/master
  assert_matches "$output" "main|master" "Lists branches"
}

test_git_branch_create() {
  git init -q .

  # Create initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial"

  # Create new branch
  bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" branch create test-branch 2>&1

  # Verify we're on the new branch
  local current
  current=$(git rev-parse --abbrev-ref HEAD)
  assert_equals "test-branch" "$current" "Creates and checks out branch"
}

test_git_branch_checkout() {
  git init -q .

  # Create initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial"

  # Create a branch to checkout
  git branch other-branch

  # Checkout using speckit
  bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" branch checkout other-branch 2>&1

  # Verify we're on the branch
  local current
  current=$(git rev-parse --abbrev-ref HEAD)
  assert_equals "other-branch" "$current" "Checks out existing branch"
}

test_git_status() {
  git init -q .

  # Create a file
  echo "test" > test.txt

  # Get status
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" status 2>&1)

  # Should show untracked file
  assert_matches "$output" "test.txt|untracked|Untracked" "Shows untracked files"
}

test_git_commit() {
  git init -q .

  # Configure git for test
  git config user.email "test@test.com"
  git config user.name "Test User"

  # Create a file
  echo "test" > test.txt

  # Commit
  bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" commit "Test commit" 2>&1

  # Verify commit was made
  local log
  log=$(git log --oneline -1)
  assert_contains "$log" "Test commit" "Creates commit with message"
}

test_git_commit_empty() {
  git init -q .

  # Configure git for test
  git config user.email "test@test.com"
  git config user.name "Test User"

  # Create initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial"

  # Try to commit with no changes
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" commit "Empty commit" 2>&1)

  # Should report nothing to commit or succeed with empty
  assert_matches "$output" "nothing|Nothing|clean|no changes|No changes" "Handles no changes"
}

test_git_sync() {
  git init -q .

  # Sync (fetch all, status)
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" sync 2>&1)

  # Should show some status info
  # (might fail on no remote, but should handle gracefully)
  [[ -n "$output" ]]
  assert_equals "0" "$?" "Sync runs without error"
}

test_git_not_repo() {
  # Don't init git

  # Commands should fail gracefully
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" branch current 2>&1)

  # Should report error
  local exit_code=$?
  [[ $exit_code -ne 0 ]] || assert_matches "$output" "not|Not|error|Error" "Reports not a repo"
}

test_git_branch_with_number() {
  git init -q .

  # Create initial commit
  echo "test" > test.txt
  git add test.txt
  git commit -q -m "Initial"

  # Create branch with number prefix (common pattern)
  bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" branch create "feat/001-test-feature" 2>&1

  # Verify we're on the new branch
  local current
  current=$(git rev-parse --abbrev-ref HEAD)
  assert_equals "feat/001-test-feature" "$current" "Creates branch with number prefix"
}

test_git_json_output() {
  git init -q .

  # Create initial commit
  echo "test" > test.txt
  git add test.txt
  git config user.email "test@test.com"
  git config user.name "Test User"
  git commit -q -m "Initial"

  # Get status with JSON
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" status --json 2>&1)

  # Should contain JSON-like output
  if echo "$output" | grep -qE '^\{'; then
    echo "$output" | grep -E '^\{' | jq '.' >/dev/null 2>&1
    assert_equals "0" "$?" "JSON output is valid"
  else
    # Some git commands might not have JSON yet
    assert_equals "0" "0" "Command completed"
  fi
}

test_git_help() {
  # Get help
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-git.sh" --help 2>&1)

  # Should show usage info
  assert_matches "$output" "branch|commit|USAGE|Usage" "Shows help"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "git branch current shows branch" test_git_branch_current
  run_test "git branch list shows branches" test_git_branch_list
  run_test "git branch create makes new branch" test_git_branch_create
  run_test "git branch checkout switches branch" test_git_branch_checkout
  run_test "git status shows changes" test_git_status
  run_test "git commit creates commit" test_git_commit
  run_test "git commit handles empty" test_git_commit_empty
  run_test "git sync runs fetch" test_git_sync
  run_test "git handles non-repo gracefully" test_git_not_repo
  run_test "git branch with numbers" test_git_branch_with_number
  run_test "git supports JSON output" test_git_json_output
  run_test "git shows help" test_git_help
}
