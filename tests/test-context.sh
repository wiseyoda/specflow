#!/usr/bin/env bash
#
# Test Suite: Context Operations
#
# Tests for specflow context command:
#   - Detects feature from branch name
#   - Returns paths and available documents
#   - Validates requirements
#

# =============================================================================
# Test Functions
# =============================================================================

test_context_detects_feature() {
  # Setup git repo with feature branch
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "001-test-feature" -q
  mkdir -p specs/001-test-feature
  touch specs/001-test-feature/spec.md

  # Run context command
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-context.sh" 2>&1)

  assert_contains "$output" "FEATURE_DIR" "Shows feature directory"
  assert_contains "$output" "001-test-feature" "Shows branch name"
  assert_contains "$output" "PHASE" "Shows phase"
}

test_context_json_output() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "002-another-feature" -q
  mkdir -p specs/002-another-feature
  touch specs/002-another-feature/spec.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-context.sh" --json 2>&1)

  # Should be valid JSON
  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"feature_dir"' "Has feature_dir key"
  assert_contains "$output" '"branch"' "Has branch key"
  assert_contains "$output" '"phase"' "Has phase key"
}

test_context_shows_available_docs() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "003-docs-feature" -q

  mkdir -p specs/003-docs-feature
  touch specs/003-docs-feature/spec.md
  touch specs/003-docs-feature/plan.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-context.sh" 2>&1)

  assert_contains "$output" "spec.md" "Shows spec.md"
  assert_contains "$output" "plan.md" "Shows plan.md"
}

test_context_require_spec() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "004-no-spec" -q

  mkdir -p specs/004-no-spec
  # Don't create spec.md

  # Should fail with --require-spec
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-context.sh --require-spec" "Fails when spec missing"
}

test_context_require_plan() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "005-no-plan" -q

  mkdir -p specs/005-no-plan
  touch specs/005-no-plan/spec.md
  # Don't create plan.md

  # Should fail with --require-plan
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-context.sh --require-plan" "Fails when plan missing"
}

test_context_require_tasks() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "006-no-tasks" -q

  mkdir -p specs/006-no-tasks
  touch specs/006-no-tasks/spec.md
  # Don't create tasks.md

  # Should fail with --require-tasks
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-context.sh --require-tasks" "Fails when tasks missing"
}

test_context_invalid_branch_pattern() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "main" -q

  # Should fail - branch doesn't match NNN-feature pattern
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-context.sh" "Fails on non-feature branch"
}

test_context_missing_feature_dir() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  git checkout -b "007-missing-dir" -q

  mkdir -p specs
  # Don't create the feature directory

  # Should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-context.sh" "Fails when feature dir missing"
}

test_context_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-context.sh" --help)

  assert_contains "$output" "context" "Help shows command name"
  assert_contains "$output" "--require-spec" "Help shows require-spec option"
  assert_contains "$output" "--json" "Help shows json option"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "context detects feature from branch" test_context_detects_feature
  run_test "context --json outputs valid JSON" test_context_json_output
  run_test "context shows available docs" test_context_shows_available_docs
  run_test "context --require-spec fails when missing" test_context_require_spec
  run_test "context --require-plan fails when missing" test_context_require_plan
  run_test "context --require-tasks fails when missing" test_context_require_tasks
  run_test "context fails on non-feature branch" test_context_invalid_branch_pattern
  run_test "context fails when feature dir missing" test_context_missing_feature_dir
  run_test "context --help shows usage" test_context_help
}
