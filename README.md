# SpecKit - Spec-Driven Development for Claude Code

SpecKit is a comprehensive framework for spec-driven development (SDD) that integrates with [Claude Code](https://claude.ai/claude-code). It provides structured workflows for requirements gathering, specification writing, planning, implementation, and verification.

## Features

- **Smart Entry Point** (`/speckit.start`) - Auto-detects project state and routes to appropriate workflow
- **Requirements Interview** (`/speckit.init`) - Guided discovery process that captures project requirements
- **Specification Writing** (`/speckit.specify`) - Generate detailed feature specifications
- **Planning** (`/speckit.plan`) - Create technical implementation plans
- **Task Generation** (`/speckit.tasks`) - Break down plans into actionable tasks
- **Orchestration** (`/speckit.orchestrate`) - Automated end-to-end workflow with state persistence
- **Verification** (`/speckit.verify`) - Validate implementations against specifications
- **CLI Tools** (`speckit`) - Bash utilities for state management, git operations, and more

## Installation

### Quick Install

```bash
git clone https://github.com/YOUR_USERNAME/claude-speckit-orchestration.git
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

## Quick Start

### Option 1: Smart Entry (Recommended)

```bash
cd your-project
# In Claude Code:
/speckit.start
```

The `/speckit.start` command automatically:
- Detects if project needs initialization → routes to `/speckit.init`
- Detects incomplete interview → resumes interview
- Detects missing ROADMAP → routes to `/speckit.roadmap`
- Detects pending work → routes to `/speckit.orchestrate`

### Option 2: Manual Workflow

```bash
# 1. Initialize project
/speckit.init

# 2. Create roadmap
/speckit.roadmap

# 3. Run full workflow
/speckit.orchestrate
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
│   │   ├── constitution.md  # Core principles
│   │   ├── tech-stack.md    # Technology choices
│   │   ├── coding-standards.md
│   │   ├── api-standards.md
│   │   ├── security-checklist.md
│   │   ├── testing-strategy.md
│   │   ├── glossary.md
│   │   └── adrs/            # Architecture Decision Records
│   ├── templates/           # Project-specific templates
│   ├── scripts/bash/        # Project-specific scripts
│   ├── orchestration-state.json
│   └── archive/
├── specs/                   # Feature specifications
│   └── 001-feature-name/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       └── checklists/
├── ROADMAP.md              # Development phases
└── CLAUDE.md               # Agent instructions
```

## CLI Reference

### State Management

```bash
speckit state get                    # Show full state
speckit state get config             # Get config section
speckit state set "key=value"        # Set value
speckit state init                   # Initialize state file
speckit state reset                  # Reset to defaults
speckit state validate               # Validate state
```

### Project Scaffolding

```bash
speckit scaffold                     # Create .specify/ structure
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

### JSON Output

All commands support JSON output for scripting:

```bash
speckit state get --json
speckit roadmap status --json
speckit tasks status --json
```

## Claude Code Commands

| Command | Description |
|---------|-------------|
| `/speckit.start` | Smart entry point - auto-detects state |
| `/speckit.init` | Start requirements interview |
| `/speckit.init status` | Show interview progress |
| `/speckit.init pause` | Pause interview |
| `/speckit.roadmap` | Create/update ROADMAP.md |
| `/speckit.orchestrate` | Run full development workflow |
| `/speckit.specify` | Create feature specification |
| `/speckit.clarify` | Clarify specification ambiguities |
| `/speckit.plan` | Create implementation plan |
| `/speckit.tasks` | Generate task breakdown |
| `/speckit.analyze` | Analyze artifacts for issues |
| `/speckit.checklist` | Create verification checklist |
| `/speckit.implement` | Execute implementation tasks |
| `/speckit.verify` | Verify implementation completeness |
| `/speckit.constitution` | Create/update project constitution |
| `/speckit.memory` | Manage memory documents |

## Configuration

SpecKit uses a state file at `.specify/orchestration-state.json`:

```json
{
  "version": "2.0",
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
  }
}
```

All paths are configurable to match your project structure.

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
- **Bash 4+** - For shell scripts

## Contributing

See [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md) for the development roadmap and contribution guidelines.

## License

MIT License - See [LICENSE](LICENSE) for details.
