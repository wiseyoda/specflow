#!/usr/bin/env bash
#
# Test Suite: Feature Operations
#
# Tests for specflow feature commands:
#   - create, list, status
#

# =============================================================================
# Test Functions
# =============================================================================

test_feature_create() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  mkdir -p .specify

  # Create a feature (now creates 4-digit phases)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" create 0010 test-feature --no-branch

  assert_dir_exists "specs/0010-test-feature" "Feature directory created"
  assert_file_exists "specs/0010-test-feature/spec.md" "spec.md created"
  assert_dir_exists "specs/0010-test-feature/checklists" "checklists dir created"
  assert_dir_exists "specs/0010-test-feature/contracts" "contracts dir created"
}

test_feature_create_normalizes_phase() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  mkdir -p .specify

  # Create with single digit phase (should normalize to 4 digits)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" create 2 my-feature --no-branch

  assert_dir_exists "specs/0002-my-feature" "Phase normalized to 0002"
}

test_feature_create_creates_branch() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  mkdir -p .specify

  bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" create 0030 branched-feature

  local branch
  branch=$(git branch --show-current)
  assert_equals "0030-branched-feature" "$branch" "Switched to feature branch"
}

test_feature_create_rejects_invalid_name() {
  git init -q .
  mkdir -p .specify

  # Invalid name (uppercase)
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-feature.sh create 0010 InvalidName --no-branch" "Rejects uppercase"

  # Invalid name (starts with number)
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-feature.sh create 0010 123-feature --no-branch" "Rejects leading number"
}

test_feature_create_rejects_duplicate_phase() {
  git init -q .
  git commit --allow-empty -m "Initial" -q
  mkdir -p .specify specs/0010-existing

  # Try to create feature with same phase
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-feature.sh create 0010 new-feature --no-branch" "Rejects duplicate phase"
}

test_feature_create_rejects_existing_dir() {
  git init -q .
  mkdir -p .specify specs/0020-existing-feature

  # Try to create feature with same name
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-feature.sh create 0020 existing-feature --no-branch" "Rejects existing directory"
}

test_feature_list() {
  git init -q .
  mkdir -p specs/001-feature-one specs/002-feature-two specs/003-feature-three

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" list 2>&1)

  assert_contains "$output" "001-feature-one" "Lists first feature"
  assert_contains "$output" "002-feature-two" "Lists second feature"
  assert_contains "$output" "003-feature-three" "Lists third feature"
}

test_feature_list_json() {
  git init -q .
  mkdir -p specs/001-feature-one specs/002-feature-two

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" list --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"features"' "Has features key"
  assert_contains "$output" '"count"' "Has count key"
}

test_feature_list_empty() {
  git init -q .
  mkdir -p specs

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" list 2>&1)

  assert_contains "$output" "No features found" "Shows empty message"
}

test_feature_status() {
  git init -q .
  mkdir -p specs/001-complete specs/002-partial

  # Complete feature
  touch specs/001-complete/spec.md
  touch specs/001-complete/plan.md
  touch specs/001-complete/tasks.md

  # Partial feature
  touch specs/002-partial/spec.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" status 2>&1)

  assert_contains "$output" "001-complete" "Shows complete feature"
  assert_contains "$output" "002-partial" "Shows partial feature"
  assert_contains "$output" "SPEC" "Shows SPEC column"
  assert_contains "$output" "PLAN" "Shows PLAN column"
  assert_contains "$output" "TASKS" "Shows TASKS column"
}

test_feature_status_json() {
  git init -q .
  mkdir -p specs/001-feature
  touch specs/001-feature/spec.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" status --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"features"' "Has features key"
  assert_contains "$output" '"has_spec"' "Has has_spec key"
}

test_feature_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-feature.sh" --help)

  assert_contains "$output" "feature" "Help shows command name"
  assert_contains "$output" "create" "Help shows create command"
  assert_contains "$output" "list" "Help shows list command"
  assert_contains "$output" "status" "Help shows status command"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "feature create makes directory structure" test_feature_create
  run_test "feature create normalizes phase number" test_feature_create_normalizes_phase
  run_test "feature create creates git branch" test_feature_create_creates_branch
  run_test "feature create rejects invalid names" test_feature_create_rejects_invalid_name
  run_test "feature create rejects duplicate phase" test_feature_create_rejects_duplicate_phase
  run_test "feature create rejects existing directory" test_feature_create_rejects_existing_dir
  run_test "feature list shows all features" test_feature_list
  run_test "feature list --json outputs valid JSON" test_feature_list_json
  run_test "feature list handles empty specs" test_feature_list_empty
  run_test "feature status shows document status" test_feature_status
  run_test "feature status --json outputs valid JSON" test_feature_status_json
  run_test "feature --help shows usage" test_feature_help
}
