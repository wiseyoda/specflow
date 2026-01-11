# Research: Project Type Detection Patterns

**Phase**: 0020 - Onboarding Polish
**Date**: 2026-01-10

## Language Detection Markers

### TypeScript
| Marker | Confidence | Notes |
|--------|------------|-------|
| tsconfig.json | High | Definitive TypeScript indicator |
| tsconfig.*.json | High | Extended configs (tsconfig.build.json) |
| *.ts files in src/ | Medium | Could be other TS-like languages |

### JavaScript/Node.js
| Marker | Confidence | Notes |
|--------|------------|-------|
| package.json (no tsconfig) | High | Node project without TypeScript |
| .nvmrc | Medium | Indicates Node version management |
| .npmrc | Low | Could be for any npm usage |

### Rust
| Marker | Confidence | Notes |
|--------|------------|-------|
| Cargo.toml | High | Definitive Rust indicator |
| Cargo.lock | High | Rust project with locked deps |
| .cargo/ directory | Medium | Cargo config directory |

### Go
| Marker | Confidence | Notes |
|--------|------------|-------|
| go.mod | High | Go modules (Go 1.11+) |
| go.sum | High | Go dependency checksums |
| *.go files in root | Medium | Older Go without modules |

### Python
| Marker | Confidence | Notes |
|--------|------------|-------|
| pyproject.toml | High | Modern Python config |
| requirements.txt | High | pip dependencies |
| setup.py | Medium | Legacy Python packaging |
| Pipfile | Medium | Pipenv usage |
| poetry.lock | High | Poetry package manager |

### Bash/Shell
| Marker | Confidence | Notes |
|--------|------------|-------|
| *.sh files in root | Medium | Shell scripts |
| bin/ with executables | Low | Could be any language |
| Makefile only | Low | Build system, not language |

## Detection Algorithm

```bash
detect_project_type() {
  local root="${1:-.}"

  # Priority order: most specific first
  if [[ -f "${root}/tsconfig.json" ]]; then
    echo "typescript"
  elif [[ -f "${root}/package.json" ]]; then
    echo "javascript"
  elif [[ -f "${root}/Cargo.toml" ]]; then
    echo "rust"
  elif [[ -f "${root}/go.mod" ]]; then
    echo "go"
  elif [[ -f "${root}/pyproject.toml" ]] || [[ -f "${root}/requirements.txt" ]]; then
    echo "python"
  elif ls "${root}"/*.sh 1>/dev/null 2>&1; then
    echo "bash"
  else
    echo "generic"
  fi
}
```

## Template Sections by Language

### Constitution.md Differences

| Section | TypeScript | Python | Rust | Go | Bash |
|---------|------------|--------|------|-----|------|
| Language principle | TypeScript with strict mode | Type hints, Python 3.10+ | Safe Rust, no unsafe | Idiomatic Go | POSIX-compliant |
| Test framework | Vitest/Jest | pytest | cargo test | go test | bash assertions |
| Linter | ESLint, Prettier | ruff, mypy | clippy | golangci-lint | shellcheck |
| Package manager | pnpm/npm | uv/pip | cargo | go mod | N/A |

### Tech-stack.md Differences

| Section | TypeScript | Python | Rust | Go | Bash |
|---------|------------|--------|------|-----|------|
| Core tech | Node.js, TypeScript | Python 3.x | Rust stable | Go 1.x | Bash 3.2+ |
| Testing | Vitest, Testing Library | pytest, pytest-cov | cargo test | go test | Custom runner |
| Formatting | Prettier | ruff format | rustfmt | gofmt | N/A |
| Validation | ESLint, tsc | mypy, ruff | clippy, rustc | go vet | shellcheck |

## POSIX Compatibility Notes

For detection script:
- Use `[[ ]]` for tests (available in bash 3.2)
- Use `ls ... 1>/dev/null 2>&1` for glob checks (POSIX)
- Avoid `compgen` (bash 4.0+)
- Avoid arrays except indexed arrays (bash 3.2 supports)
- Use `find` instead of `**` globs (bash 4.0+)

## References

- Node.js project detection: https://docs.npmjs.com/cli/v10/configuring-npm/package-json
- Cargo manifest: https://doc.rust-lang.org/cargo/reference/manifest.html
- Go modules: https://go.dev/doc/modules/gomod-ref
- Python packaging: https://packaging.python.org/en/latest/specifications/
