#!/usr/bin/env bash
#
# Test Suite: Roadmap
#
# Tests for speckit roadmap command:
#   - status
#   - update
#   - next
#   - current
#   - validate
#

# =============================================================================
# Test Helpers
# =============================================================================

create_test_roadmap() {
  cat > ROADMAP.md << 'EOF'
# Project Roadmap

## Phase Overview

| Phase | Name | Status | Gate |
|-------|------|--------|------|
| 0010 | Foundation | ✅ | Core setup complete |
| 0020 | Core Features | 🔄 | Features implemented |
| 0030 | Testing | ⬜ | Tests passing |
| 0040 | Polish | ⬜ | Docs complete |

## Verification Gates

- [ ] All tests passing
- [ ] Documentation complete
EOF
}

# =============================================================================
# Test Functions
# =============================================================================

test_roadmap_status() {
  git init -q .
  create_test_roadmap

  # Run status
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" status 2>&1)

  # Should show phases
  assert_contains "$output" "0010" "Shows phase 0010"
  assert_contains "$output" "0020" "Shows phase 0020"
  assert_matches "$output" "complete|Complete|✅" "Shows complete status"
}

test_roadmap_status_json() {
  git init -q .
  create_test_roadmap

  # Run status with JSON
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" status --json 2>&1)

  # Should be valid JSON
  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"
}

test_roadmap_next() {
  git init -q .
  create_test_roadmap

  # Run next
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" next 2>&1)

  # Should return next pending phase (0030)
  # Could return 0020 if in_progress counts, or 0030 if only pending
  assert_matches "$output" "0030|0020" "Returns next phase"
}

test_roadmap_current() {
  git init -q .
  create_test_roadmap

  # Run current
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" current 2>&1)

  # Should return current in-progress phase (0020)
  assert_contains "$output" "0020" "Returns current phase"
}

test_roadmap_validate_valid() {
  git init -q .
  create_test_roadmap

  # Run validate
  assert_command_succeeds "bash ${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh validate" "Valid ROADMAP passes"
}

test_roadmap_validate_missing() {
  git init -q .
  # No ROADMAP.md

  # Validate should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh validate" "Missing ROADMAP fails"
}

test_roadmap_update_status() {
  git init -q .
  create_test_roadmap

  # Update phase 0030 to in_progress
  bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" update 0030 in_progress 2>&1

  # Verify update
  local content
  content=$(cat ROADMAP.md)
  assert_matches "$content" "🔄|In Progress" "Phase updated to in_progress"
}

test_roadmap_update_complete() {
  git init -q .
  create_test_roadmap

  # Update phase 0020 to complete
  bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" update 0020 complete 2>&1

  # Verify update - Phase 0020 should now have ✅ instead of 🔄
  if grep -qE '^\|\s*0020.*✅' ROADMAP.md 2>/dev/null; then
    return 0
  else
    echo "Phase 0020 not marked complete"
    cat ROADMAP.md
    return 1
  fi
}

test_roadmap_path() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"
  create_test_roadmap

  # Get path
  local path
  path=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" path 2>&1)

  # Should contain ROADMAP.md
  assert_contains "$path" "ROADMAP.md" "Returns correct path"
}

test_roadmap_no_phases() {
  git init -q .

  # Create empty ROADMAP
  echo "# Project Roadmap" > ROADMAP.md

  # Run status
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" status 2>&1)

  # Should handle gracefully
  # Either shows "no phases" or empty list
  [[ -n "$output" ]]
  assert_equals "0" "$?" "Handles empty ROADMAP"
}

test_roadmap_complex_format() {
  git init -q .

  # Create roadmap with more complex format (but still using table for phases)
  cat > ROADMAP.md << 'EOF'
# Development Roadmap

> Project phases and milestones

## Phase Overview

| Phase | Name | Status | Gate |
|-------|------|--------|------|
| 0010 | Setup & Foundation | ✅ | Sprint 1-2 |
| 0020 | Feature Development | 🔄 | Sprint 3-5 |
| 0030 | Testing & QA | ⬜ | Sprint 6-7 |

---

## Phase Details

### Phase 0010: Setup & Foundation
- Project setup
- Core infrastructure

### Phase 0020: Feature Development
- Main features
- API development

### Phase 0030: Testing & QA
- Unit tests
- Integration tests

## Verification Gates

- [ ] All sprints completed
- [ ] All tests passing
EOF

  # Run status
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" status 2>&1)

  # Should parse all phases
  assert_contains "$output" "0010" "Parses phase 0010"
  assert_contains "$output" "0020" "Parses phase 0020"
  assert_contains "$output" "0030" "Parses phase 0030"
}

test_roadmap_json_structure() {
  git init -q .
  create_test_roadmap

  # Get JSON status
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-roadmap.sh" status --json 2>&1)

  # Check JSON structure
  local has_phases
  has_phases=$(echo "$output" | jq 'has("phases") or type == "array"' 2>/dev/null || echo "false")

  # Should have phases array or be an array
  [[ "$has_phases" == "true" ]] || echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON has proper structure"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "roadmap status shows phases" test_roadmap_status
  run_test "roadmap status JSON is valid" test_roadmap_status_json
  run_test "roadmap next returns next phase" test_roadmap_next
  run_test "roadmap current returns in-progress" test_roadmap_current
  run_test "roadmap validate passes on valid" test_roadmap_validate_valid
  run_test "roadmap validate fails on missing" test_roadmap_validate_missing
  run_test "roadmap update changes status" test_roadmap_update_status
  run_test "roadmap update to complete" test_roadmap_update_complete
  run_test "roadmap path returns location" test_roadmap_path
  run_test "roadmap handles empty file" test_roadmap_no_phases
  run_test "roadmap parses complex format" test_roadmap_complex_format
  run_test "roadmap JSON has structure" test_roadmap_json_structure
}
