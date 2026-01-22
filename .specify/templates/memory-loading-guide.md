# Memory Document Loading Guide

This guide defines which memory documents to load for each command and when.

## Memory Document Inventory

| Document | Purpose | Required By |
|----------|---------|-------------|
| `constitution.md` | Core principles, MUST requirements | ALL commands (violations are CRITICAL) |
| `tech-stack.md` | Approved technologies, versions | design, implement, verify |
| `coding-standards.md` | Naming, organization, style | implement, review, verify |
| `testing-strategy.md` | Test patterns, coverage requirements | implement, verify |
| `security-checklist.md` | Security requirements, validation | implement, verify |
| `glossary.md` | Domain terminology | design (for consistency) |
| `cli-json-schema.md` | CLI output formats | CLI development only |

## Loading by Command

### /flow.design
```
Required:
- constitution.md (validate design choices against principles)

Recommended:
- tech-stack.md (ensure plan uses approved technologies)
- glossary.md (maintain consistent terminology in spec)
```

### /flow.analyze
```
Required:
- constitution.md (Pass E checks for MUST violations)

Recommended:
- tech-stack.md (detect technology inconsistencies)
```

### /flow.implement
```
Required:
- constitution.md (implementation must follow principles)

Recommended:
- tech-stack.md (use approved technologies)
- coding-standards.md (follow naming and organization)
- testing-strategy.md (write tests correctly)
- security-checklist.md (implement secure code)
```

### /flow.verify
```
Required:
- constitution.md (compliance check)

Recommended:
- tech-stack.md (verify approved technologies)
- coding-standards.md (verify naming and organization)
- testing-strategy.md (verify test coverage)
- security-checklist.md (security compliance)
```

### /flow.review
```
Required:
- constitution.md (violations are CRITICAL findings)

Recommended:
- coding-standards.md (BP category checks)
- tech-stack.md (technology compliance)
```

### /flow.merge
```
Required:
- None (merge doesn't read memory docs)
```

### /flow.orchestrate
```
Required:
- None (orchestrate delegates to sub-commands)
```

## Standard Loading Pattern

Use this bash pattern for consistent loading:

```bash
# Always load constitution (required)
CONSTITUTION=$(cat .specify/memory/constitution.md 2>/dev/null)
if [[ -z "$CONSTITUTION" ]]; then
  echo "ERROR: constitution.md not found. Run /flow.init first."
  exit 1
fi

# Load optional docs (fail gracefully)
TECH_STACK=$(cat .specify/memory/tech-stack.md 2>/dev/null || echo "")
CODING_STANDARDS=$(cat .specify/memory/coding-standards.md 2>/dev/null || echo "")
TESTING_STRATEGY=$(cat .specify/memory/testing-strategy.md 2>/dev/null || echo "")
SECURITY_CHECKLIST=$(cat .specify/memory/security-checklist.md 2>/dev/null || echo "")
```

## Parallel Loading Pattern

When loading multiple docs, use parallel agents:

```
Launch N parallel Task agents:

Agent 1: Load constitution.md → extract MUST requirements
Agent 2: Load tech-stack.md → extract approved technologies
Agent 3: Load coding-standards.md → extract naming patterns
...
```

Each agent returns extracted key points, not full content, to minimize context.

## Constitution Violations

**CRITICAL** - Constitution violations ALWAYS block the workflow:

1. During DESIGN: Block spec creation if design violates principles
2. During ANALYZE: Report as CRITICAL finding (Pass E)
3. During IMPLEMENT: Halt and ask user for direction
4. During VERIFY: Block verification until resolved
5. During REVIEW: Report as CRITICAL finding

## Missing Memory Documents

| Situation | Action |
|-----------|--------|
| constitution.md missing | ABORT - cannot proceed without core principles |
| Optional doc missing | WARN and continue - note which checks were skipped |
| All optional docs missing | Suggest running `/flow.memory` to create them |
