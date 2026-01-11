---
description: Intelligently analyze codebase and generate comprehensive memory documents based on actual patterns found.
---

## User Input

```text
$ARGUMENTS
```

**Arguments:**
- `<document>` - Document to generate: `coding-standards`, `testing-strategy`, `glossary`, `tech-stack`, `all`, `recommended`
- `--force` - Overwrite existing documents
- `--dry-run` - Show analysis without writing files

## Goal

Generate high-quality memory documents by **analyzing the actual codebase**, not just using templates. This command scans code patterns, conventions, and terminology to produce memory documents that accurately reflect the project.

## Prerequisites

1. Project must have `.specify/memory/` directory (run `speckit scaffold` if not)
2. Constitution.md should exist (defines principles to reference)

## Execution

### 1. Detect Project Type

Scan the repository to determine:

```bash
# Check for language indicators
if [ -f "package.json" ]; then PROJECT_TYPE="node"; fi
if [ -f "Cargo.toml" ]; then PROJECT_TYPE="rust"; fi
if [ -f "go.mod" ]; then PROJECT_TYPE="go"; fi
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then PROJECT_TYPE="python"; fi
if ls *.sh &>/dev/null || [ -d "scripts/bash" ]; then PROJECT_TYPE="bash"; fi
```

### 2. Generate Requested Documents

For each requested document, perform **deep analysis** then generate content.

---

## Document Generation Strategies

### coding-standards

**Analysis Steps:**

1. **File organization**: Scan directory structure, identify patterns
   ```bash
   find . -type f -name "*.sh" -o -name "*.ts" -o -name "*.py" | head -50
   tree -L 3 -I "node_modules|.git|__pycache__"
   ```

2. **Naming conventions**: Extract function/variable naming patterns
   ```bash
   # For bash: Find function definitions
   grep -rh "^[a-z_]*() {" scripts/ | head -20

   # For TypeScript: Find exports
   grep -rh "^export (function|const|class)" src/ | head -20
   ```

3. **Code style**: Detect indentation, quoting, conditionals
   ```bash
   # Check indentation (spaces vs tabs)
   head -100 scripts/bash/lib/common.sh | grep -E "^  |^\t"
   ```

4. **Error handling**: Find error patterns
   ```bash
   grep -rh "exit [0-9]\|throw \|raise \|log_error" --include="*.sh" --include="*.ts" | head -20
   ```

5. **Constitution alignment**: Reference constitution.md principles

**Output Format:**
```markdown
# Coding Standards

> [One-line description based on project type]

**Last Updated**: [today]
**Constitution Alignment**: [relevant principles]

---

## File Organization
[Actual structure found]

## Naming Conventions
[Patterns extracted from code]

## Code Style
[Indentation, formatting rules observed]

## Error Handling
[Patterns found]

## Anti-Patterns
[Based on constitution bans or observed avoidances]
```

---

### testing-strategy

**Analysis Steps:**

1. **Find test framework**:
   ```bash
   # Check package.json for test deps
   cat package.json | jq '.devDependencies | keys | map(select(test("jest|vitest|mocha|pytest")))' 2>/dev/null

   # Check for test directories
   ls -d tests/ test/ __tests__/ spec/ 2>/dev/null
   ```

2. **Analyze test structure**:
   ```bash
   # Find test files
   find . -name "*.test.*" -o -name "*.spec.*" -o -name "test_*.py" -o -name "test-*.sh" | head -20
   ```

3. **Extract patterns**:
   ```bash
   # Find assertion patterns
   grep -rh "assert\|expect\|should" tests/ --include="*.ts" --include="*.sh" | head -20

   # Find setup/teardown
   grep -rh "beforeEach\|afterEach\|setup\|teardown" tests/ | head -10
   ```

4. **Count coverage**:
   ```bash
   # Count test files vs source files
   TEST_COUNT=$(find . -name "*.test.*" -o -name "test-*.sh" | wc -l)
   SOURCE_COUNT=$(find . -name "*.ts" -o -name "*.sh" -not -name "*.test.*" | wc -l)
   ```

**Output Format:**
```markdown
# Testing Strategy

> [Framework] testing with [approach]

**Last Updated**: [today]

---

## Test Framework
[Detected framework and runner]

## Directory Structure
[Actual test locations]

## Test Patterns
[Assertion styles, setup/teardown]

## Coverage Approach
[What gets tested based on analysis]
```

---

### glossary

**Analysis Steps:**

1. **Extract domain terms from README**:
   ```bash
   # Find capitalized terms, acronyms
   grep -oE '\b[A-Z][a-z]+[A-Z][a-z]+\b|\b[A-Z]{2,}\b' README.md | sort -u
   ```

2. **Find command/function names**:
   ```bash
   # CLI commands
   grep -rh "COMMANDS:" -A 20 --include="*.sh" | head -30

   # From help text
   grep -rh "speckit [a-z]" --include="*.md" | head -20
   ```

3. **Extract from comments/docs**:
   ```bash
   # Find defined terms
   grep -rhi "means\|refers to\|is a\|defines" --include="*.md" | head -20
   ```

4. **Scan for abbreviations**:
   ```bash
   grep -oE '\b[A-Z]{2,5}\b' README.md CLAUDE.md | sort -u | head -20
   ```

**Output Format:**
```markdown
# Glossary

> Domain terminology and project-specific concepts

**Last Updated**: [today]

---

## Core Concepts
[Key terms with definitions]

## Commands
[CLI and slash command reference]

## Abbreviations
[Acronyms found in codebase]
```

---

### tech-stack

**Analysis Steps:**

1. **Detect languages and versions**:
   ```bash
   # Node.js
   cat package.json | jq '.engines'

   # Python
   cat pyproject.toml | grep python

   # Bash
   head -1 scripts/bash/*.sh | grep bash
   ```

2. **Extract dependencies**:
   ```bash
   # Node
   cat package.json | jq '.dependencies, .devDependencies'

   # Python
   cat requirements.txt || cat pyproject.toml

   # Bash external commands
   grep -rh "command -v\|which" scripts/ | grep -oE "[a-z]+" | sort -u
   ```

3. **Cross-reference constitution** for required/banned patterns

**Output Format:**
```markdown
# Tech Stack

> Approved technologies and versions

**Last Updated**: [today]
**Constitution Alignment**: [relevant principles]

---

## Core Technologies
[Language, runtime, tools with versions]

## Dependencies
[External dependencies with purpose]

## Banned Patterns
[From constitution or conventions]
```

---

## Output

After generation, display summary:

```markdown
## Memory Documents Generated

| Document | Status | Lines | Notes |
|----------|--------|-------|-------|
| coding-standards.md | ✅ Created | 150 | Bash conventions extracted |
| testing-strategy.md | ✅ Created | 80 | Custom bash framework |
| glossary.md | ✅ Created | 120 | 45 terms defined |
| tech-stack.md | ⏭️ Skipped | - | Already exists |

**Next Steps:**
1. Review generated documents for accuracy
2. Run `/speckit.memory` to validate
3. Commit changes when satisfied
```

---

## Safety

- **Never overwrite** existing documents without `--force`
- **Preserve user edits** - merge intelligently if document exists
- **Cross-reference constitution** - generated content must align
- **Show dry-run first** if document exists and no `--force`

---

## Examples

```bash
# Generate all recommended documents
/speckit.memory-generate recommended

# Generate specific document
/speckit.memory-generate coding-standards

# Preview without writing
/speckit.memory-generate all --dry-run

# Force overwrite
/speckit.memory-generate glossary --force
```
