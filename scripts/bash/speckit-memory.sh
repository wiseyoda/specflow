#!/usr/bin/env bash
#
# speckit-memory.sh - Memory document operations
#
# Usage:
#   speckit memory init [document]     Initialize memory document(s)
#   speckit memory list                List memory documents and status
#   speckit memory check               Check memory document health
#   speckit memory path                Show memory directory path
#

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/json.sh"

# =============================================================================
# Constants
# =============================================================================

# Memory document definitions (name:filename:type:description)
# Note: Associative arrays require bash 4.0+, using simpler approach for compatibility
readonly MEMORY_DOC_CONSTITUTION="constitution.md:REQUIRED:Project principles and governance"
readonly MEMORY_DOC_TECH_STACK="tech-stack.md:RECOMMENDED:Approved technologies and versions"
readonly MEMORY_DOC_CODING_STANDARDS="coding-standards.md:RECOMMENDED:Code style and patterns"
readonly MEMORY_DOC_API_STANDARDS="api-standards.md:RECOMMENDED:API design patterns"
readonly MEMORY_DOC_SECURITY_CHECKLIST="security-checklist.md:RECOMMENDED:Security requirements"
readonly MEMORY_DOC_TESTING_STRATEGY="testing-strategy.md:RECOMMENDED:Test approach and coverage"
readonly MEMORY_DOC_GLOSSARY="glossary.md:OPTIONAL:Project terminology"

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << 'EOF'
speckit memory - Memory document operations

USAGE:
    speckit memory <command> [options]

COMMANDS:
    init [document]     Initialize memory document(s)
                        Documents: constitution, tech-stack, coding-standards,
                                   api-standards, security-checklist, testing-strategy,
                                   glossary, all, recommended
                        Examples:
                          speckit memory init constitution
                          speckit memory init recommended
                          speckit memory init all

    list                List all memory documents with status
                        Shows: exists, required/recommended, line count

    check               Check memory document health
                        Validates: constitution exists, format, cross-refs

    path                Show memory directory path

OPTIONS:
    --json              Output in JSON format
    --force             Overwrite existing documents (default: skip)
    --help              Show this help message

DOCUMENT TYPES:
    constitution        REQUIRED - Project principles and governance
    tech-stack          RECOMMENDED - Approved technologies and versions
    coding-standards    RECOMMENDED - Code style and patterns
    api-standards       RECOMMENDED - API design patterns
    security-checklist  RECOMMENDED - Security requirements
    testing-strategy    RECOMMENDED - Test approach and coverage
    glossary            OPTIONAL - Project terminology

EXAMPLES:
    speckit memory init constitution          # Create constitution only
    speckit memory init recommended           # Create all recommended docs
    speckit memory init all                   # Create all memory docs
    speckit memory init tech-stack --force    # Overwrite existing
    speckit memory list --json                # List docs in JSON format
EOF
}

# =============================================================================
# Template Content Generators
# =============================================================================

