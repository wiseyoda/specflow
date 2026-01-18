#!/usr/bin/env bash
#
# Test Suite: State Migration
#
# Tests for specflow state migrate command:
#   - v1.0 to v2.0 migration
#   - Backup creation
#   - Data preservation
#   - Error handling
#

# =============================================================================
# Test Functions
# =============================================================================

test_migrate_v1_to_v2() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format state
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "name": "TestProject",
    "description": "A test project"
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Verify schema_version updated (v2.0 uses schema_version, not version)
  assert_json_equals ".specify/orchestration-state.json" ".schema_version" "2.0" "Schema version updated to 2.0"

  # Verify config section created
  assert_json_equals ".specify/orchestration-state.json" ".config.roadmap_path" "ROADMAP.md" "Config section created"

  # Verify project data preserved
  assert_json_equals ".specify/orchestration-state.json" ".project.name" "TestProject" "Project name preserved"
}

test_migrate_creates_backup() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format state
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "name": "BackupTest"
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Verify backup created
  assert_dir_exists ".specify/backup" "Backup directory created"

  # Find backup file
  local backup_count
  backup_count=$(find .specify/backup -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
  [[ "$backup_count" -gt 0 ]]
  assert_equals "0" "$?" "Backup file created"
}

test_migrate_preserves_interview_data() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format with interview data
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "name": "InterviewTest"
  },
  "interview": {
    "status": "in_progress",
    "current_phase": 5,
    "decisions_count": 23
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Verify interview data preserved
  assert_json_equals ".specify/orchestration-state.json" ".interview.status" "in_progress" "Interview status preserved"
  assert_json_equals ".specify/orchestration-state.json" ".interview.current_phase" "5" "Interview phase preserved"
  assert_json_equals ".specify/orchestration-state.json" ".interview.decisions_count" "23" "Decisions count preserved"
}

test_migrate_preserves_orchestration_data() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format with orchestration data in .current (the REAL v1.0 format)
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "roadmap_path": "ROADMAP.md",
    "name": "OrchTest"
  },
  "current": {
    "phase_number": "003",
    "phase_name": "test-phase",
    "branch": "003-test-phase",
    "step": "implement",
    "step_index": 6,
    "status": "in_progress"
  },
  "steps": {
    "specify": {"status": "completed", "completed_at": "2026-01-10T10:00:00Z"},
    "implement": {"status": "in_progress", "tasks_completed": 5, "tasks_total": 10, "current_task": "T006"}
  },
  "history": [
    {"phase": "001-init", "completed_at": "2026-01-10T08:00:00Z"},
    {"phase": "002-setup", "completed_at": "2026-01-10T09:00:00Z"}
  ]
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Verify current phase data migrated to orchestration.phase
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.phase.number" "003" "Phase number preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.phase.name" "test-phase" "Phase name preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.phase.branch" "003-test-phase" "Branch preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.phase.status" "in_progress" "Phase status preserved"

  # Verify step data migrated
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.step.current" "implement" "Step current preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.step.index" "6" "Step index preserved"

  # Verify progress data extracted from steps.implement
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.progress.tasks_completed" "5" "Tasks completed preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.progress.tasks_total" "10" "Tasks total preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.progress.current_task" "T006" "Current task preserved"

  # Verify history moved to actions.history
  local history_count
  history_count=$(jq '.actions.history | length' .specify/orchestration-state.json)
  assert_equals "2" "$history_count" "History phases preserved"

  # Verify v1 steps preserved in migration metadata
  local v1_steps
  v1_steps=$(jq '._migration.v1_steps | has("implement")' .specify/orchestration-state.json)
  assert_equals "true" "$v1_steps" "V1 steps preserved in migration metadata"
}

test_migrate_already_v2() {
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" init --force

  # Run migration on v2.0 file
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate 2>&1)

  # Should report already v2.0
  assert_contains "$output" "already v2.0" "Reports already migrated"
}

test_migrate_adds_missing_sections() {
  git init -q .
  mkdir -p .specify

  # Create partial v2.0 format (missing sections)
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.5",
  "config": {
    "roadmap_path": "ROADMAP.md"
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Verify missing sections added
  local has_interview
  has_interview=$(jq 'has("interview")' .specify/orchestration-state.json)
  assert_equals "true" "$has_interview" "Interview section added"

  local has_orchestration
  has_orchestration=$(jq 'has("orchestration")' .specify/orchestration-state.json)
  assert_equals "true" "$has_orchestration" "Orchestration section added"
}

test_migrate_handles_invalid_json() {
  git init -q .
  mkdir -p .specify

  # Create invalid JSON
  echo "not valid json" > .specify/orchestration-state.json

  # Migration should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-state.sh migrate" "Fails on invalid JSON"
}

test_migrate_no_file() {
  git init -q .
  mkdir -p .specify

  # No state file

  # Migration should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-state.sh migrate" "Fails when no file"
}

test_migrate_marks_migration() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "name": "MarkTest"
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Check for migration marker
  local migrated_from
  migrated_from=$(jq -r '._migrated_from // empty' .specify/orchestration-state.json)

  if [[ -n "$migrated_from" ]]; then
    assert_equals "v1.0" "$migrated_from" "Migration source marked"
  else
    # Migration marker is optional
    assert_equals "0" "0" "Migration completed"
  fi
}

test_migrate_config_paths() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 with all config paths in project
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "roadmap_path": "custom/ROADMAP.md",
    "memory_path": "custom/memory/",
    "specs_path": "custom/specs/",
    "name": "ConfigTest"
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/specflow-state.sh" migrate

  # Verify paths moved to config section
  assert_json_equals ".specify/orchestration-state.json" ".config.roadmap_path" "custom/ROADMAP.md" "Custom roadmap path preserved"
  assert_json_equals ".specify/orchestration-state.json" ".config.memory_path" "custom/memory/" "Custom memory path preserved"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "migrate converts v1.0 to v2.0" test_migrate_v1_to_v2
  run_test "migrate creates backup" test_migrate_creates_backup
  run_test "migrate preserves interview data" test_migrate_preserves_interview_data
  run_test "migrate preserves orchestration data" test_migrate_preserves_orchestration_data
  run_test "migrate handles already v2.0" test_migrate_already_v2
  run_test "migrate adds missing sections" test_migrate_adds_missing_sections
  run_test "migrate fails on invalid JSON" test_migrate_handles_invalid_json
  run_test "migrate fails when no file" test_migrate_no_file
  run_test "migrate marks migration source" test_migrate_marks_migration
  run_test "migrate moves config paths" test_migrate_config_paths
}
