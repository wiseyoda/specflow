#!/usr/bin/env bash
#
# Test Suite: Detection
#
# Tests for speckit detect command:
#   - System detection
#   - SpecKit artifacts detection
#   - Existing documentation detection
#   - Key files detection
#   - State format detection
#

# =============================================================================
# Test Functions
# =============================================================================

test_detect_system() {
  git init -q .

  # Run system detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check system 2>&1)

  # Should show jq status
  assert_contains "$output" "jq" "Detects jq"

  # Should show git status
  assert_contains "$output" "git" "Detects git"
}

test_detect_empty_project() {
  git init -q .

  # Run detection on empty project
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check speckit 2>&1)

  # Should show .specify is missing
  assert_contains "$output" ".specify" "Reports on .specify status"
}

test_detect_speckit_artifacts() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run SpecKit detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check speckit 2>&1)

  # Should find .specify
  assert_contains "$output" ".specify/ directory exists" "Finds .specify directory"

  # Should find state file
  assert_contains "$output" "State file" "Finds state file"
}

test_detect_existing_docs() {
  git init -q .

  # Create various doc patterns
  mkdir -p docs/adr
  echo "# Test" > docs/README.md
  echo "# ADR 001" > docs/adr/001-test.md

  # Run docs detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check docs 2>&1)

  # Should find docs/
  assert_contains "$output" "docs/" "Finds docs directory"

  # Should find ADR
  assert_contains "$output" "ADR" "Finds ADR pattern"
}

test_detect_github_patterns() {
  git init -q .

  # Create GitHub patterns
  mkdir -p .github/workflows
  mkdir -p .github/ISSUE_TEMPLATE
  echo "# PR Template" > .github/PULL_REQUEST_TEMPLATE.md

  # Run docs detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check docs 2>&1)

  # Should find .github patterns
  assert_contains "$output" ".github" "Finds .github directory"
}

test_detect_key_files() {
  git init -q .

  # Create key files
  echo "# Claude Instructions" > CLAUDE.md
  echo "# Roadmap" > ROADMAP.md
  echo "# Readme" > README.md

  # Run files detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check files 2>&1)

  # Should find each file
  assert_contains "$output" "CLAUDE.md" "Finds CLAUDE.md"
  assert_contains "$output" "ROADMAP.md" "Finds ROADMAP.md"
  assert_contains "$output" "README.md" "Finds README.md"
}

test_detect_claude_md_content() {
  git init -q .

  # Create non-SpecKit CLAUDE.md
  echo "# My Custom Instructions" > CLAUDE.md

  # Run files detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check files 2>&1)

  # Should warn about custom content
  assert_contains "$output" "Custom content" "Detects non-SpecKit CLAUDE.md"
}

test_detect_state_version() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"

  # Run state detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check state 2>&1)

  # Should show version
  assert_contains "$output" "Version" "Shows state version"
  assert_contains "$output" "2.0" "Shows correct version"
}

test_detect_old_state_format() {
  git init -q .
  mkdir -p .specify

  # Create v1.0 format state
  cat > .specify/orchestration-state.json << 'EOF'
{
  "version": "1.0",
  "project": {
    "roadmap_path": "ROADMAP.md",
    "name": "OldProject"
  }
}
EOF

  # Run state detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check state 2>&1)

  # Should detect old version and suggest migration
  assert_contains "$output" "1.0" "Detects v1.0 format"
  assert_contains "$output" "migration" "Suggests migration"
}

test_detect_openapi() {
  git init -q .

  # Create OpenAPI file
  echo "openapi: 3.0.0" > openapi.yaml

  # Run docs detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check docs 2>&1)

  # Should find API spec
  assert_contains "$output" "API specification" "Finds OpenAPI file"
}

test_detect_json_output() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  # Run with JSON output
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" --check speckit --json 2>&1)

  # Extract JSON block (from { to })
  local json_block
  json_block=$(echo "$output" | sed -n '/^{/,/^}/p')

  # Should be valid JSON
  if echo "$json_block" | jq '.' >/dev/null 2>&1; then
    return 0
  else
    echo "Failed to parse JSON:"
    echo "$json_block"
    return 1
  fi
}

test_detect_all() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh"
  mkdir -p docs
  echo "# Docs" > docs/index.md
  echo "# Claude" > CLAUDE.md

  # Run full detection
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-detect.sh" 2>&1)

  # Should include all sections
  assert_contains "$output" "System Installation" "Includes system section"
  assert_contains "$output" "SpecKit Artifacts" "Includes speckit section"
  assert_contains "$output" "Existing Documentation" "Includes docs section"
  assert_contains "$output" "Key Files" "Includes files section"
  assert_contains "$output" "Summary" "Includes summary"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "detect system shows dependencies" test_detect_system
  run_test "detect handles empty project" test_detect_empty_project
  run_test "detect finds SpecKit artifacts" test_detect_speckit_artifacts
  run_test "detect finds existing docs" test_detect_existing_docs
  run_test "detect finds GitHub patterns" test_detect_github_patterns
  run_test "detect finds key files" test_detect_key_files
  run_test "detect identifies custom CLAUDE.md" test_detect_claude_md_content
  run_test "detect shows state version" test_detect_state_version
  run_test "detect identifies old state format" test_detect_old_state_format
  run_test "detect finds OpenAPI files" test_detect_openapi
  run_test "detect supports JSON output" test_detect_json_output
  run_test "detect all runs complete scan" test_detect_all
}
