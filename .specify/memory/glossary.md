# Glossary

> Domain terminology, artifact types, and SpecKit-specific concepts.

**Last Updated**: 2026-01-11

---

## Core Concepts

| Term | Definition |
|------|------------|
| **SDD** | Spec-Driven Development - methodology prioritizing specification before implementation |
| **Phase** | A discrete feature/deliverable in the roadmap, numbered sequentially (001, 002) |
| **Orchestration** | Automated execution of the full SpecKit workflow (specify → verify) |
| **Memory Documents** | Project-level docs capturing decisions and principles in `.specify/memory/` |
| **Discovery** | Requirements gathering phase using structured interviews |

---

## Artifact Types

| Artifact | Purpose | Location |
|----------|---------|----------|
| `spec.md` | Feature specification (what to build) | `specs/NNN-name/` |
| `plan.md` | Technical implementation plan | `specs/NNN-name/` |
| `tasks.md` | Actionable task breakdown with checkboxes | `specs/NNN-name/` |
| `ROADMAP.md` | Master phase list and status | Repository root |
| `constitution.md` | Core principles and governance | `.specify/memory/` |
| `orchestration-state.json` | Current workflow state | `.specify/` |

---

## Workflow Steps

| Step | Purpose | Output |
|------|---------|--------|
| SPECIFY | Create feature specification | `spec.md` |
| CLARIFY | Resolve ambiguities (max 5 questions) | Updated `spec.md` |
| PLAN | Technical implementation plan | `plan.md` |
| TASKS | Break down into actionable items | `tasks.md` |
| ANALYZE | Cross-artifact consistency check | Auto-fixes |
| CHECKLIST | Create verification criteria | `verification.md` |
| IMPLEMENT | Execute tasks | Completed code |
| VERIFY | Validate completion | ROADMAP update |

---

## Task Terminology

| Term | Meaning |
|------|---------|
| **P1, P2, P3** | Priority levels (1=Critical, 2=Important, 3=Nice-to-have) |
| **US** | User Story (e.g., `[US1]`) |
| **T###** | Task number (e.g., `T001`) |
| **USER GATE** | Checkpoint requiring explicit user verification |

### Task Format
```
- [ ] T### [P?] [US?] Description with file path
```

---

## Phase Status Icons

| Icon | Meaning |
|------|---------|
| ⬜ | Not Started |
| 🔄 | In Progress |
| ✅ | Complete |

---

## Commands

### Slash Commands (Claude Code)
| Command | Purpose |
|---------|---------|
| `/speckit.start` | Smart entry point |
| `/speckit.init` | Requirements interview |
| `/speckit.orchestrate` | Full automated workflow |
| `/speckit.specify` | Create specification |
| `/speckit.plan` | Create technical plan |
| `/speckit.tasks` | Generate task list |
| `/speckit.verify` | Verify completion |
| `/speckit.memory` | Manage memory docs |

### CLI Commands (Terminal)
| Command | Purpose |
|---------|---------|
| `speckit scaffold` | Create project structure |
| `speckit state` | State management |
| `speckit roadmap` | ROADMAP operations |
| `speckit tasks` | Task operations |
| `speckit context` | Show project context |
| `speckit doctor` | Run diagnostics |

---

## Directory Structure

```
.specify/
├── memory/                 # Memory documents
│   ├── constitution.md     # (REQUIRED)
│   └── *.md                # Other memory docs
├── discovery/              # Interview artifacts
├── archive/                # Archived phases
└── orchestration-state.json

specs/
├── 001-feature-name/
│   ├── spec.md
│   ├── plan.md
│   ├── tasks.md
│   └── checklists/
└── 002-next-feature/
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Branch | `NNN-kebab-case` | `001-user-auth` |
| Spec directory | `specs/NNN-name/` | `specs/001-setup/` |
| Phase number | 3 digits | `001`, `002`, `003` |

---

## Abbreviations

| Abbrev | Full |
|--------|------|
| MVP | Minimum Viable Product |
| POC | Proof of Concept |
| CLI | Command-Line Interface |
| ADR | Architecture Decision Record |
| FR | Functional Requirement |
