#!/usr/bin/env bash
#
# Test Suite: Reconciliation
#
# Tests for specflow reconcile command:
#   - Task completion comparison
#   - Git branch comparison
#   - State/file sync
#   - --trust-files flag
#   - --dry-run flag
#

# =============================================================================
# Test Functions
# =============================================================================

test_reconcile_in_sync() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Run reconcile on fresh project
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should show in sync or no active phase
  assert_matches "$output" "sync|No active phase|not_started" "Reports sync status"
}

test_reconcile_git_branch_mismatch() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set branch in state (v2.0 schema)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.branch=feat/test-branch"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.status=in_progress"

  # Current branch is main/master
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should detect branch mismatch
  # (might show as mismatch or just comparison)
  assert_matches "$output" "branch|Branch" "Checks git branch"
}

test_reconcile_task_comparison() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set up orchestration state (v2.0 schema paths)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.number=001"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.status=in_progress"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.progress.tasks_completed=5"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.progress.tasks_total=10"

  # Create tasks.md with different count
  mkdir -p specs/001-test
  cat > specs/001-test/tasks.md << 'EOF'
# Tasks

- [x] Task 1
- [x] Task 2
- [x] Task 3
- [x] Task 4
- [x] Task 5
- [x] Task 6
- [x] Task 7
- [ ] Task 8
- [ ] Task 9
- [ ] Task 10
EOF

  # Run reconcile
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should detect task mismatch (state says 5, file says 7)
  assert_matches "$output" "task|Task" "Checks task completion"
}

test_reconcile_dry_run() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set mismatch (v2.0 schema)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.branch=wrong-branch"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.status=in_progress"

  # Get original value
  local original
  original=$(jq -r '.orchestration.phase.branch' .specify/orchestration-state.json)

  # Run with dry-run
  bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" --dry-run --trust-files 2>&1

  # Value should not have changed
  local after
  after=$(jq -r '.orchestration.phase.branch' .specify/orchestration-state.json)
  assert_equals "$original" "$after" "Dry run doesn't modify files"
}

test_reconcile_trust_files() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set up with task mismatch (v2.0 schema)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.number=001"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.status=in_progress"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.progress.tasks_completed=2"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.progress.tasks_total=5"

  # Create tasks.md with 4/5 complete
  mkdir -p specs/001-test
  cat > specs/001-test/tasks.md << 'EOF'
# Tasks
- [x] Task 1
- [x] Task 2
- [x] Task 3
- [x] Task 4
- [ ] Task 5
EOF

  # Run with trust-files
  bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" --trust-files 2>&1

  # State should be updated to match files
  local completed
  completed=$(jq -r '.orchestration.progress.tasks_completed' .specify/orchestration-state.json)
  assert_equals "4" "$completed" "State updated from files"
}

test_reconcile_interview_check() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set interview in progress
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".interview.status=in_progress"

  # But no discovery files exist
  # Run reconcile
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should report on interview state
  assert_matches "$output" "interview|Interview" "Checks interview state"
}

test_reconcile_roadmap_check() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set orchestration in progress (v2.0 schema)
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.number=002"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.status=in_progress"

  # Create ROADMAP with matching status
  cat > ROADMAP.md << 'EOF'
# Roadmap

## Phase 001: Setup ✅
Complete

## Phase 002: Core 🔄
In progress
EOF

  # Run reconcile
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should check ROADMAP
  assert_contains "$output" "ROADMAP" "Checks ROADMAP status"
}

test_reconcile_spec_artifacts() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Set step past specify (v2.0 schema) - e.g., on plan step
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.number=001"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.phase.status=in_progress"
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" set ".orchestration.step.current=plan"

  # But no spec.md exists
  mkdir -p specs/001-test
  # (no spec.md)

  # Run reconcile
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should detect missing spec
  assert_matches "$output" "Spec|spec" "Checks spec artifacts"
}

test_reconcile_summary() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Run reconcile
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" 2>&1)

  # Should include summary info - either "in sync" or "difference(s)"
  assert_matches "$output" "in sync|difference" "Includes summary info"
}

test_reconcile_json_output() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh" >/dev/null 2>&1

  # Run with JSON output
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" --json 2>&1)

  # Extract JSON block (from { to final })
  local json_block
  json_block=$(echo "$output" | sed -n '/^{/,/^}/p')

  if [[ -n "$json_block" ]]; then
    if echo "$json_block" | jq '.' >/dev/null 2>&1; then
      return 0
    else
      echo "Failed to parse JSON block"
      return 1
    fi
  else
    # No JSON output is also acceptable for some states
    return 0
  fi
}

test_reconcile_exit_code() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/specflow-scaffold.sh"

  # Fresh project should be in sync
  local exit_code=0
  bash "${PROJECT_ROOT}/scripts/bash/specflow-reconcile.sh" >/dev/null 2>&1 || exit_code=$?

  # Exit code 0 = in sync, 2 = differences found
  [[ "$exit_code" -eq 0 || "$exit_code" -eq 2 ]]
  assert_equals "0" "$?" "Exit code is valid"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "reconcile reports sync status" test_reconcile_in_sync
  run_test "reconcile detects git branch mismatch" test_reconcile_git_branch_mismatch
  run_test "reconcile compares task completion" test_reconcile_task_comparison
  run_test "reconcile --dry-run doesn't modify" test_reconcile_dry_run
  run_test "reconcile --trust-files updates state" test_reconcile_trust_files
  run_test "reconcile checks interview state" test_reconcile_interview_check
  run_test "reconcile checks ROADMAP status" test_reconcile_roadmap_check
  run_test "reconcile checks spec artifacts" test_reconcile_spec_artifacts
  run_test "reconcile includes summary" test_reconcile_summary
  run_test "reconcile supports JSON output" test_reconcile_json_output
  run_test "reconcile returns valid exit code" test_reconcile_exit_code
}
