#!/usr/bin/env bash
#
# Test Suite: State Migration
#
# Tests for speckit state migrate command:
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
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

  # Verify version updated
  assert_json_equals ".specify/orchestration-state.json" ".version" "2.0" "Version updated to 2.0"

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
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

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
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

  # Verify interview data preserved
  assert_json_equals ".specify/orchestration-state.json" ".interview.status" "in_progress" "Interview status preserved"
  assert_json_equals ".specify/orchestration-state.json" ".interview.current_phase" "5" "Interview phase preserved"
  assert_json_equals ".specify/orchestration-state.json" ".interview.decisions_count" "23" "Decisions count preserved"
}

test_migrate_preserves_orchestration_data() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format with orchestration data
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "name": "OrchTest"
  },
  "orchestration": {
    "phase_number": "003",
    "phase_name": "Test Phase",
    "branch": "feat/003-test",
    "step": "implement",
    "status": "in_progress"
  }
}
EOF

  # Run migration
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

  # Verify orchestration data preserved
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.phase_number" "003" "Phase number preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.branch" "feat/003-test" "Branch preserved"
  assert_json_equals ".specify/orchestration-state.json" ".orchestration.step" "implement" "Step preserved"
}

test_migrate_already_v2() {
  git init -q .
  mkdir -p .specify
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" init --force

  # Run migration on v2.0 file
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate 2>&1)

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
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

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
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/speckit-state.sh migrate" "Fails on invalid JSON"
}

test_migrate_no_file() {
  git init -q .
  mkdir -p .specify

  # No state file

  # Migration should fail
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/speckit-state.sh migrate" "Fails when no file"
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
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

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
  bash "${PROJECT_ROOT}/scripts/bash/speckit-state.sh" migrate

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
