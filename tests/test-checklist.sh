#!/usr/bin/env bash
#
# Test Suite: Checklist Operations
#
# Tests for speckit checklist commands:
#   - status, list, incomplete, show
#

# =============================================================================
# Test Functions
# =============================================================================

test_checklist_status() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  # Create a checklist with some items
  cat > specs/001-feature/checklists/security.md << 'EOF'
# Security Checklist

- [x] Input validation
- [x] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF tokens
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" status specs/001-feature/checklists 2>&1)

  assert_contains "$output" "2 / 4" "Shows 2 completed of 4"
  assert_contains "$output" "50%" "Shows 50% completion"
}

test_checklist_status_json() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/test.md << 'EOF'
# Test Checklist
- [x] Item 1
- [ ] Item 2
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" status specs/001-feature/checklists --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"completed"' "Has completed key"
  assert_contains "$output" '"total"' "Has total key"
  assert_contains "$output" '"percent"' "Has percent key"
}

test_checklist_list() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/security.md << 'EOF'
- [x] Done
- [ ] Not done
EOF

  cat > specs/001-feature/checklists/testing.md << 'EOF'
- [x] Done 1
- [x] Done 2
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" list specs/001-feature/checklists 2>&1)

  assert_contains "$output" "security.md" "Shows security checklist"
  assert_contains "$output" "testing.md" "Shows testing checklist"
}

test_checklist_incomplete() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/items.md << 'EOF'
# Items
- [x] Done item
- [ ] Incomplete item one
- [ ] Incomplete item two
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" incomplete specs/001-feature/checklists 2>&1)

  assert_contains "$output" "Incomplete item one" "Shows first incomplete"
  assert_contains "$output" "Incomplete item two" "Shows second incomplete"
}

test_checklist_incomplete_json() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/items.md << 'EOF'
- [ ] TODO item
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" incomplete specs/001-feature/checklists --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"items"' "Has items key"
  assert_contains "$output" '"total"' "Has total key"
}

test_checklist_show() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/mylist.md << 'EOF'
# My Checklist
- [x] First completed
- [ ] Second pending
- [x] Third completed
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" show specs/001-feature/checklists/mylist.md 2>&1)

  assert_contains "$output" "2/3" "Shows 2 of 3 completed"
}

test_checklist_show_json() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/items.md << 'EOF'
- [x] Done
- [ ] Todo
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" show specs/001-feature/checklists/items.md --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"completed"' "Has completed key"
  assert_contains "$output" '"items"' "Has items array"
}

test_checklist_all_complete() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  cat > specs/001-feature/checklists/done.md << 'EOF'
- [x] First
- [x] Second
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" incomplete specs/001-feature/checklists 2>&1)

  assert_contains "$output" "All checklist items complete" "Shows all complete message"
}

test_checklist_no_files() {
  git init -q .
  mkdir -p specs/001-feature/checklists

  # Empty directory, no checklist files
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" status specs/001-feature/checklists 2>&1)

  assert_contains "$output" "No checklists found" "Shows no checklists message"
}

test_checklist_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-checklist.sh" --help)

  assert_contains "$output" "checklist" "Help shows command name"
  assert_contains "$output" "status" "Help shows status command"
  assert_contains "$output" "list" "Help shows list command"
  assert_contains "$output" "incomplete" "Help shows incomplete command"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "checklist status shows completion counts" test_checklist_status
  run_test "checklist status --json outputs valid JSON" test_checklist_status_json
  run_test "checklist list shows all checklists" test_checklist_list
  run_test "checklist incomplete shows pending items" test_checklist_incomplete
  run_test "checklist incomplete --json outputs valid JSON" test_checklist_incomplete_json
  run_test "checklist show displays file status" test_checklist_show
  run_test "checklist show --json outputs valid JSON" test_checklist_show_json
  run_test "checklist incomplete shows all complete message" test_checklist_all_complete
  run_test "checklist handles empty directory" test_checklist_no_files
  run_test "checklist --help shows usage" test_checklist_help
}
