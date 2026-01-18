# Glossary

> Domain terminology, artifact types, and SpecFlow-specific concepts.

**Last Updated**: 2026-01-18

---

## Core Concepts

| Term | Definition |
|------|------------|
| **SDD** | Spec-Driven Development - methodology prioritizing specification before implementation |
| **Phase** | A discrete feature/deliverable in the roadmap, numbered using ABBC format (0010, 0020, 0021) |
| **Orchestration** | Automated execution of the full SpecFlow workflow (design → verify, 4 steps) |
| **Memory Documents** | Project-level docs capturing decisions and principles in `.specify/memory/` |
| **Discovery** | Codebase examination and clarifying questions BEFORE writing specs |
| **PDR** | Product Decision Record - documents WHAT to build and WHY, not HOW |
| **ABBC** | Phase numbering format: A=milestone, BB=phase, C=hotfix (e.g., 0010, 0021) |
| **USER GATE** | Verification checkpoint requiring explicit user approval before proceeding |
| **Hotfix** | Urgent phase inserted between existing phases using ABBC C-digit (0021 after 0020) |

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
| `pdr-*.md` | Product Decision Record (feature requirements) | `.specify/memory/pdrs/` |

---

## Workflow Steps

| Step | Purpose | Output |
|------|---------|--------|
| DISCOVER | Examine codebase, ask clarifying questions | `discovery.md` |
| SPECIFY | Create feature specification | `spec.md` |
| CLARIFY | Resolve remaining ambiguities (max 5 questions) | Updated `spec.md` |
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
| `/flow.init` | Project initialization with discovery interview |
| `/flow.orchestrate` | Full automated workflow with state persistence |
| `/flow.design` | Create all design artifacts (spec, plan, tasks, checklists) |
| `/flow.analyze` | Cross-artifact consistency validation |
| `/flow.implement` | Execute tasks with TDD workflow |
| `/flow.verify` | Verify completion and compliance |
| `/flow.merge` | Complete phase (push, PR, merge) |
| `/flow.memory` | Verify and reconcile memory documents |
| `/flow.roadmap` | Create or update ROADMAP.md |
| `/flow.review` | Systematic code review with phase creation |

### CLI Commands (Terminal)

| Command | Purpose |
|---------|---------|
| `specflow status` | Complete project status in single call |
| `specflow next` | Next actionable task with full context |
| `specflow mark <id>` | Mark task(s) or checklist item(s) complete |
| `specflow check` | Deep validation with auto-fix support |
| `specflow state` | Low-level state access (get/set/show/init/sync) |
| `specflow phase` | Phase lifecycle (open/close/status/defer/add) |

### CLI Options

All CLI commands support:
- `--json` - Machine-readable JSON output
- `--help` - Command help

Common patterns:
- `specflow mark T001 T002 T003` - Mark multiple items
- `specflow mark T001..T005` - Mark range of tasks
- `specflow mark V-001` - Mark verification checklist item
- `specflow phase open --hotfix` - Create hotfix phase
- `specflow check --fix` - Auto-fix detected issues
- `specflow check --gate design` - Check specific gate

---

## Directory Structure

```
.specify/
├── memory/                 # Memory documents
│   ├── constitution.md     # (REQUIRED)
│   └── *.md                # Other memory docs
├── discovery/              # Discovery phase artifacts (discovery.md)
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
| Branch | `NNNN-kebab-case` | `0010-user-auth` |
| Spec directory | `specs/NNNN-name/` | `specs/0010-setup/` |
| Phase number | 4-digit ABBC format | `0010`, `0020`, `0021` |

---

## Abbreviations

| Abbrev | Full |
|--------|------|
| MVP | Minimum Viable Product |
| POC | Proof of Concept |
| CLI | Command-Line Interface |
| ADR | Architecture Decision Record |
| FR | Functional Requirement |
