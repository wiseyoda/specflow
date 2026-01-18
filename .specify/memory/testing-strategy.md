# Testing Strategy

> Custom bash test framework, patterns, and coverage approach for SpecFlow.

**Last Updated**: 2026-01-11
**Constitution Alignment**: Principles II (POSIX-Compliant), V (Helpful Errors)

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Custom bash (no external deps) |
| Runner | `tests/test-runner.sh` |
| Discovery | `test-*.sh` files in `/tests/` |
| Isolation | Per-test temp directories |
| Total tests | ~150 across 18 suites |

---

## Directory Structure

```
tests/
├── test-runner.sh        # Framework & orchestrator
├── test-<command>.sh     # Individual test suites
└── fixtures/             # Test data
    ├── roadmap-v2.0.md
    └── roadmap-v2.1.md
```

---

## Running Tests

```bash
# All tests
./tests/test-runner.sh

# Specific suite
./tests/test-runner.sh state

# Multiple suites
./tests/test-runner.sh state git roadmap

# Verbose mode
./tests/test-runner.sh --verbose

# List available suites
./tests/test-runner.sh --list
```

---

## Assertion Library

| Assertion | Purpose |
|-----------|---------|
| `assert_equals "$expected" "$actual" "msg"` | String equality |
| `assert_contains "$haystack" "$needle" "msg"` | Substring match |
| `assert_matches "$string" "$regex" "msg"` | Regex pattern |
| `assert_file_exists "$path" "msg"` | File existence |
| `assert_dir_exists "$path" "msg"` | Directory existence |
| `assert_command_succeeds "$cmd" "msg"` | Exit code 0 |
| `assert_command_fails "$cmd" "msg"` | Non-zero exit |
| `assert_json_valid "$file" "msg"` | JSON validity |
| `assert_json_equals "$file" ".key" "$val" "msg"` | JSON value |

---

## Test Structure Pattern

```bash
# Test file: test-<command>.sh

setup_test_env() {
  TEST_TEMP_DIR=$(mktemp -d)
  export TEST_TEMP_DIR PROJECT_ROOT
  source "${PROJECT_ROOT}/scripts/bash/lib/common.sh"
}

cleanup_test_env() {
  rm -rf "$TEST_TEMP_DIR"
}

test_command_scenario() {
  git init -q .
  # Setup test data...

  local output
  output=$(bash "${PROJECT_ROOT}/scripts/bash/specflow-command.sh" action)

  assert_contains "$output" "expected" "Should contain expected"
}

run_tests() {
  run_test "description" test_command_scenario
  run_test "another test" another_function
}
```

---

## Test Naming Conventions

| Pattern | Example |
|---------|---------|
| Test file | `test-<command>.sh` |
| Test function | `test_<command>_<scenario>()` |
| Fixture | Descriptive name in `fixtures/` |

---

## Coverage Approach

### Tested (High Coverage)
- Happy paths (create, init, update)
- Error cases (missing files, invalid JSON)
- JSON output mode (`--json` flag)
- CLI flags and options

### Medium Coverage
- Edge cases (empty projects, invalid names)
- Integration (git, file I/O)

### Not Tested
- Network operations (N/A)
- External APIs (N/A)
- Interactive prompts (use stdin redirection)

---

## Test Isolation

Each test runs in:
- Fresh temp directory
- Isolated git repository
- Subshell context
- Clean environment via `SPECFLOW_PROJECT_ROOT`

```bash
# Per-test isolation
test_dir="${TEST_TEMP_DIR}/${test_name}"
mkdir -p "$test_dir"
(cd "$test_dir" && git init -q . && $test_fn)
```

---

## Fixture Patterns

### File Fixtures
Located in `tests/fixtures/`:
- `roadmap-v2.0.md` - v2.0 format sample
- `roadmap-v2.1.md` - v2.1 ABBC format

### Inline Fixtures
```bash
create_test_roadmap() {
  cat > ROADMAP.md << 'EOF'
# Project Roadmap
| Phase | Name | Status |
|-------|------|--------|
| 001 | Foundation | ✅ |
EOF
}
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Framework error |

---

## Required Dependencies

- `git` - For repository tests
- `jq` - For JSON assertions
- `bash` - POSIX-compliant shell
- `mktemp` - Temp directory creation

---

## Adding New Tests

1. Create `tests/test-<command>.sh`
2. Source test runner utilities
3. Implement `run_tests()` function
4. Add `test_<scenario>()` functions
5. Use assertions from library
6. Run with `./tests/test-runner.sh <command>`
