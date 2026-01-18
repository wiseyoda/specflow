#!/usr/bin/env bash
#
# Test Suite: Task Operations
#
# Tests for specflow tasks commands:
#   - status, incomplete, mark, phase-status, list, find
#

# =============================================================================
# Test Functions
# =============================================================================

test_tasks_status() {
  git init -q .
  mkdir -p .specify specs/001-feature

  # Create tasks file
  cat > specs/001-feature/tasks.md << 'EOF'
# Tasks

## Phase 1: Setup
- [x] T001 Initialize project
- [x] T002 Configure build system
- [ ] T003 Add test framework

## Phase 2: Core
- [ ] T004 Implement main logic
- [ ] T005 Add error handling
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" status specs/001-feature/tasks.md 2>&1)

  assert_contains "$output" "2 / 5" "Shows 2 completed of 5"
  assert_contains "$output" "40%" "Shows 40% completion"
}

test_tasks_status_json() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [x] T001 Done
- [ ] T002 Todo
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" status specs/001-feature/tasks.md --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"completed"' "Has completed key"
  assert_contains "$output" '"total"' "Has total key"
  assert_contains "$output" '"percent"' "Has percent key"
}

test_tasks_incomplete() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [x] T001 Completed task
- [ ] T002 First incomplete task
- [ ] T003 Second incomplete task
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" incomplete specs/001-feature/tasks.md 2>&1)

  assert_contains "$output" "T002" "Shows T002"
  assert_contains "$output" "T003" "Shows T003"
}

test_tasks_incomplete_json() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [ ] T001 Todo task
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" incomplete specs/001-feature/tasks.md --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"tasks"' "Has tasks key"
  assert_contains "$output" '"count"' "Has count key"
}

test_tasks_mark() {
  git init -q .
  mkdir -p .specify specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [ ] T001 First task
- [ ] T002 Second task
EOF

  # Mark T001 complete
  bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" mark T001 specs/001-feature/tasks.md

  # Verify it was marked
  local content
  content=$(cat specs/001-feature/tasks.md)
  assert_contains "$content" "[x] T001" "T001 is marked complete"
}

test_tasks_mark_already_complete() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [x] T001 Already done
EOF

  # Try to mark again (should warn but not fail)
  assert_command_succeeds "bash ${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh mark T001 specs/001-feature/tasks.md" "Marking already complete task succeeds"
}

test_tasks_mark_invalid_id() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [ ] T001 Task
EOF

  # Try to mark non-existent task
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh mark T999 specs/001-feature/tasks.md" "Fails on non-existent task"
}

test_tasks_phase_status() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
## Phase 1: Setup
- [x] T001 Init
- [x] T002 Config

## Phase 2: Core
- [ ] T003 Main logic
- [ ] T004 Error handling
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" phase-status specs/001-feature/tasks.md 2>&1)

  assert_contains "$output" "Phase 1" "Shows Phase 1"
  assert_contains "$output" "Phase 2" "Shows Phase 2"
}

test_tasks_list() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [x] T001 Completed task
- [ ] T002 Pending task
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" list specs/001-feature/tasks.md 2>&1)

  assert_contains "$output" "T001" "Shows T001"
  assert_contains "$output" "T002" "Shows T002"
}

test_tasks_list_json() {
  git init -q .
  mkdir -p specs/001-feature

  cat > specs/001-feature/tasks.md << 'EOF'
- [x] T001 Done
- [ ] T002 Todo
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" list specs/001-feature/tasks.md --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"tasks"' "Has tasks array"
  assert_contains "$output" '"status"' "Has status key"
}

test_tasks_find() {
  git init -q .
  mkdir -p specs/001-feature specs/002-feature

  touch specs/001-feature/tasks.md
  touch specs/002-feature/tasks.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" find 2>&1)

  assert_contains "$output" "001-feature/tasks.md" "Finds first tasks.md"
  assert_contains "$output" "002-feature/tasks.md" "Finds second tasks.md"
}

test_tasks_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-tasks.sh" --help)

  assert_contains "$output" "tasks" "Help shows command name"
  assert_contains "$output" "status" "Help shows status command"
  assert_contains "$output" "mark" "Help shows mark command"
  assert_contains "$output" "incomplete" "Help shows incomplete command"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "tasks status shows completion counts" test_tasks_status
  run_test "tasks status --json outputs valid JSON" test_tasks_status_json
  run_test "tasks incomplete shows pending tasks" test_tasks_incomplete
  run_test "tasks incomplete --json outputs valid JSON" test_tasks_incomplete_json
  run_test "tasks mark completes a task" test_tasks_mark
  run_test "tasks mark handles already complete" test_tasks_mark_already_complete
  run_test "tasks mark fails on invalid ID" test_tasks_mark_invalid_id
  run_test "tasks phase-status shows by phase" test_tasks_phase_status
  run_test "tasks list shows all tasks" test_tasks_list
  run_test "tasks list --json outputs valid JSON" test_tasks_list_json
  run_test "tasks find locates all tasks.md files" test_tasks_find
  run_test "tasks --help shows usage" test_tasks_help
}
