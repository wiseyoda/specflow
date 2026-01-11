# Tech Stack

> Approved technologies and versions for SpecKit.

**Last Updated**: 2026-01-10
**Constitution Alignment**: Principles II (POSIX-Compliant Bash), III (CLI Over Direct Edits)

---

## Core Technologies

### Shell & Scripting
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Bash | 3.2+ | Shell scripting | POSIX-compliant, macOS default |
| jq | 1.6+ | JSON processing | Required dependency |
| git | 2.x | Version control | Required dependency |

### Validation
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| shellcheck | Latest | Script linting | All scripts must pass |
| bash -n | Built-in | Syntax check | Pre-commit validation |

### Testing
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| bash | 3.2+ | Test runner | Custom test-runner.sh |
| assert functions | Custom | Assertions | In test-runner.sh |

---

## File Conventions

- **Scripts**: `scripts/bash/speckit-*.sh`
- **Libraries**: `scripts/bash/lib/*.sh`
- **Templates**: `templates/*.md`, `templates/*.yaml`
- **Commands**: `commands/speckit.*.md`

---

## External Dependencies

| Dependency | Required | Check Command | Install |
|------------|----------|---------------|---------|
| jq | Yes | `jq --version` | `brew install jq` / `apt install jq` |
| git | Yes | `git --version` | System package manager |
| uuidgen | Optional | `uuidgen --version` | Usually pre-installed |

---

## Banned Patterns

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| Non-POSIX bash features | Portability | Use POSIX-compliant syntax |
| Direct JSON file edits | Consistency | Use `speckit state set` CLI |
| Hardcoded paths | Portability | Use `get_*` functions from common.sh |
| Silent failures | Debuggability | Always log errors with context |

---

## Adding New Technologies

Before adding a new dependency:
1. Check constitution alignment (POSIX compliance, CLI patterns)
2. Verify it works on both macOS and Linux
3. Add fallback if dependency is optional
4. Document in this file with rationale
