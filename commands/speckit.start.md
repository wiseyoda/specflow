---
description: Smart entry point that detects project state and routes to the appropriate SpecKit command.
handoffs:
  - label: Initialize Project
    agent: speckit.init
    prompt: Start a new SpecKit project
  - label: Create Roadmap
    agent: speckit.roadmap
    prompt: Create the project roadmap
  - label: Continue Orchestration
    agent: speckit.orchestrate
    prompt: Continue orchestrated development
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Goal

Provide a **single entry point** for SpecKit that automatically detects project state and routes to the appropriate command. This eliminates the need for users to know which command to run - they just run `/speckit.start` and the system figures out what to do next.

**North Star**: Only IMPROVE and enable the SpecKit flow, never be destructive. Preserve existing work.

## CLI Dependencies

This command uses the SpecKit CLI (`speckit`) for state detection:

```bash
# Verify CLI is available
speckit --help

# Key commands used for detection
speckit detect                    # Scan for existing content
speckit doctor --check project    # Check project structure
speckit state validate            # Check state file
speckit roadmap validate          # Check ROADMAP.md
speckit roadmap status            # Get phase statuses
```

---

## Pre-Flight Checks

Before routing, perform these checks in order:

### Check 0a: CLI Availability

```bash
# Check if speckit CLI is available
which speckit || command -v speckit
```

**If CLI is NOT available:**

Display installation instructions and stop:

```text
╔══════════════════════════════════════════════════════════════╗
║              SpecKit CLI Not Installed                        ║
╠══════════════════════════════════════════════════════════════╣
║ The SpecKit CLI is required but not found in your PATH.       ║
║                                                               ║
║ To install:                                                   ║
║   git clone https://github.com/YOUR_USERNAME/speckit          ║
║   cd speckit && ./install.sh                                  ║
║                                                               ║
║ After installation, add to your shell config:                 ║
║   export PATH="$HOME/.claude/speckit-system/bin:$PATH"        ║
║                                                               ║
║ Then run /speckit.start again.                                ║
╚══════════════════════════════════════════════════════════════╝
```

### Check 0b: Write Permissions

```bash
# Check if we can write to the current directory
touch .speckit-write-test 2>/dev/null && rm -f .speckit-write-test
```

**If write permission is denied:**

```text
╔══════════════════════════════════════════════════════════════╗
║              Write Permission Denied                          ║
╠══════════════════════════════════════════════════════════════╣
║ Cannot write to the current directory.                        ║
║                                                               ║
║ SpecKit needs write access to create:                         ║
║ • .specify/         (state and configuration)                 ║
║ • specs/            (feature specifications)                  ║
║ • ROADMAP.md        (development phases)                      ║
║                                                               ║
║ Please check:                                                 ║
║ 1. You own this directory                                     ║
║ 2. Directory is not read-only                                 ║
║ 3. You're not in a system/protected location                  ║
╚══════════════════════════════════════════════════════════════╝
```

### Check 0c: Git Repository (Optional)

```bash
# Check if in a git repository (recommended but not required)
git rev-parse --git-dir 2>/dev/null
```

**If NOT in a git repository:**

Display a warning but continue:

```text
╔══════════════════════════════════════════════════════════════╗
║              Not a Git Repository (Warning)                   ║
╠══════════════════════════════════════════════════════════════╣
║ This directory is not a Git repository.                       ║
║                                                               ║
║ SpecKit works best with Git for:                              ║
║ • Branch management per phase                                 ║
║ • Feature isolation                                           ║
║ • Safe rollbacks                                              ║
║                                                               ║
║ To initialize: git init                                       ║
║                                                               ║
║ Continuing without Git (some features limited)...             ║
╚══════════════════════════════════════════════════════════════╝
```

### Check 1: Existing Content Detection

Run detection to identify what already exists:

```bash
speckit detect --json
```

Look for:
- Existing CLAUDE.md (preserve, offer to merge)
- Existing documentation (docs/, ADRs, RFCs)
- Existing specs in different format
- Partial SpecKit setup

**If existing content is detected:**

Display what was found and explain how SpecKit will coexist:

```text
╔══════════════════════════════════════════════════════════════╗
║              Existing Content Detected                        ║
╠══════════════════════════════════════════════════════════════╣
║ Found in this repository:                                     ║
║ ✓ CLAUDE.md (2.1 KB) - Will be preserved/merged               ║
║ ✓ docs/ (12 files) - SpecKit will coexist                     ║
║ ✓ docs/adr/ (5 ADRs) - Can import to .specify/memory/adrs/    ║
║                                                               ║
║ SpecKit will NOT overwrite your existing files.               ║
║ New directories: .specify/, specs/, ROADMAP.md                ║
╚══════════════════════════════════════════════════════════════╝
```

### Check 2: State Version Compatibility

If state file exists, check version:

```bash
speckit state validate
```

**If state file is v1.0:**

```text
╔══════════════════════════════════════════════════════════════╗
║              State Migration Available                        ║
╠══════════════════════════════════════════════════════════════╣
║ Your project uses SpecKit state format v1.0.                 ║
║ Current version is v2.0.                                      ║
║                                                               ║
║ Migration will:                                               ║
║ • Move config paths from .project to .config                  ║
║ • Add interview and orchestration tracking                    ║
║ • Preserve ALL existing data                                  ║
║ • Create backup before migration                              ║
║                                                               ║
║ Run: speckit state migrate                                    ║
╚══════════════════════════════════════════════════════════════╝
```

Offer to run migration automatically or proceed with warning.

---

## Detection Logic

Run these checks in order to determine project state:

### Step 1: Check Project Structure

```bash
# Check if .specify/ exists and is valid
speckit scaffold --status
```