generate_constitution() {
  local project_name="${1:-Project}"
  cat << EOF
# ${project_name} Constitution

> Core principles and governance for the project. All implementation decisions must align with these principles.

**Version**: 1.0.0
**Created**: $(date +%Y-%m-%d)
**Status**: DRAFT

---

## Preamble

This constitution defines the fundamental principles guiding ${project_name} development.
All technical decisions, architectural choices, and implementation patterns must align with these principles.

---

## Core Principles

### I. User-First Design
All features prioritize user experience and accessibility.
- **Rationale**: Users are the ultimate judge of product value
- **Implications**: Performance budgets, accessibility requirements, intuitive interfaces

### II. Type Safety
Leverage TypeScript's type system for reliability.
- **Rationale**: Catch errors at compile time, improve developer experience
- **Implications**: Strict mode, no \`any\` types, typed APIs

### III. Simplicity Over Cleverness
Prefer readable, maintainable code over clever optimizations.
- **Rationale**: Code is read more often than written
- **Implications**: Clear naming, explicit over implicit, documented decisions

### IV. Test-First Development
Write tests before or alongside implementation.
- **Rationale**: Tests are documentation and safety nets
- **Implications**: TDD where appropriate, meaningful coverage targets

### V. Security by Default
Security is built-in, not bolted-on.
- **Rationale**: Vulnerabilities are expensive to fix after deployment
- **Implications**: Input validation, auth checks, security reviews

---

## Governance

### Decision Making
- **Architecture decisions**: Documented in ADRs
- **Technology additions**: Require constitution alignment check
- **Principle changes**: Require team consensus

### Enforcement
- **CI/CD gates**: Automated checks for type safety, tests, security
- **Code review**: Constitution alignment verified in reviews
- **Retrospectives**: Principle effectiveness reviewed periodically

---

## Amendment Process

To amend this constitution:
1. Propose change with rationale
2. Document impact on existing code/decisions
3. Obtain team consensus
4. Update version number and changelog

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | $(date +%Y-%m-%d) | Initial constitution |
EOF
}

generate_tech_stack() {
  cat << EOF
# Tech Stack

> Approved technologies and versions for the project.

**Last Updated**: $(date +%Y-%m-%d)
**Constitution Alignment**: Principles II (Type Safety), III (Simplicity)

---

## Core Technologies

### Runtime & Language
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Node.js | 20.x LTS | Runtime | Use latest LTS |
| TypeScript | 5.x | Language | Strict mode enabled |

### Framework
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Next.js | 14.x | Framework | App Router preferred |
| React | 18.x | UI Library | Server Components where applicable |

### Database & ORM
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| PostgreSQL | 15.x | Database | Primary data store |
| Drizzle ORM | Latest | ORM | Type-safe queries |

### Testing
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Vitest | Latest | Unit/Integration | Fast, ESM-native |
| Playwright | Latest | E2E | Cross-browser testing |

---

## Package Management

- **Package Manager**: pnpm (preferred for monorepos)
- **Lock File**: pnpm-lock.yaml (committed)
- **Node Version**: Specified in .nvmrc

---

## Banned Technologies

| Technology | Reason | Alternative |
|------------|--------|-------------|
| moment.js | Large bundle, deprecated | date-fns, dayjs |
| lodash (full) | Large bundle | Native methods, lodash-es cherry-pick |

---

## Adding New Technologies

Before adding a new package:
1. Check constitution alignment (especially Principles II, III)
2. Evaluate bundle size impact
3. Check maintenance status and community
4. Document in this file with rationale
EOF
}

generate_coding_standards() {
  cat << EOF
# Coding Standards

> Code style, patterns, and conventions for the project.

**Last Updated**: $(date +%Y-%m-%d)
**Constitution Alignment**: Principles II (Type Safety), III (Simplicity)

---

## File Organization

### Directory Structure
\`\`\`
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── ui/           # Primitive UI components
│   └── features/     # Feature-specific components
├── lib/              # Utilities and helpers
├── hooks/            # Custom React hooks
├── types/            # TypeScript type definitions
└── services/         # External service integrations
\`\`\`

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | \`UserProfile.tsx\` |
| Files (utilities) | camelCase | \`formatDate.ts\` |
| Files (types) | camelCase | \`user.types.ts\` |
| Directories | kebab-case | \`user-profile/\` |
| Components | PascalCase | \`UserProfile\` |
| Functions | camelCase | \`formatDate\` |
| Constants | UPPER_SNAKE | \`MAX_RETRIES\` |
| Types/Interfaces | PascalCase | \`UserProfile\` |

---

## TypeScript Conventions

### Type Definitions
- Use \`interface\` for objects that can be extended
- Use \`type\` for unions, intersections, primitives
- Export types from dedicated \`.types.ts\` files
- No \`any\` - use \`unknown\` and narrow

### Strict Mode
\`\`\`json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true
}
\`\`\`

---

## React Conventions

### Component Structure
1. Imports (external, internal, types)
2. Type definitions
3. Component function
4. Hooks
5. Event handlers
6. Render

### Hooks
- Custom hooks in \`src/hooks/\`
- Prefix with \`use\`
- Return typed objects, not arrays

---

## Error Handling

### Result Pattern (preferred)
\`\`\`typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
\`\`\`

### Error Boundaries
- Wrap feature sections with error boundaries
- Provide meaningful fallback UI
EOF
}

generate_api_standards() {
  cat << EOF
# API Standards

> API design patterns and conventions.

**Last Updated**: $(date +%Y-%m-%d)
**Constitution Alignment**: Principles I (User-First), V (Security)

---

## Response Format

### Success Response
\`\`\`json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid"
  }
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid"
  }
}
\`\`\`

---

## HTTP Methods

| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Read resource | Yes |
| POST | Create resource | No |
| PUT | Replace resource | Yes |
| PATCH | Update resource | Yes |
| DELETE | Remove resource | Yes |

---

## Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Unexpected errors |

---

## Validation

- Validate all input at API boundary
- Use Zod for runtime type validation
- Return specific error messages
- Never trust client-side validation alone

---

## Authentication

- Use Bearer tokens in Authorization header
- Short-lived access tokens (15 min)
- Refresh tokens for session management
- HTTPS only in production
EOF
}

generate_security_checklist() {
  cat << EOF
# Security Checklist

> Security requirements and verification points.

**Last Updated**: $(date +%Y-%m-%d)
**Constitution Alignment**: Principle V (Security by Default)

---

## Authentication & Authorization

- [ ] All routes require authentication unless explicitly public
- [ ] Password hashing uses bcrypt with cost factor >= 12
- [ ] Session tokens are cryptographically random
- [ ] Token expiration is enforced
- [ ] Failed login attempts are rate-limited
- [ ] Multi-factor authentication available for sensitive accounts

---

## Input Validation

- [ ] All user input is validated server-side
- [ ] SQL queries use parameterized statements
- [ ] HTML output is escaped to prevent XSS
- [ ] File uploads validate type and size
- [ ] JSON parsing has depth/size limits

---

## Data Protection

- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced in production
- [ ] PII access is logged
- [ ] Database backups are encrypted
- [ ] Secrets stored in environment variables, not code

---

## API Security

- [ ] CORS configured restrictively
- [ ] Rate limiting on all endpoints
- [ ] Request size limits enforced
- [ ] API keys rotated regularly
- [ ] Deprecated endpoints have sunset dates

---

## Infrastructure

- [ ] Dependencies scanned for vulnerabilities
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Error messages don't leak implementation details
- [ ] Logs don't contain sensitive data
- [ ] Production debug modes disabled

---

## Incident Response

- [ ] Security contact documented
- [ ] Incident response plan exists
- [ ] Audit logs retained for 90+ days
- [ ] Alerting configured for security events
EOF
}

generate_testing_strategy() {
  cat << EOF
# Testing Strategy

> Test approach, patterns, and coverage expectations.

**Last Updated**: $(date +%Y-%m-%d)
**Constitution Alignment**: Principle IV (Test-First Development)

---

## Testing Pyramid

### Unit Tests (70%)
- Pure functions, utilities
- Isolated component logic
- Business rules and validations

### Integration Tests (20%)
- Component with dependencies
- API endpoints
- Database operations

### E2E Tests (10%)
- Critical user journeys
- Cross-browser verification
- Production-like environment

---

## Coverage Targets

| Category | Target | Required |
|----------|--------|----------|
| Overall | 80% | 70% |
| Critical paths | 95% | 90% |
| Utilities | 90% | 80% |
| UI components | 70% | 60% |

---

## Test Patterns

### Naming Convention
\`\`\`typescript
describe('ComponentName', () => {
  it('should [expected behavior] when [condition]', () => {
    // Arrange
    // Act
    // Assert
  });
});
\`\`\`

### Test Data
- Use factories for complex objects
- Avoid hardcoded IDs
- Reset state between tests

### Mocking
- Mock external services
- Use MSW for API mocking
- Avoid mocking too deep

---

## Running Tests

\`\`\`bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# E2E tests
pnpm test:e2e
\`\`\`

---

## CI/CD Integration

- Tests run on every PR
- Coverage gates enforced
- E2E runs on staging deploy
- Flaky tests quarantined
EOF
}

generate_glossary() {
  cat << EOF
# Glossary

> Project-specific terminology and definitions.

**Last Updated**: $(date +%Y-%m-%d)

---

## Terms

### A

**ADR (Architecture Decision Record)**
A document capturing an important architectural decision along with its context and consequences.

### C

**Constitution**
The foundational document defining core principles that guide all project decisions.

### M

**Memory Document**
A document in \`.specify/memory/\` that captures project knowledge for AI agents and developers.

### P

**Phase**
A unit of work in the project roadmap, designed to be completable in a single coding session.

### S

**SpecKit**
The spec-driven development framework used for this project.

**Spec (Specification)**
A document defining what a feature should do, written for non-technical stakeholders.

---

## Acronyms

| Acronym | Full Form | Context |
|---------|-----------|---------|
| API | Application Programming Interface | Backend services |
| CI/CD | Continuous Integration/Deployment | DevOps |
| E2E | End-to-End | Testing |
| ORM | Object-Relational Mapping | Database |
| TDD | Test-Driven Development | Methodology |
| UI/UX | User Interface/Experience | Design |

---

## Domain Terms

Add project-specific domain terminology here as the project evolves.
EOF
}

# =============================================================================
# Commands
# =============================================================================

cmd_init() {
  local doc_name="${1:-}"
  local force=false

  # Parse remaining args for --force
  shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force|-f) force=true ;;
    esac
    shift
  done

  if [[ -z "$doc_name" ]]; then
    log_error "Document name required"
    echo "Usage: speckit memory init <document>"
    echo ""
    echo "Documents: constitution, tech-stack, coding-standards,"
    echo "           api-standards, security-checklist, testing-strategy,"
    echo "           glossary, recommended, all"
    exit 1
  fi

  local repo_root
  repo_root="$(get_repo_root)"
  local memory_dir="${repo_root}/.specify/memory"

  # Ensure memory directory exists
  ensure_dir "$memory_dir"

  # Get project name from directory
  local project_name
  project_name="$(basename "$repo_root")"

  # Determine which docs to create
  local docs_to_create=()

  case "$doc_name" in
    all)
      docs_to_create=("constitution" "tech-stack" "coding-standards" "api-standards" "security-checklist" "testing-strategy" "glossary")
      ;;
    recommended)
      docs_to_create=("constitution" "tech-stack" "coding-standards" "api-standards" "security-checklist" "testing-strategy")
      ;;
    constitution|tech-stack|coding-standards|api-standards|security-checklist|testing-strategy|glossary)
      docs_to_create=("$doc_name")
      ;;
    *)
      log_error "Unknown document: $doc_name"
      echo "Valid documents: constitution, tech-stack, coding-standards,"
      echo "                 api-standards, security-checklist, testing-strategy,"
      echo "                 glossary, recommended, all"
      exit 1
      ;;
  esac

  log_step "Initializing memory documents"

  local created=0
  local skipped=0
  local results=()

  for doc in "${docs_to_create[@]}"; do
    local filename
    local status_type
    local description

    case "$doc" in
      constitution)
        filename="constitution.md"
        status_type="REQUIRED"
        description="Project principles and governance"
        ;;
      tech-stack)
        filename="tech-stack.md"
        status_type="RECOMMENDED"
        description="Approved technologies and versions"
        ;;
      coding-standards)
        filename="coding-standards.md"
        status_type="RECOMMENDED"
        description="Code style and patterns"
        ;;
      api-standards)
        filename="api-standards.md"
        status_type="RECOMMENDED"
        description="API design patterns"
        ;;
      security-checklist)
        filename="security-checklist.md"
        status_type="RECOMMENDED"
        description="Security requirements"
        ;;
      testing-strategy)
        filename="testing-strategy.md"
        status_type="RECOMMENDED"
        description="Test approach and coverage"
        ;;
      glossary)
        filename="glossary.md"
        status_type="OPTIONAL"
        description="Project terminology"
        ;;
    esac

    local filepath="${memory_dir}/${filename}"

    if [[ -f "$filepath" ]] && [[ "$force" != "true" ]]; then
      log_warn "Skipping $filename (exists, use --force to overwrite)"
      skipped=$((skipped + 1))
      results+=("{\"doc\": \"$doc\", \"file\": \"$filename\", \"status\": \"skipped\", \"reason\": \"exists\"}")
      continue
    fi

    # Generate content
    case "$doc" in
      constitution) generate_constitution "$project_name" > "$filepath" ;;
      tech-stack) generate_tech_stack > "$filepath" ;;
      coding-standards) generate_coding_standards > "$filepath" ;;
      api-standards) generate_api_standards > "$filepath" ;;
      security-checklist) generate_security_checklist > "$filepath" ;;
      testing-strategy) generate_testing_strategy > "$filepath" ;;
      glossary) generate_glossary > "$filepath" ;;
    esac

    log_success "Created $filename ($status_type)"
    created=$((created + 1))
    results+=("{\"doc\": \"$doc\", \"file\": \"$filename\", \"status\": \"created\", \"type\": \"$status_type\"}")
  done

  echo ""
  log_info "Created: $created, Skipped: $skipped"

  if is_json_output; then
    local results_json
    results_json=$(printf '%s\n' "${results[@]}" | jq -s '.')
    echo "{\"created\": $created, \"skipped\": $skipped, \"documents\": $results_json}"
  fi
}

cmd_list() {
  # Parse --json flag
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) enable_json_output ;;
    esac
    shift
  done

  local repo_root
  repo_root="$(get_repo_root)"
  local memory_dir="${repo_root}/.specify/memory"

  if ! is_json_output; then
    log_step "Memory documents in $memory_dir"
  fi

  if [[ ! -d "$memory_dir" ]]; then
    if is_json_output; then
      echo '{"exists": false, "documents": []}'
    else
      log_warn "Memory directory not found"
    fi
    return
  fi

  local results=()

  if ! is_json_output; then
    echo ""
    printf "%-25s %-12s %-8s %s\n" "DOCUMENT" "TYPE" "STATUS" "LINES"
    printf "%-25s %-12s %-8s %s\n" "--------" "----" "------" "-----"
  fi

  for doc in constitution tech-stack coding-standards api-standards security-checklist testing-strategy glossary; do
    local filename
    local status_type

    case "$doc" in
      constitution) filename="constitution.md"; status_type="REQUIRED" ;;
      tech-stack) filename="tech-stack.md"; status_type="RECOMMENDED" ;;
      coding-standards) filename="coding-standards.md"; status_type="RECOMMENDED" ;;
      api-standards) filename="api-standards.md"; status_type="RECOMMENDED" ;;
      security-checklist) filename="security-checklist.md"; status_type="RECOMMENDED" ;;
      testing-strategy) filename="testing-strategy.md"; status_type="RECOMMENDED" ;;
      glossary) filename="glossary.md"; status_type="OPTIONAL" ;;
    esac

    local filepath="${memory_dir}/${filename}"
    local status="missing"
    local lines="-"

    if [[ -f "$filepath" ]]; then
      status="exists"
      lines=$(wc -l < "$filepath" | tr -d ' ')
    fi

    if ! is_json_output; then
      local status_icon="❌"
      [[ "$status" == "exists" ]] && status_icon="✅"
      printf "%-25s %-12s %-8s %s\n" "$filename" "$status_type" "$status_icon" "$lines"
    fi

    results+=("{\"doc\": \"$doc\", \"file\": \"$filename\", \"type\": \"$status_type\", \"exists\": $([ "$status" == "exists" ] && echo "true" || echo "false"), \"lines\": $([ "$lines" == "-" ] && echo "null" || echo "$lines")}")
  done

  if is_json_output; then
    local results_json
    results_json=$(printf '%s\n' "${results[@]}" | jq -s '.')
    echo "{\"path\": \"$memory_dir\", \"documents\": $results_json}"
  fi
}

cmd_check() {
  local repo_root
  repo_root="$(get_repo_root)"
  local memory_dir="${repo_root}/.specify/memory"

  log_step "Checking memory document health"

  local issues=()
  local warnings=()

  # Check memory directory exists
  if [[ ! -d "$memory_dir" ]]; then
    issues+=("Memory directory not found: $memory_dir")
    log_error "Memory directory not found"
    if is_json_output; then
      echo '{"healthy": false, "issues": ["Memory directory not found"]}'
    fi
    exit 1
  fi

  # Check constitution (required)
  local constitution="${memory_dir}/constitution.md"
  if [[ ! -f "$constitution" ]]; then
    issues+=("REQUIRED: constitution.md is missing")
    log_error "constitution.md is missing (REQUIRED)"
  else
    log_success "constitution.md exists"

    # Check constitution has content
    local lines
    lines=$(wc -l < "$constitution" | tr -d ' ')
    if [[ "$lines" -lt 20 ]]; then
      warnings+=("constitution.md seems incomplete ($lines lines)")
      log_warn "constitution.md seems incomplete ($lines lines)"
    fi
  fi

  # Check recommended docs
  for doc in tech-stack coding-standards api-standards security-checklist testing-strategy; do
    local filepath="${memory_dir}/${doc}.md"
    if [[ ! -f "$filepath" ]]; then
      warnings+=("RECOMMENDED: ${doc}.md is missing")
      log_warn "${doc}.md is missing (RECOMMENDED)"
    else
      log_success "${doc}.md exists"
    fi
  done

  echo ""

  if [[ ${#issues[@]} -gt 0 ]]; then
    log_error "Health check FAILED: ${#issues[@]} critical issue(s)"
    if is_json_output; then
      local issues_json
      issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
      local warnings_json
      warnings_json=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
      echo "{\"healthy\": false, \"issues\": $issues_json, \"warnings\": $warnings_json}"
    fi
    exit 1
  elif [[ ${#warnings[@]} -gt 0 ]]; then
    log_warn "Health check PASSED with ${#warnings[@]} warning(s)"
    if is_json_output; then
      local warnings_json
      warnings_json=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
      echo "{\"healthy\": true, \"warnings\": $warnings_json}"
    fi
  else
    log_success "Health check PASSED"
    if is_json_output; then
      echo '{"healthy": true, "issues": [], "warnings": []}'
    fi
  fi
}

cmd_path() {
  local repo_root
  repo_root="$(get_repo_root)"
  local memory_dir="${repo_root}/.specify/memory"

  if is_json_output; then
    echo "{\"path\": \"$memory_dir\", \"exists\": $([ -d "$memory_dir" ] && echo "true" || echo "false")}"
  else
    echo "$memory_dir"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  local cmd="${1:-}"

  case "$cmd" in
    init)
      shift
      cmd_init "$@"
      ;;
    list)
      shift
      cmd_list "$@"
      ;;
    check)
      shift
      cmd_check "$@"
      ;;
    path)
      shift
      cmd_path "$@"
      ;;
    --help|-h|help)
      show_help
      ;;
    --json)
      # Handle --json as first arg
      enable_json_output
      shift
      main "$@"
      ;;
    "")
      show_help
      ;;
    *)
      log_error "Unknown command: $cmd"
      echo "Run 'speckit memory --help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
