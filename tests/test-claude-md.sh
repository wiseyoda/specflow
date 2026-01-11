#!/usr/bin/env bash
#
# Test Suite: CLAUDE.md Operations
#
# Tests for speckit claude-md commands:
#   - update, sync, init, merge, show, path
#

# =============================================================================
# Test Functions
# =============================================================================

test_claude_md_path() {
  git init -q .

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" path)

  assert_contains "$output" "CLAUDE.md" "Returns CLAUDE.md path"
}

test_claude_md_init() {
  git init -q .

  # Create minimal CLAUDE.md
  cat > CLAUDE.md << 'EOF'
# Project CLAUDE.md

## Overview
This is a test project.
EOF

  # Initialize Recent Changes section
  echo "y" | bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" init

  local content
  content=$(cat CLAUDE.md)
  assert_contains "$content" "Recent Changes" "Has Recent Changes section"
}

test_claude_md_update() {
  git init -q .

  # Create CLAUDE.md with Recent Changes
  cat > CLAUDE.md << 'EOF'
# Project

## Recent Changes

- **2024-01-01**: Initial commit

## Overview
EOF

  # Add a new entry
  bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" update "Added new feature"

  local content
  content=$(cat CLAUDE.md)
  assert_contains "$content" "Added new feature" "Entry was added"
}

test_claude_md_update_creates_section() {
  git init -q .

  # Create CLAUDE.md WITHOUT Recent Changes
  cat > CLAUDE.md << 'EOF'
# Project

## Overview
Project description.
EOF

  # Update should create section
  bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" update "First entry"

  local content
  content=$(cat CLAUDE.md)
  assert_contains "$content" "Recent Changes" "Section was created"
  assert_contains "$content" "First entry" "Entry was added"
}

test_claude_md_show() {
  git init -q .

  cat > CLAUDE.md << 'EOF'
# Project

## Recent Changes

- **2024-01-01**: Entry one
- **2024-01-02**: Entry two

## Overview
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" show 2>&1)

  assert_contains "$output" "Entry one" "Shows first entry"
  assert_contains "$output" "Entry two" "Shows second entry"
}

test_claude_md_show_json() {
  git init -q .

  cat > CLAUDE.md << 'EOF'
# Project

## Recent Changes

- **2024-01-01**: Entry one

## Overview
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" show --json)

  echo "$output" | jq '.' >/dev/null 2>&1
  assert_equals "0" "$?" "JSON output is valid"
}

test_claude_md_sync() {
  git init -q .

  # Create CLAUDE.md
  cat > CLAUDE.md << 'EOF'
# Project

## Recent Changes

- **2024-01-01**: Initial

## Overview
EOF

  # Create ROADMAP.md with completed phase
  cat > ROADMAP.md << 'EOF'
# Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 001 | Project Setup | ✅ |
| 002 | Core Engine | In Progress |
EOF

  bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" sync

  local content
  content=$(cat CLAUDE.md)
  assert_contains "$content" "001" "Synced phase 001"
}

test_claude_md_merge_dry_run() {
  git init -q .

  # Create existing CLAUDE.md without SpecKit sections
  cat > CLAUDE.md << 'EOF'
# Project Name

## Getting Started
How to get started.

## Contributing
How to contribute.
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" merge --dry-run 2>&1)

  assert_contains "$output" "DRY RUN" "Shows dry run message"
  assert_contains "$output" "Would add" "Shows what would be added"
}

test_claude_md_merge() {
  git init -q .

  # Create existing CLAUDE.md
  cat > CLAUDE.md << 'EOF'
# Project

## Getting Started
Existing content.
EOF

  # Merge SpecKit sections
  bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" merge

  local content
  content=$(cat CLAUDE.md)

  # Check backup was created
  local backup_count
  backup_count=$(ls -1 CLAUDE.md.backup.* 2>/dev/null | wc -l | tr -d ' ')
  [[ "$backup_count" -gt 0 ]]
  assert_equals "0" "$?" "Backup was created"

  assert_contains "$content" "Recent Changes" "Has Recent Changes"
  assert_contains "$content" "Getting Started" "Preserves existing content"
}

test_claude_md_merge_already_present() {
  git init -q .

  # Create CLAUDE.md with SpecKit sections already
  cat > CLAUDE.md << 'EOF'
# Project

## Recent Changes
- Entry

## SpecKit Configuration
Config here

## Development Workflow
Workflow here
EOF

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" merge 2>&1)

  assert_contains "$output" "already present" "Shows already present message"
}

test_claude_md_requires_file() {
  git init -q .
  # Don't create CLAUDE.md

  assert_command_fails "bash ${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh show" "Fails without CLAUDE.md"
}

test_claude_md_help() {
  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/speckit-claude-md.sh" --help)

  assert_contains "$output" "claude-md" "Help shows command name"
  assert_contains "$output" "update" "Help shows update command"
  assert_contains "$output" "sync" "Help shows sync command"
  assert_contains "$output" "merge" "Help shows merge command"
}

# =============================================================================
# Run Tests
# =============================================================================

run_tests() {
  run_test "claude-md path returns CLAUDE.md path" test_claude_md_path
  run_test "claude-md init creates Recent Changes section" test_claude_md_init
  run_test "claude-md update adds entry" test_claude_md_update
  run_test "claude-md update creates section if missing" test_claude_md_update_creates_section
  run_test "claude-md show displays entries" test_claude_md_show
  run_test "claude-md show --json outputs valid JSON" test_claude_md_show_json
  run_test "claude-md sync imports from ROADMAP" test_claude_md_sync
  run_test "claude-md merge --dry-run previews changes" test_claude_md_merge_dry_run
  run_test "claude-md merge adds SpecKit sections" test_claude_md_merge
  run_test "claude-md merge handles already present sections" test_claude_md_merge_already_present
  run_test "claude-md requires CLAUDE.md file" test_claude_md_requires_file
  run_test "claude-md --help shows usage" test_claude_md_help
}