**If `.specify/` does NOT exist:**
- Display: "No SpecKit project found. Let's initialize one."
- Route to: `/speckit.init`

### Step 2: Check State File

```bash
# Check if state file exists and is valid
speckit state validate
```

**If state file is missing or invalid:**
- Check if `.specify/discovery/state.md` exists (old format)
- If discovery state exists with progress > 0:
  - Display: "Found incomplete interview. Resuming..."
  - Route to: `/speckit.init continue`
- If no discovery state:
  - Display: "Project structure exists but no state. Initializing..."
  - Route to: `/speckit.init`

### Step 3: Check Interview Status

```bash
# Get interview status from state
speckit state get interview.status --json
```

**If interview status is NOT "completed":**
- Display current interview progress
- Route to: `/speckit.init continue`

### Step 4: Check ROADMAP.md

```bash
# Check if ROADMAP exists and is valid
speckit roadmap validate
```

**If ROADMAP.md does NOT exist or is invalid:**
- Display: "Interview complete but no roadmap. Let's create one."
- Route to: `/speckit.roadmap`

### Step 5: Check Orchestration State

```bash
# Get current orchestration status
speckit state get orchestration --json
speckit roadmap status --json
```

**If orchestration is in progress:**
- Get current phase and step
- Display: "Resuming Phase {N}: {name} at step {step}"
- Route to: `/speckit.orchestrate continue`

**If orchestration has pending phases:**
- Get next phase from ROADMAP
- Display: "Ready to start Phase {N}: {name}"
- Route to: `/speckit.orchestrate`

### Step 6: Check Completion

```bash
# Get all phase statuses
speckit roadmap status --json
```

**If ALL phases are complete:**
- Display completion summary
- Offer options for next steps

## Routing Table

| Condition | Route To | Arguments |
|-----------|----------|-----------|
| No `.specify/` folder | `/speckit.init` | - |
| No state file | `/speckit.init` | - |
| Interview incomplete | `/speckit.init` | `continue` |
| No ROADMAP.md | `/speckit.roadmap` | - |
| Orchestration in progress | `/speckit.orchestrate` | `continue` |
| Next phase available | `/speckit.orchestrate` | - |
| All phases complete | Display summary | - |

## Status Display

When checking status, display a clear summary:

```text
╔══════════════════════════════════════════════════════════════╗
║                    SpecKit Project Status                     ║
╠══════════════════════════════════════════════════════════════╣
║ Project: [Name]                                               ║
║ Status:  [Overall Status]                                     ║
╠══════════════════════════════════════════════════════════════╣
║ ✅ Project Structure    .specify/ exists                      ║
║ ✅ Interview            Complete (45 decisions)               ║
║ ✅ Memory Documents     8 documents generated                 ║
║ ✅ ROADMAP.md           12 phases defined                     ║
║ 🔄 Orchestration        Phase 003 in progress                 ║
╠══════════════════════════════════════════════════════════════╣
║ Current: Phase 003 - Flow Engine Core                         ║
║ Step:    implement (15/23 tasks complete)                     ║
╠══════════════════════════════════════════════════════════════╣
║ Next Action: Continue implementation                          ║
╚══════════════════════════════════════════════════════════════╝
```

## Completion Summary

When all phases are complete:

```text
╔══════════════════════════════════════════════════════════════╗
║                  🎉 Project Complete! 🎉                      ║
╠══════════════════════════════════════════════════════════════╣
║ Project: [Name]                                               ║
║ Phases Completed: 12/12                                       ║
║ Total Tasks: 247                                              ║
║ Duration: [Start Date] - [End Date]                           ║
╠══════════════════════════════════════════════════════════════╣
║ What's Next?                                                  ║
║                                                               ║
║ • Add more phases to ROADMAP.md for new features              ║
║ • Run /speckit.verify for final validation                    ║
║ • Deploy your application                                     ║
╚══════════════════════════════════════════════════════════════╝
```

## User Arguments

Handle these optional arguments:

| Argument | Action |
|----------|--------|
| (empty) | Run detection logic and route |
| `status` | Show status display only, don't route |
| `reset` | Reset orchestration state, restart current phase |
| `doctor` | Run `speckit doctor` for diagnostics |

## Error Handling

If any CLI command fails:

1. Run `speckit doctor` to diagnose issues
2. Display actionable error message
3. Suggest fix: "Run `speckit doctor --fix` to attempt auto-repair"

## Implementation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      /speckit.start                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ .specify/ exists?│
                    └─────────────────┘
                      │           │
                     No          Yes
                      │           │
                      ▼           ▼
              ┌───────────┐  ┌─────────────────┐
              │ init      │  │ State file OK?  │
              └───────────┘  └─────────────────┘
                               │           │
                              No          Yes
                               │           │
                               ▼           ▼
                       ┌───────────┐  ┌──────────────────┐
                       │ init      │  │ Interview done?  │
                       └───────────┘  └──────────────────┘
                                        │           │
                                       No          Yes
                                        │           │
                                        ▼           ▼
                                ┌────────────┐  ┌──────────────┐
                                │ init cont. │  │ ROADMAP OK?  │
                                └────────────┘  └──────────────┘
                                                  │           │
                                                 No          Yes
                                                  │           │
                                                  ▼           ▼
                                          ┌──────────┐  ┌─────────────────┐
                                          │ roadmap  │  │ Phases pending? │
                                          └──────────┘  └─────────────────┘
                                                          │           │
                                                         Yes          No
                                                          │           │
                                                          ▼           ▼
                                                  ┌────────────┐  ┌──────────┐
                                                  │ orchestrate│  │ Complete!│
                                                  └────────────┘  └──────────┘
```

## Context

$ARGUMENTS
