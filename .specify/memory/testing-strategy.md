# Testing Strategy

> Bash and TypeScript test frameworks, patterns, and coverage approach for SpecFlow.

**Last Updated**: 2026-01-18
**Constitution Alignment**: Principles II (POSIX-Compliant), IIa (TypeScript), V (Helpful Errors)

---

# Bash Test Framework

> Custom bash testing for `scripts/bash/` and legacy commands.

---

## Framework Overview

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

## Adding New Bash Tests

1. Create `tests/test-<command>.sh`
2. Source test runner utilities
3. Implement `run_tests()` function
4. Add `test_<scenario>()` functions
5. Use assertions from library
6. Run with `./tests/test-runner.sh <command>`

---

# TypeScript Test Framework

> Vitest testing for `packages/cli/` TypeScript commands.

---

## Framework Overview

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Runner | `pnpm --filter @specflow/cli test` |
| Discovery | `*.test.ts` files in `packages/cli/tests/` |
| Isolation | memfs for file system mocking |
| Coverage | `pnpm --filter @specflow/cli test:coverage` |

---

## Directory Structure

```
packages/cli/tests/
├── commands/              # Command tests
│   ├── status.test.ts
│   ├── next.test.ts
│   ├── mark.test.ts
│   ├── check.test.ts
│   └── phase/
│       ├── open.test.ts
│       └── close.test.ts
├── lib/                   # Library tests
│   ├── tasks.test.ts
│   ├── roadmap.test.ts
│   ├── checklist.test.ts
│   └── context.test.ts
└── fixtures/              # Test data
    ├── tasks.md
    └── ROADMAP.md
```

---

## Running Tests

```bash
# All tests
pnpm --filter @specflow/cli test

# Watch mode
pnpm --filter @specflow/cli test:watch

# Specific file
pnpm --filter @specflow/cli test status

# With coverage
pnpm --filter @specflow/cli test:coverage
```

---

## Test Structure Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';

// Mock fs with memfs
vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

describe('command', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should handle happy path', async () => {
    // Setup
    vol.fromJSON({
      '/project/tasks.md': '- [ ] T001 Task one',
    });

    // Execute
    const result = await execute({ json: true });

    // Assert
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('T001');
  });

  it('should handle error case', async () => {
    vol.fromJSON({}); // No tasks file

    await expect(execute({})).rejects.toThrow('No tasks.md found');
  });
});
```

---

## Assertion Patterns

```typescript
// Structure assertions
expect(result).toMatchObject({
  phase: { number: '0080' },
  progress: { percentage: expect.any(Number) },
});

// Array assertions
expect(result.tasks).toHaveLength(5);
expect(result.tasks).toContainEqual(
  expect.objectContaining({ id: 'T001' }),
);

// Error assertions
await expect(execute()).rejects.toThrow('Expected error');
await expect(execute()).rejects.toMatchObject({
  code: 'TASKS_NOT_FOUND',
});
```

---

## Fixture Patterns

### Inline Fixtures (memfs)

```typescript
vol.fromJSON({
  '/project/tasks.md': `
- [ ] T001 First task
- [x] T002 Completed task
- [ ] T003 Blocked task [BLOCKED: waiting on T001]
  `.trim(),
  '/project/ROADMAP.md': `
| Phase | Name | Status |
|-------|------|--------|
| 0080 | test | 🔄 |
  `.trim(),
});
```

### External Fixtures

```typescript
import { readFixture } from './helpers.js';

const tasksContent = readFixture('tasks-with-dependencies.md');
vol.fromJSON({ '/project/tasks.md': tasksContent });
```

---

## Coverage Approach

### Tested (High Coverage)

- Command execution (status, next, mark, check, phase)
- JSON output schemas
- File parsing (tasks.md, ROADMAP.md, checklists)
- Error handling with context

### Medium Coverage

- Edge cases (empty files, malformed markdown)
- State transitions
- Multi-file operations

### Not Tested

- Actual file system operations (mocked with memfs)
- Git operations (mocked)
- External process calls

---

## Adding New TypeScript Tests

1. Create `packages/cli/tests/<area>/<name>.test.ts`
2. Import test utilities and memfs
3. Mock file system with `vol.fromJSON()`
4. Write describe/it blocks with clear names
5. Run with `pnpm --filter @specflow/cli test <name>`
6. Verify coverage with `test:coverage`
