<p align="center">
  <h1 align="center">SpecKit</h1>
  <p align="center">
    Spec-driven development framework for <a href="https://claude.ai/code">Claude Code</a>
    <br />
    <em>Structure requirements. Generate specs. Orchestrate implementation.</em>
  </p>
</p>

<p align="center">
  <a href="https://github.com/wiseyoda/claude-speckit-orchestration/actions/workflows/test.yml"><img src="https://github.com/wiseyoda/claude-speckit-orchestration/actions/workflows/test.yml/badge.svg" alt="Test Suite"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey.svg" alt="Platform"></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/bash-3.2%2B-green.svg" alt="Bash"></a>
</p>

---

## Why SpecKit?

Building software with AI assistants works best with structure. SpecKit provides:

- **Guided requirements gathering** - Never miss critical decisions
- **Consistent artifacts** - Specs, plans, and tasks that work together
- **Automated workflows** - From requirements to merged PR in one command
- **State persistence** - Resume anywhere, track progress across sessions
- **Quality gates** - Validation at every stage

---

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Commands](#commands)
- [Documentation](#documentation)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [Support](#support)

---

## Install

```bash
git clone https://github.com/wiseyoda/claude-speckit-orchestration.git
cd claude-speckit-orchestration
./install.sh
```

Add to your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
export PATH="$HOME/.claude/speckit-system/bin:$PATH"
```

Verify:

```bash
speckit doctor
```

---

## Quick Start

**1. Initialize your project:**

```bash
cd your-project
speckit scaffold
```

**2. Start in Claude Code:**

```
/speckit.start
```

That's it. SpecKit detects your project state and guides you to the next step.

---

## How It Works

```mermaid
flowchart TD
    A["/speckit.start"] --> B["/speckit.init"]
    B --> C["/speckit.roadmap"]
    C --> D["/speckit.orchestrate"]
    D --> E["specify → plan → tasks → implement → verify"]
    E --> F["/speckit.merge"]
    F --> G["Next Phase"]
    G --> D
```

SpecKit manages the full development lifecycle:

| Stage | What Happens |
|-------|--------------|
| **Init** | Interactive interview captures requirements and decisions |
| **Roadmap** | Break work into phased milestones |
| **Orchestrate** | Automated workflow: spec → plan → tasks → implement → verify |
| **Merge** | Push, create PR, merge, cleanup branches |

---

## Commands

SpecKit has two interfaces:

| Interface | Syntax | Purpose |
|-----------|--------|---------|
| **CLI** | `speckit <cmd>` | Setup, diagnostics, state management |
| **Slash** | `/speckit.<cmd>` | AI-assisted development workflows |

### Essential Commands

| Command | Description |
|---------|-------------|
| `speckit scaffold` | Create `.specify/` project structure |
| `speckit doctor` | Verify installation and project health |
| `/speckit.start` | Smart entry point—detects state, suggests next step |
| `/speckit.orchestrate` | Full automated workflow with state persistence |
| `/speckit.merge` | Complete phase: push, PR, merge, cleanup |

### All Commands

See the full reference guides:
- **[CLI Reference](docs/cli-reference.md)** - 30+ CLI commands
- **[Slash Commands](docs/slash-commands.md)** - 20 slash commands

---

## Documentation

| Guide | Description |
|-------|-------------|
| [CLI Reference](docs/cli-reference.md) | Complete CLI command reference |
| [Slash Commands](docs/slash-commands.md) | All slash commands and options |
| [Project Structure](docs/project-structure.md) | Directory layout and key files |
| [Templates](docs/templates.md) | Customizing document templates |
| [Configuration](docs/configuration.md) | State files and settings |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |
| [Integration Guide](docs/integration-guide.md) | Importing existing documentation |

---

## Requirements

| Dependency | Version | Install |
|------------|---------|---------|
| [Claude Code](https://claude.ai/code) | Latest | [Download](https://claude.ai/code) |
| jq | 1.5+ | `brew install jq` / `apt install jq` |
| git | 2.0+ | Usually pre-installed |
| Bash | 3.2+ | macOS default works |

---

## Upgrade

```bash
cd claude-speckit-orchestration
git pull
./install.sh --upgrade
```

---

## Contributing

Contributions are welcome! See [ROADMAP.md](ROADMAP.md) for current development priorities.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Verify installation (`./install.sh --check`)
5. Submit a Pull Request

---

## Support

- **Issues**: [GitHub Issues](https://github.com/wiseyoda/claude-speckit-orchestration/issues)
- **Discussions**: [GitHub Discussions](https://github.com/wiseyoda/claude-speckit-orchestration/discussions)

---

## License

MIT - See [LICENSE](LICENSE) for details.
