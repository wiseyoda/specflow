#!/usr/bin/env bash
#
# Test Suite: Template Operations
#
# Tests for specflow templates commands:
#   - check, update, update-all, diff, list, copy
#

# =============================================================================
# Test Setup
# =============================================================================

# Create mock system templates for testing
setup_mock_templates() {
  local system_dir="${HOME}/.claude/specflow-system/templates"
  mkdir -p "$system_dir"

  # Create a versioned template
  cat > "${system_dir}/spec-template.md" << 'EOF'
---
version: '1.5'
---
# Spec Template
EOF

  cat > "${system_dir}/plan-template.md" << 'EOF'
---
version: '2.0'
---
# Plan Template
EOF
}

# =============================================================================
# Test Functions
# =============================================================================

test_templates_list() {
  git init -q .
  setup_mock_templates

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" list 2>&1)

  assert_contains "$output" "spec-template.md" "Lists spec template"
  assert_contains "$output" "plan-template.md" "Lists plan template"
}

test_templates_list_json() {
  git init -q .
  setup_mock_templates

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" list --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"file"' "Has file key"
  assert_contains "$output" '"version"' "Has version key"
}

test_templates_check() {
  git init -q .
  setup_mock_templates

  # Create project templates directory with older version
  mkdir -p .specify/templates
  cat > .specify/templates/spec-template.md << 'EOF'
---
version: '1.0'
---
# Old Spec Template
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" check 2>&1)

  assert_contains "$output" "spec-template.md" "Shows spec template"
}

test_templates_check_json() {
  git init -q .
  setup_mock_templates

  mkdir -p .specify/templates
  cat > .specify/templates/spec-template.md << 'EOF'
---
version: '1.0'
---
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" check --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"

  assert_contains "$output" '"templates"' "Has templates key"
  assert_contains "$output" '"outdated"' "Has outdated count"
}

test_templates_copy() {
  git init -q .
  setup_mock_templates

  # Copy a template
  bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" copy spec-template.md

  assert_file_exists ".specify/templates/spec-template.md" "Template copied"
}

test_templates_update() {
  git init -q .
  setup_mock_templates

  # Create older project template
  mkdir -p .specify/templates
  cat > .specify/templates/spec-template.md << 'EOF'
---
version: '1.0'
---
# Old version
EOF

  # Update the template
  bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" update spec-template.md --no-backup

  # Check new version
  local content
  content=$(cat .specify/templates/spec-template.md)
  assert_contains "$content" "1.5" "Template updated to new version"
}

test_templates_update_creates_backup() {
  git init -q .
  setup_mock_templates

  mkdir -p .specify/templates
  echo "old content" > .specify/templates/spec-template.md

  # Update without --no-backup
  bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" update spec-template.md

  # Check backup was created
  local backup_count
  backup_count=$(ls -1 .specify/templates/spec-template.md.bak.* 2>/dev/null | wc -l | tr -d ' ')
  [[ "$backup_count" -gt 0 ]]
  assert_equals "0" "$?" "Backup file created"
}

test_templates_diff_requires_both_files() {
  git init -q .
  setup_mock_templates

  # No project template exists
  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-templates.sh diff spec-template.md" "Fails when project template missing"
}

test_templates_diff_shows_differences() {
  git init -q .
  setup_mock_templates

  mkdir -p .specify/templates
  cat > .specify/templates/spec-template.md << 'EOF'
---
version: '1.0'
---
# Different content
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" diff spec-template.md 2>&1)

  # Output format: "System: 1.5, Project: 1.0"
  assert_contains "$output" "System:" "Shows system version"
  assert_contains "$output" "Project:" "Shows project version"
}

test_templates_invalid_command() {
  git init -q .

  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/specflow-templates.sh invalid" "Fails on invalid command"
}

test_templates_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-templates.sh" --help)

  assert_contains "$output" "templates" "Help shows command name"
  assert_contains "$output" "check" "Help shows check command"
  assert_contains "$output" "update" "Help shows update command"
  assert_contains "$output" "list" "Help shows list command"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "templates list shows available templates" test_templates_list
  run_test "templates list --json outputs valid JSON" test_templates_list_json
  run_test "templates check shows template status" test_templates_check
  run_test "templates check --json outputs valid JSON" test_templates_check_json
  run_test "templates copy copies template to project" test_templates_copy
  run_test "templates update updates template" test_templates_update
  run_test "templates update creates backup" test_templates_update_creates_backup
  run_test "templates diff requires both files" test_templates_diff_requires_both_files
  run_test "templates diff shows differences" test_templates_diff_shows_differences
  run_test "templates rejects invalid command" test_templates_invalid_command
  run_test "templates --help shows usage" test_templates_help
}
