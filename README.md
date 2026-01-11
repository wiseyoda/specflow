# SpecKit - Spec-Driven Development for Claude Code

[![Test Suite](https://github.com/wiseyoda/claude-speckit-orchestration/actions/workflows/test.yml/badge.svg)](https://github.com/wiseyoda/claude-speckit-orchestration/actions/workflows/test.yml)

> **Version 2.0** - Simplified architecture with web UI support

SpecKit is a comprehensive framework for spec-driven development (SDD) that integrates with [Claude Code](https://claude.ai/claude-code). It provides structured workflows for requirements gathering, specification writing, planning, implementation, and verification.

## Features

- **Smart Entry Point** (`/speckit.start`) - Auto-detects project state and routes to appropriate workflow
- **Requirements Interview** (`/speckit.init`) - Guided discovery process that captures project requirements
- **Specification Writing** (`/speckit.specify`) - Generate detailed feature specifications
- **Planning** (`/speckit.plan`) - Create technical implementation plans
- **Task Generation** (`/speckit.tasks`) - Break down plans into actionable tasks
- **Orchestration** (`/speckit.orchestrate`) - Automated end-to-end workflow with state persistence
- **Implementation** (`/speckit.implement`) - Execute tasks with optional TDD mode
- **Verification** (`/speckit.verify`) - Validate implementations against specifications
- **Phase Completion** (`/speckit.merge`) - Push, PR, merge, and cleanup in one command
- **Backlog Management** (`/speckit.backlog`) - Triage orphaned tasks into future phases
- **Memory Management** (`/speckit.memory`) - Verify and reconcile project memory documents
- **CLI Tools** (`speckit`) - Bash utilities for state management, git operations, and more
- **Phase Archives** (`speckit phase`) - Manage phase details, archive to HISTORY.md
- **Issue Tracking** (`speckit issue`) - Local issue management with frontmatter-based files

## Installation

### Quick Install

```bash
git clone https://github.com/wiseyoda/claude-speckit-orchestration.git
cd claude-speckit-orchestration
./install.sh
```

After installation, add the CLI to your PATH:

```bash
# Add to your .bashrc or .zshrc
export PATH="$HOME/.claude/speckit-system/bin:$PATH"
```

### Check Installation

```bash
./install.sh --check
# or after PATH setup:
speckit --help
speckit doctor
```

### Upgrade

```bash
cd claude-speckit-orchestration
git pull
./install.sh --upgrade
```

## Quickstart (5 Minutes)

### 1. Install SpecKit

```bash
git clone https://github.com/wiseyoda/claude-speckit-orchestration.git
cd claude-speckit-orchestration
./install.sh
export PATH="$HOME/.claude/speckit-system/bin:$PATH"  # Add to .bashrc/.zshrc
```

### 2. Set Up Your Project

```bash
cd your-existing-project
speckit scaffold            # Creates .specify/ structure
speckit doctor              # Verify everything is working
```

SpecKit auto-detects your project type (TypeScript, Python, Rust, Go, Bash) and customizes templates accordingly.

### 3. Start Development

In Claude Code, run:
```
/speckit.start
```

This command auto-detects your project state and routes you to the right workflow.

### CLI vs Slash Commands

SpecKit has two interfaces:

| Type | Syntax | Purpose | Example |
|------|--------|---------|---------|
| **CLI** | `speckit <cmd>` | State/file operations | `speckit scaffold`, `speckit doctor` |
| **Slash** | `/speckit.<cmd>` | Claude Code workflows | `/speckit.start`, `/speckit.orchestrate` |

**Rule of thumb**: Use CLI for setup and diagnostics. Use slash commands for development workflows.

### Quick Options

**Smart Entry (Recommended)**
```
/speckit.start
```
Detects project state and routes to appropriate workflow.

**Manual Workflow**
```
/speckit.init        # Start requirements interview
/speckit.roadmap     # Create development phases
/speckit.orchestrate # Run automated workflow
```

**Preview Before Scaffolding**
```bash
speckit scaffold --safe    # Preview what would be created
speckit scaffold           # Actually create structure
```

## Workflow Overview

```
/speckit.start              # Smart entry point - detects state and routes
    │
    ▼
/speckit.init               # Project initialization interview
    │                       # Creates .specify/ structure
    │                       # Captures requirements decisions
    ▼
/speckit.roadmap            # Generate ROADMAP.md with phases
    │
    ▼
/speckit.orchestrate        # Full workflow automation
    │
    ├── /speckit.specify    # Create feature specification
    ├── /speckit.clarify    # Resolve ambiguities
    ├── /speckit.plan       # Create implementation plan
    ├── /speckit.tasks      # Generate task list
    ├── /speckit.analyze    # Cross-artifact consistency
    ├── /speckit.checklist  # Create verification checklist
    ├── /speckit.implement  # Execute tasks
    └── /speckit.verify     # Verify and update ROADMAP
    │
    ▼
/speckit.merge              # Complete phase: push, PR, merge, cleanup
    │
    ▼
/speckit.backlog            # Triage backlog items into future phases
    │
    └── (repeat for next phase)

Memory Management (run periodically):
/speckit.memory             # Verify and reconcile memory documents
/speckit.memory-init        # Generate docs from codebase analysis
```

## Project Structure

After initialization, your project will have:

```
your-project/
├── .specify/
│   ├── discovery/           # Requirements interview artifacts
│   │   ├── context.md       # Project identity
│   │   ├── decisions.md     # Captured decisions
│   │   └── state.md         # Interview progress
│   ├── memory/              # Project memory documents
│   │   ├── constitution.md  # Core principles (REQUIRED)
│   │   ├── tech-stack.md    # Technology choices (recommended)
│   │   ├── coding-standards.md  (recommended)
│   │   └── adrs/            # Architecture Decision Records
│   ├── phases/              # Individual phase detail files
│   │   └── 0010-feature-name.md
│   ├── issues/              # Local issue tracking
│   │   └── 001.md
│   ├── history/             # Completed phase archives
│   │   └── HISTORY.md
│   ├── templates/           # Project-specific templates
│   ├── scripts/bash/        # Project-specific scripts
│   ├── orchestration-state.json
│   └── archive/
├── specs/                   # Feature specifications
│   └── 0010-feature-name/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       └── checklists/
├── ROADMAP.md              # Development phases (lightweight index)
└── CLAUDE.md               # Agent instructions
```

> **Note**: Only `constitution.md` is required. Other memory documents are generated on demand based on project needs.

## Customizing Templates

SpecKit templates can be customized at two levels:

### Project-Level Templates

Copy templates to your project's `.specify/templates/` directory to customize them:

```bash
# List available templates
speckit templates list

# Copy a template to your project for customization
speckit templates copy spec-template.md

# Check for upstream updates
speckit templates check
```

Templates in `.specify/templates/` override system defaults.

### System-Level Templates

System templates live in `~/.claude/speckit-system/templates/`:

```
templates/
├── spec-template.md          # Feature specification template
├── plan-template.md          # Implementation plan template
├── tasks-template.md         # Task breakdown template
├── checklist-template.md     # Verification checklist template
├── roadmap-template.md       # Project roadmap template
├── review-template.md        # Code review template
└── memory/                   # Memory document templates
    ├── constitution.md
    ├── tech-stack.md
    └── ...
```

### Template Variables

Templates support these variables (replaced during generation):

| Variable | Description |
|----------|-------------|
| `{{PHASE_NUMBER}}` | Current phase number (e.g., 0041) |
| `{{PHASE_NAME}}` | Phase name (e.g., "Code Review Findings") |
| `{{DATE}}` | Current date (YYYY-MM-DD) |
| `{{PROJECT_NAME}}` | Project name from state |
| `{{PROJECT_TYPE}}` | Detected project type (typescript, python, etc.) |

## CLI Reference

### Context & Prerequisites

```bash
speckit context                      # Show project context (JSON)
speckit context --check              # Verify prerequisites
speckit context --summary            # Human-readable summary
```

### Feature Management

```bash
speckit feature create <name>        # Create feature directory and branch
speckit feature list                 # List all features
speckit feature current              # Show current feature
```

### State Management

```bash
speckit state get                    # Show full state
speckit state get orchestration      # Get orchestration section
speckit state set "key=value"        # Set value
speckit state init                   # Initialize state file (generates UUID)
speckit state reset                  # Reset to defaults
speckit state validate               # Validate state
speckit state migrate                # Migrate v1.x to v2.0
speckit state registry list          # List all registered projects
speckit state registry sync          # Sync registry with project
speckit state registry clean         # Remove stale entries
```

### Project Scaffolding

```bash
speckit scaffold                     # Create .specify/ structure
speckit scaffold --safe              # Preview changes without writing
speckit scaffold --type python       # Force specific project type
speckit scaffold --status            # Check what exists
speckit scaffold --force             # Recreate (overwrites)
```

### Git Operations

```bash
speckit git branch create <name>     # Create and checkout branch
speckit git branch checkout <name>   # Checkout existing branch
speckit git branch current           # Show current branch
speckit git branch list              # List all branches
speckit git commit "<message>"       # Stage all and commit
speckit git merge <branch>           # Merge branch to current
speckit git push                     # Push current branch
speckit git sync                     # Fetch all, show status
```

### ROADMAP.md Operations

```bash
speckit roadmap status               # Show all phases
speckit roadmap update <phase> <status>  # Update phase status
speckit roadmap next                 # Get next pending phase
speckit roadmap current              # Get current phase
speckit roadmap validate             # Check structure
speckit roadmap renumber             # Smart renumber all phases
```

### Phase Detail Management

```bash
speckit phase list                   # List all phases with location
speckit phase show <num>             # Show phase details
speckit phase archive <num>          # Archive to HISTORY.md
speckit phase create <num> <name>    # Create phase detail file
speckit phase migrate                # Migrate inline to files
```

### Issue Tracking

```bash
speckit issue list                   # List all issues
speckit issue show <id>              # Show issue details
speckit issue create "<title>"       # Create new issue
speckit issue close <id>             # Close an issue
speckit issue update <id>            # Update an issue
speckit issue migrate                # Migrate ROADMAP issues to files
```

### CLAUDE.md Operations

```bash
speckit claude-md update "<phase>" "<desc>"  # Add to Recent Changes
speckit claude-md sync               # Sync from ROADMAP completions
speckit claude-md show               # Show current content
```

### Checklist Operations

```bash
speckit checklist status             # All checklists status
speckit checklist list               # List all checklists
speckit checklist incomplete         # List incomplete items
speckit checklist show <file>        # Show specific checklist
```

### Task Operations

```bash
speckit tasks status                 # Task completion status
speckit tasks incomplete             # List incomplete tasks
speckit tasks mark <task_id>         # Mark task complete
speckit tasks phase-status           # Status by phase
speckit tasks list                   # List all tasks
speckit tasks find                   # Find tasks.md files
```

### Template Management

```bash
speckit templates check              # Check for updates
speckit templates update <file>      # Update specific template
speckit templates update-all         # Update all templates
speckit templates diff <file>        # Show differences
speckit templates list               # List available templates
speckit templates copy <file>        # Copy template to project
```

### Diagnostics

```bash
speckit doctor                       # Run all diagnostics
speckit doctor --fix                 # Auto-fix issues
speckit doctor --check <area>        # Check specific area
```

### Detection & Reconciliation

```bash
speckit detect                       # Detect existing content
speckit detect --check system        # Check system installation
speckit detect --check speckit       # Check SpecKit structure
speckit detect --check docs          # Check documentation
speckit detect --check state         # Check state file

speckit reconcile                    # Reconcile state with files
speckit reconcile --dry-run          # Preview changes only
speckit reconcile --trust-files      # Trust file system over state
speckit reconcile --trust-state      # Trust state over file system
```

### Integration (Importing Existing Docs)

```bash
speckit detect --docs                # Detect existing documentation
speckit import adrs <path>           # Import ADRs from directory
speckit import adrs docs/adr --dry-run   # Preview import
speckit import adrs docs/adr --force     # Overwrite existing imports
```

See [docs/integration-guide.md](docs/integration-guide.md) for detailed integration workflows.

### Memory Document Management

```bash
speckit memory init constitution     # Initialize constitution
speckit memory init tech-stack       # Initialize tech-stack
speckit memory init recommended      # Initialize recommended docs
speckit memory init all              # Initialize all docs
speckit memory list                  # List documents with status
speckit memory check                 # Check document health
```

### Lessons Learned

```bash
speckit lessons init                 # Initialize lessons-learned.md
speckit lessons add error "desc"     # Add error entry
speckit lessons add decision "desc"  # Add decision entry
speckit lessons add gotcha "desc"    # Add gotcha entry
speckit lessons check <keyword>      # Search lessons
speckit lessons list                 # List all entries
```

### Validation Gates

```bash
speckit gate specify                 # Validate spec.md before planning
speckit gate plan                    # Validate plan.md before tasks
speckit gate tasks                   # Validate tasks.md before implement
speckit gate implement               # Validate before verification
speckit gate all                     # Run all applicable gates
speckit gate status                  # Show gate status
```

### Migration Utilities

```bash
speckit migrate roadmap              # Migrate ROADMAP.md 2.0 to 2.1
                                     # (converts 3-digit to 4-digit phases)
```

### JSON Output

All commands support JSON output for scripting:

```bash
speckit state get --json
speckit roadmap status --json
speckit tasks status --json
```

## Claude Code Commands

### Core Workflow Commands

| Command | Description |
|---------|-------------|
| `/speckit.start` | Smart entry point - auto-detects project state and routes |
| `/speckit.init` | Start requirements interview |
| `/speckit.orchestrate` | Run full end-to-end development workflow |

### Specification Commands

| Command | Description |
|---------|-------------|
| `/speckit.specify` | Create feature specification from requirements |
| `/speckit.clarify` | Ask clarifying questions to resolve ambiguities |
| `/speckit.plan` | Create technical implementation plan |
| `/speckit.tasks` | Generate actionable task breakdown |
| `/speckit.analyze` | Cross-artifact consistency analysis |
| `/speckit.checklist` | Generate requirements quality checklist |

### Implementation Commands

| Command | Description |
|---------|-------------|
| `/speckit.implement` | Execute implementation tasks |
| `/speckit.verify` | Verify implementation and update ROADMAP |
| `/speckit.merge` | Complete phase: push, PR, merge, cleanup |

### Project Management Commands

| Command | Description |
|---------|-------------|
| `/speckit.roadmap` | Create/update ROADMAP.md with phases |
| `/speckit.backlog` | Scan and triage backlog items into phases |
| `/speckit.constitution` | Create/update project constitution |

### Memory Document Commands

| Command | Description |
|---------|-------------|
| `/speckit.memory` | Clean up, verify, and reconcile memory documents |
| `/speckit.memory-init` | Generate memory docs from codebase analysis |

### Quality & Review Commands

| Command | Description |
|---------|-------------|
| `/speckit.review` | Systematic code review with categorized findings |

### Utility Commands

| Command | Description |
|---------|-------------|
| `/speckit.taskstoissues` | Convert tasks to GitHub issues |

### Command Options Reference

**`/speckit.start`**
- `--skip-detections` - Skip auto-detection
- `--verbose` - Show detailed output

**`/speckit.init`** (sub-commands)
- `status` - Show interview progress
- `pause` - Pause interview for later
- `deeper` - Go deeper on current topic
- `faster` - Accelerate interview
- `skip` - Skip current phase
- `focus <topic>` - Focus on specific topic
- `compare` - Compare options
- `research <topic>` - Research a topic
- `revisit <phase>` - Revisit a phase
- `validate` - Validate interview state
- `export` - Export to memory documents

**`/speckit.orchestrate`**
- `--resume` - Resume from last step
- `--skip-gates` - Skip validation gates
- `--phase <N>` - Start at specific phase

**`/speckit.implement`**
- `--tdd` - Enforce test-driven development
- `continue` - Resume from last incomplete task
- `phase <N>` - Start at specific phase

**`/speckit.memory`**
- `--dry-run` - Analyze only, no changes
- `--verbose` - Detailed analysis output
- `--fix` - Auto-fix without confirmation
- `--reconcile` - Include ROADMAP/codebase drift detection (default)
- `--no-reconcile` - Skip drift detection (faster)
- `--promote` - Scan completed specs for decisions to promote
- `--deep` - Full codebase scan

**`/speckit.memory-init`**
- `<document>` - Document: `coding-standards`, `testing-strategy`, `glossary`, `tech-stack`, `all`, `recommended`
- `--force` - Overwrite existing documents
- `--dry-run` - Preview without writing

**`/speckit.merge`**
- `--pr-only` - Create PR but don't merge
- `--force` - Skip task completion check
- `--dry-run` - Preview what would happen

**`/speckit.backlog`**
- `--auto` - Auto-assign high-confidence matches
- `--dry-run` - Preview assignments

## Configuration

SpecKit uses a state file at `.specify/orchestration-state.json` with v2.0 schema:

```json
{
  "schema_version": "2.0",
  "project": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "my-project",
    "path": "/absolute/path/to/project",
    "created_at": "2026-01-10T12:00:00Z"
  },
  "orchestration": {
    "phase": {
      "number": "001",
      "name": "feature-name",
      "status": "in_progress"
    },
    "step": {
      "current": "implement",
      "index": 4
    }
  },
  "health": {
    "status": "healthy",
    "last_check": "2026-01-10T12:00:00Z"
  }
}
```

Projects are also registered in `~/.speckit/registry.json` for web UI discovery.

## Migrating from v1.x

If you have an existing v1.x project:

```bash
# Automatic migration
speckit state migrate

# This will:
# 1. Backup current state to .specify/archive/
# 2. Generate project UUID
# 3. Convert to v2.0 schema
# 4. Register in ~/.speckit/registry.json
```

In-progress interviews will continue seamlessly after migration.

## Troubleshooting

### Run Diagnostics

```bash
speckit doctor                       # Check everything
speckit doctor --fix                 # Auto-fix common issues
speckit doctor --check system        # Check installation
speckit doctor --check project       # Check project structure
speckit doctor --check state         # Check state file
speckit doctor --check git           # Check git status
```

### Common Issues

**CLI not found**
```bash
export PATH="$HOME/.claude/speckit-system/bin:$PATH"
```

**State file invalid**
```bash
speckit state validate
speckit state reset
```

**Missing jq**
```bash
# macOS
brew install jq

# Ubuntu/Debian
apt install jq
```

## Requirements

- **Claude Code** - The CLI tool from Anthropic
- **jq** - For JSON manipulation
- **git** - For version control
- **Bash 3.2+** - For shell scripts (macOS default works)

## Contributing

See [ROADMAP.md](ROADMAP.md) for the development phases and contribution guidelines.

## License

MIT License - See [LICENSE](LICENSE) for details.
