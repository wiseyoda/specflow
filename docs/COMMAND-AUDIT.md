# SpecFlow Command Audit

> Updated during v2.0+ maintenance - reflects current command state

## CLI Commands (bin/specflow)

| Command | Script | Status | Notes |
|---------|--------|--------|-------|
| `state` | specflow-state.sh | ✅ Implemented | Full CRUD operations |
| `scaffold` | specflow-scaffold.sh | ✅ Implemented | Project structure creation |
| `context` | specflow-context.sh | ✅ Implemented | Project context (replaced check-prerequisites.sh) |
| `feature` | specflow-feature.sh | ✅ Implemented | Feature management |
| `git` | specflow-git.sh | ✅ Implemented | Branch, commit, merge, push |
| `roadmap` | specflow-roadmap.sh | ✅ Implemented | Status, update, insert, defer, restore, backlog |
| `claude-md` | specflow-claude-md.sh | ✅ Implemented | Update and sync |
| `checklist` | specflow-checklist.sh | ✅ Implemented | Status, list, incomplete |
| `tasks` | specflow-tasks.sh | ✅ Implemented | Mark, status, list |
| `templates` | specflow-templates.sh | ✅ Implemented | Check, update, diff |
| `doctor` | specflow-doctor.sh | ✅ Implemented | Diagnostics, auto-fix |
| `detect` | specflow-detect.sh | ✅ Implemented | Content detection |
| `reconcile` | specflow-reconcile.sh | ✅ Implemented | State/file sync |
| `memory` | specflow-memory.sh | ✅ Implemented | Memory document operations |
| `gate` | specflow-gate.sh | ✅ Implemented | Validation gates (specify, plan, tasks, implement) |
| `lessons` | specflow-lessons.sh | ✅ Implemented | Lessons learned tracking |
| `migrate` | specflow-migrate.sh | ✅ Implemented | ROADMAP format migration |
| `manifest` | specflow-manifest.sh | ✅ Implemented | Version manifest operations |

## Claude Commands (commands/*.md)

### Core Workflow
| Command | Purpose | Status |
|---------|---------|--------|
| `/specflow.start` | Smart entry point | ✅ Active |
| `/specflow.init` | Project initialization (unified interview) | ✅ Active |
| `/specflow.orchestrate` | Full workflow automation | ✅ Active |
| `/specflow.specify` | Create feature specification | ✅ Active |
| `/specflow.clarify` | Resolve specification ambiguities | ✅ Active |
| `/specflow.plan` | Create technical implementation plan | ✅ Active |
| `/specflow.tasks` | Generate actionable task list | ✅ Active |
| `/specflow.analyze` | Cross-artifact consistency check | ✅ Active |
| `/specflow.checklist` | Create verification checklist | ✅ Active |
| `/specflow.implement` | Execute all tasks | ✅ Active |
| `/specflow.verify` | Verify completion and update ROADMAP | ✅ Active |

### Phase Completion
| Command | Purpose | Status |
|---------|---------|--------|
| `/specflow.merge` | Complete phase: push, PR, merge, cleanup | ✅ Active |
| `/specflow.backlog` | Triage backlog items into phases | ✅ Active |

### Memory & Configuration
| Command | Purpose | Status |
|---------|---------|--------|
| `/specflow.constitution` | Create/update project constitution | ✅ Active |
| `/specflow.roadmap` | Create/update ROADMAP.md | ✅ Active |
| `/specflow.memory` | Verify and reconcile memory documents | ✅ Active |
| `/specflow.memory-init` | Generate memory docs from codebase analysis | ✅ Active |

### Utilities
| Command | Purpose | Status |
|---------|---------|--------|
| `/specflow.taskstoissues` | Convert tasks to GitHub issues | ✅ Active (utilities/) |

### Deleted (v2.1)
| Command | Reason | Replacement |
|---------|--------|-------------|
| `/specflow.issue` | CLI works directly | `specflow issue` CLI |

## Archived Commands

The following were consolidated into `/specflow.init` (v2.0):
- ~~`specflow.init-status`~~ → `/specflow.init status`
- ~~`specflow.init-skip`~~ → `/specflow.init skip`
- ~~`specflow.init-pause`~~ → `/specflow.init pause`
- ~~`specflow.init-validate`~~ → `/specflow.init validate`
- ~~`specflow.init-export`~~ → `/specflow.init export`
- ~~`specflow.init-compare`~~ → `/specflow.init compare`
- ~~`specflow.init-deeper`~~ → `/specflow.init deeper`
- ~~`specflow.init-faster`~~ → `/specflow.init faster`
- ~~`specflow.init-focus`~~ → `/specflow.init focus`
- ~~`specflow.init-research`~~ → `/specflow.init research`
- ~~`specflow.init-revisit`~~ → `/specflow.init revisit`

These files have been **deleted** from `commands/archive/` as of v2.0 cleanup.

## Scripts Library

### lib/common.sh
Provides:
- Logging: `log_info`, `log_error`, `log_warn`, `log_success`, `log_debug`, `log_step`
- Paths: `get_repo_root`, `get_specify_dir`, `get_state_file`, `get_specflow_system_dir`
- Validation: `is_git_repo`, `is_specflow_project`, `validate_context`, `validate_specflow_project`
- Utils: `command_exists`, `require_jq`, `ensure_dir`, `file_exists`
- Output: `print_header`, `print_section`, `print_status`, `is_json_output`

### lib/json.sh
Provides:
- JSON operations via jq wrappers
