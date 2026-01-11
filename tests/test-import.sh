#!/usr/bin/env bash
#
# Test Suite: Import
#
# Tests for speckit import command:
#   - ADR import
#   - Dry run mode
#   - Index generation
#

# =============================================================================
# Test Functions
# =============================================================================

test_import_adrs_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" --help 2>&1)

  assert_contains "$output" "speckit import" "Shows command name"
  assert_contains "$output" "adrs" "Shows adrs type"
  assert_contains "$output" "--dry-run" "Shows dry-run option"
}

test_import_adrs_missing_path() {
  git init -q .

  # Missing path argument
  local exit_code=0
  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs 2>&1 || exit_code=$?

  assert_equals "1" "$exit_code" "Fails with missing path"
}

test_import_adrs_nonexistent_path() {
  git init -q .

  # Non-existent path
  local output
  local exit_code=0
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs /nonexistent/path 2>&1) || exit_code=$?

  assert_equals "1" "$exit_code" "Fails with non-existent path"
  assert_contains "$output" "not found" "Reports path not found"
}

test_import_adrs_no_adr_files() {
  git init -q .
  mkdir -p docs/adr
  # Empty directory, no ADR files

  local output
  local exit_code=0
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr 2>&1) || exit_code=$?

  assert_equals "1" "$exit_code" "Fails with no ADR files"
  assert_contains "$output" "No ADR files" "Reports no ADR files"
}

test_import_adrs_dry_run() {
  git init -q .
  mkdir -p docs/adr
  echo "# Use React" > docs/adr/001-use-react.md
  echo "# Use TypeScript" > docs/adr/002-use-typescript.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr --dry-run 2>&1)

  assert_contains "$output" "DRY RUN" "Shows dry run message"
  assert_contains "$output" "001-use-react.md" "Lists first file"
  assert_contains "$output" "002-use-typescript.md" "Lists second file"

  # Should NOT create directory
  [[ ! -d ".specify/memory/adrs" ]]
  assert_equals "0" "$?" "Does not create directory in dry run"
}

test_import_adrs_creates_directory() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p docs/adr
  echo "# Use React" > docs/adr/001-use-react.md

  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr >/dev/null 2>&1

  assert_dir_exists ".specify/memory/adrs" "Creates adrs directory"
}

test_import_adrs_copies_files() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p docs/adr
  echo "# Use React" > docs/adr/001-use-react.md
  echo "# Use TypeScript" > docs/adr/002-use-typescript.md

  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr >/dev/null 2>&1

  assert_file_exists ".specify/memory/adrs/001-use-react.md" "Copies first ADR"
  assert_file_exists ".specify/memory/adrs/002-use-typescript.md" "Copies second ADR"
}

test_import_adrs_creates_index() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p docs/adr
  echo "# Use React" > docs/adr/001-use-react.md

  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr >/dev/null 2>&1

  assert_file_exists ".specify/memory/adr-index.md" "Creates adr-index.md"

  # Check index content
  local content
  content=$(cat .specify/memory/adr-index.md)
  assert_contains "$content" "Architecture Decision Records" "Index has title"
  assert_contains "$content" "docs/adr" "Index shows source"
  assert_contains "$content" "Use React" "Index has ADR title"
}

test_import_adrs_extracts_status() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p docs/adr
  cat > docs/adr/001-use-react.md << 'EOF'
# Use React for Frontend

Status: Accepted

## Context
We need a frontend framework.

## Decision
Use React.
EOF

  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr >/dev/null 2>&1

  local content
  content=$(cat .specify/memory/adr-index.md)
  assert_contains "$content" "Accepted" "Index shows status"
}

test_import_adrs_handles_different_patterns() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p adr
  echo "# Decision 1" > adr/001-decision.md
  echo "# Decision 2" > adr/ADR-002-another.md
  echo "# Decision 3" > adr/0003-four-digit.md

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs adr 2>&1)

  assert_contains "$output" "3 ADR" "Imports all ADR patterns"
}

test_import_adrs_force_overwrites() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p docs/adr
  echo "# Original" > docs/adr/001-decision.md

  # First import
  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr >/dev/null 2>&1

  # Modify source
  echo "# Modified" > docs/adr/001-decision.md

  # Second import with force
  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr --force >/dev/null 2>&1

  local content
  content=$(cat .specify/memory/adrs/001-decision.md)
  assert_contains "$content" "Modified" "Force overwrites existing"
}

test_import_preserves_original() {
  git init -q .
  bash "${PROJECT_ROOT}/scripts/bash/speckit-scaffold.sh" >/dev/null 2>&1

  mkdir -p docs/adr
  echo "# Original Content" > docs/adr/001-decision.md

  bash "${PROJECT_ROOT}/scripts/bash/speckit-import.sh" adrs docs/adr >/dev/null 2>&1

  # Original file should still exist
  assert_file_exists "docs/adr/001-decision.md" "Original file preserved"

  local content
  content=$(cat docs/adr/001-decision.md)
  assert_contains "$content" "Original Content" "Original content unchanged"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "import --help shows usage" test_import_adrs_help
  run_test "import fails with missing path" test_import_adrs_missing_path
  run_test "import fails with non-existent path" test_import_adrs_nonexistent_path
  run_test "import fails with no ADR files" test_import_adrs_no_adr_files
  run_test "import --dry-run shows preview" test_import_adrs_dry_run
  run_test "import creates adrs directory" test_import_adrs_creates_directory
  run_test "import copies ADR files" test_import_adrs_copies_files
  run_test "import creates adr-index.md" test_import_adrs_creates_index
  run_test "import extracts status from ADR" test_import_adrs_extracts_status
  run_test "import handles different ADR patterns" test_import_adrs_handles_different_patterns
  run_test "import --force overwrites existing" test_import_adrs_force_overwrites
  run_test "import preserves original files" test_import_preserves_original
}
