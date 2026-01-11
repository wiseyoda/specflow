#!/usr/bin/env bash
#
# Test Suite: Memory Document Operations
#
# Tests for speckit memory commands:
#   - init, list, check, path
#

# =============================================================================
# Test Functions
# =============================================================================

test_memory_init_constitution() {
  # Initialize git repo (required for operations)
  git init -q .
  mkdir -p .specify

  # Run memory init for constitution
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution

  # Verify constitution was created
  assert_file_exists ".specify/memory/constitution.md" "Constitution created"

  # Verify content has expected sections
  local content
  content=$(cat .specify/memory/constitution.md)
  assert_contains "$content" "# " "Has title"
  assert_contains "$content" "Core Principles" "Has Core Principles section"
  assert_contains "$content" "Governance" "Has Governance section"
}

test_memory_init_recommended() {
  git init -q .
  mkdir -p .specify

  # Run memory init for recommended docs
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init recommended

  # Verify recommended docs were created
  assert_file_exists ".specify/memory/constitution.md" "Constitution created"
  assert_file_exists ".specify/memory/tech-stack.md" "Tech stack created"
  assert_file_exists ".specify/memory/coding-standards.md" "Coding standards created"
  assert_file_exists ".specify/memory/api-standards.md" "API standards created"
  assert_file_exists ".specify/memory/security-checklist.md" "Security checklist created"
  assert_file_exists ".specify/memory/testing-strategy.md" "Testing strategy created"

  # Glossary should NOT be created (it's optional)
  [[ ! -f ".specify/memory/glossary.md" ]]
  assert_equals "0" "$?" "Glossary not created (optional)"
}

test_memory_init_all() {
  git init -q .
  mkdir -p .specify

  # Run memory init for all docs
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init all

  # Verify all docs were created including glossary
  assert_file_exists ".specify/memory/constitution.md" "Constitution created"
  assert_file_exists ".specify/memory/tech-stack.md" "Tech stack created"
  assert_file_exists ".specify/memory/coding-standards.md" "Coding standards created"
  assert_file_exists ".specify/memory/api-standards.md" "API standards created"
  assert_file_exists ".specify/memory/security-checklist.md" "Security checklist created"
  assert_file_exists ".specify/memory/testing-strategy.md" "Testing strategy created"
  assert_file_exists ".specify/memory/glossary.md" "Glossary created"
}

test_memory_init_skip_existing() {
  git init -q .
  mkdir -p .specify/memory

  # Create existing constitution with custom content
  echo "# Custom Constitution" > .specify/memory/constitution.md
  echo "My custom content" >> .specify/memory/constitution.md

  # Run init without force flag
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution 2>/dev/null

  # Verify original content preserved
  local content
  content=$(cat .specify/memory/constitution.md)
  assert_contains "$content" "Custom Constitution" "Original content preserved"
}

test_memory_init_force() {
  git init -q .
  mkdir -p .specify/memory

  # Create existing constitution with custom content
  echo "# Custom Constitution" > .specify/memory/constitution.md

  # Run init WITH force flag
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution --force

  # Verify content was overwritten
  local content
  content=$(cat .specify/memory/constitution.md)
  assert_contains "$content" "Core Principles" "Content was overwritten"
}

test_memory_list() {
  git init -q .
  mkdir -p .specify/memory

  # Create some memory docs
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init tech-stack

  # Run list command
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" list 2>&1)

  # Verify output contains expected info
  assert_contains "$output" "constitution.md" "Shows constitution"
  assert_contains "$output" "tech-stack.md" "Shows tech-stack"
  assert_contains "$output" "REQUIRED" "Shows REQUIRED type"
  assert_contains "$output" "RECOMMENDED" "Shows RECOMMENDED type"
}

test_memory_list_json() {
  git init -q .
  mkdir -p .specify/memory

  # Create a memory doc
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution

  # Run list with JSON output
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" list --json)

  # Should be valid JSON
  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  # Should contain documents array
  assert_contains "$output" '"documents"' "Has documents key"
  assert_contains "$output" '"exists": true' "Shows constitution exists"
}

test_memory_check_passes() {
  git init -q .
  mkdir -p .specify/memory

  # Create constitution (required)
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution

  # Check should pass
  assert_command_succeeds "bash ${PROJECT_ROOT}/scripts/bash/speckit-memory.sh check" "Check passes with constitution"
}

test_memory_check_fails_without_constitution() {
  git init -q .
  mkdir -p .specify/memory

  # Create other docs but NOT constitution
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init tech-stack

  # Check should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/speckit-memory.sh check" "Check fails without constitution"
}

test_memory_check_warns_missing_recommended() {
  git init -q .
  mkdir -p .specify/memory

  # Create only constitution
  bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" init constitution

  # Check should pass but warn
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" check 2>&1)

  # Should mention missing recommended docs
  assert_contains "$output" "missing" "Warns about missing docs"
}

test_memory_path() {
  git init -q .
  mkdir -p .specify

  # Get path
  local path
  path=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" path)

  # Should contain expected path
  assert_contains "$path" ".specify/memory" "Path contains memory directory"
}

test_memory_path_json() {
  git init -q .
  mkdir -p .specify

  # Get path with JSON output (--json must come first)
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" --json path)

  # Should be valid JSON
  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  # Should contain path
  assert_contains "$output" '"path"' "Has path key"
}

test_memory_init_invalid_doc() {
  git init -q .
  mkdir -p .specify

  # Try to init invalid document
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/speckit-memory.sh init invalid-doc" "Invalid doc fails"
}

test_memory_help() {
  # Help should show without error
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-memory.sh" --help)

  assert_contains "$output" "memory" "Help shows command name"
  assert_contains "$output" "init" "Help shows init command"
  assert_contains "$output" "list" "Help shows list command"
  assert_contains "$output" "check" "Help shows check command"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "memory init creates constitution" test_memory_init_constitution
  run_test "memory init recommended creates all recommended docs" test_memory_init_recommended
  run_test "memory init all creates all docs including glossary" test_memory_init_all
  run_test "memory init skips existing files" test_memory_init_skip_existing
  run_test "memory init --force overwrites existing" test_memory_init_force
  run_test "memory list shows documents" test_memory_list
  run_test "memory list --json outputs valid JSON" test_memory_list_json
  run_test "memory check passes with constitution" test_memory_check_passes
  run_test "memory check fails without constitution" test_memory_check_fails_without_constitution
  run_test "memory check warns about missing recommended" test_memory_check_warns_missing_recommended
  run_test "memory path returns correct path" test_memory_path
  run_test "memory path --json outputs valid JSON" test_memory_path_json
  run_test "memory init rejects invalid document" test_memory_init_invalid_doc
  run_test "memory --help shows usage" test_memory_help
}
