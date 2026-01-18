# Glossary

> Domain terminology, artifact types, and SpecFlow-specific concepts.

**Last Updated**: 2026-01-11

---

## Core Concepts

| Term | Definition |
|------|------------|
| **SDD** | Spec-Driven Development - methodology prioritizing specification before implementation |
| **Phase** | A discrete feature/deliverable in the roadmap, numbered using ABBC format (0010, 0020, 0021) |
| **Orchestration** | Automated execution of the full SpecFlow workflow (discover → verify, 9 steps) |
| **Memory Documents** | Project-level docs capturing decisions and principles in `.specify/memory/` |
| **Discovery** | Codebase examination and clarifying questions BEFORE writing specs |

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
| `/specflow.start` | Smart entry point |
| `/specflow.init` | Requirements interview |
| `/specflow.orchestrate` | Full automated workflow (9 steps, `--no-discovery` to skip) |
| `/specflow.specify` | Create specification |
| `/specflow.clarify` | Resolve spec ambiguities |
| `/specflow.plan` | Create technical plan |
| `/specflow.tasks` | Generate task list |
| `/specflow.analyze` | Cross-artifact consistency |
| `/specflow.checklist` | Create verification checklist |
| `/specflow.implement` | Execute tasks |
| `/specflow.verify` | Verify completion |
| `/specflow.merge` | Complete phase (push, PR, merge) |
| `/specflow.backlog` | Triage backlog items |
| `/specflow.memory` | Verify/reconcile memory docs |
| `/specflow.memory-init` | Generate memory docs from codebase |

### CLI Commands (Terminal)
| Command | Purpose |
|---------|---------|
| `specflow scaffold` | Create project structure |
| `specflow state` | State management |
| `specflow roadmap` | ROADMAP operations (status, insert, defer, restore) |
| `specflow tasks` | Task operations (mark, status) |
| `specflow context` | Show project context |
| `specflow doctor` | Run diagnostics (shows suggested fix commands) |
| `specflow gate` | Validation gates (specify, plan, tasks, implement) |
| `specflow lessons` | Lessons learned tracking |
| `specflow memory` | Memory document operations |

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
