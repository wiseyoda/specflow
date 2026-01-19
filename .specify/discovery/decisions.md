# Requirements Decisions Log

> Decisions captured from codebase analysis and project history. These feed into memory document generation.

## Decision Index
| ID | Phase | Title | Confidence | Memory Doc Impact |
|----|-------|-------|------------|-------------------|
| D-1 | 0: Discovery | Project Type: CLI + Dashboard Monorepo | High | tech-stack.md |
| D-2 | 0: Discovery | Target Users: Solo Developers with Claude Code | High | constitution.md |
| D-3 | 0: Discovery | Project Stage: Active Development v3.0 | High | context.md |
| D-4 | 1: Problem & Vision | Core Problem: AI-assisted Development Lacks Structure | High | constitution.md |
| D-5 | 5: Architecture | Architecture: TypeScript CLI with Next.js Dashboard | High | tech-stack.md, coding-standards.md |
| D-6 | 5: Architecture | State Management: JSON File at .specify/orchestration-state.json | High | tech-stack.md |
| D-7 | 5: Architecture | Monorepo Structure: packages/cli, shared, dashboard | High | tech-stack.md |
| D-8 | 7: UX | CLI Output: Three-Line Rule for Critical Info | High | constitution.md, coding-standards.md |
| D-9 | 7: UX | Dashboard Aesthetic: Linear-Inspired | High | tech-stack.md |
| D-10 | 9: Testing | Testing Framework: Vitest with memfs | High | testing-strategy.md |
| D-11 | 3: Functional | Workflow Steps: 9-step orchestrated flow | High | glossary.md |
| D-12 | 5: Architecture | Command Prefix: /flow.* for all slash commands | High | glossary.md |
| D-13 | 5: Architecture | CLI Binary Name: specflow | High | tech-stack.md |
| D-14 | 4: Non-Functional | Local-First: No cloud dependencies | High | constitution.md, tech-stack.md |
| D-15 | 5: Architecture | Phase Numbering: ABBC format (0010, 0020, 0021) | High | glossary.md |

## Progress
- **Decisions Made**: 15
- **Open Questions**: 0
- **Contradictions**: 0

---
<!-- Decisions below -->

#### D-1: Project Type: CLI + Dashboard Monorepo
- **Phase**: 0: Discovery
- **Status**: Decided
- **Confidence**: High
- **Context**: Initial project architecture decision
- **Decision**: SpecFlow is a monorepo containing a TypeScript CLI (`packages/cli`), shared types (`packages/shared`), and a Next.js dashboard (`packages/dashboard`)
- **Alternatives**: Single package CLI rejected (dashboard planned from early milestone); separate repos rejected (shared types needed)
- **Consequences**: Enables shared Zod schemas, requires pnpm workspace management, allows incremental milestone delivery
- **Memory Doc Impact**: tech-stack.md

---

#### D-2: Target Users: Solo Developers with Claude Code
- **Phase**: 0: Discovery
- **Status**: Decided
- **Confidence**: High
- **Context**: User research and product positioning
- **Decision**: Primary users are individual developers using Claude Code for AI-assisted development
- **Alternatives**: Team-oriented tooling considered but deferred; enterprise features not prioritized
- **Consequences**: Local-first architecture, no auth requirements, single-user state management
- **Memory Doc Impact**: constitution.md

---

#### D-3: Project Stage: Active Development v3.0
- **Phase**: 0: Discovery
- **Status**: Decided
- **Confidence**: High
- **Context**: Project history shows evolution from SpecKit to SpecFlow
- **Decision**: Currently at v3.0.0, with ~16 phases complete (Milestone 0 complete, Milestone 1 ~50%)
- **Alternatives**: N/A - observed state
- **Consequences**: Established patterns exist, backward compatibility matters, ROADMAP.md is source of truth
- **Memory Doc Impact**: context.md

---

#### D-4: Core Problem: AI-assisted Development Lacks Structure
- **Phase**: 1: Problem & Vision
- **Status**: Decided
- **Confidence**: High
- **Context**: Why SpecFlow exists
- **Decision**: AI coding tools need structured workflows to produce consistent, high-quality output. SpecFlow provides spec-driven development methodology for Claude Code.
- **Alternatives**: Ad-hoc prompting, other frameworks
- **Consequences**: Defines 9-step workflow, requires memory documents for context, phases sized for ~200k token sessions
- **Memory Doc Impact**: constitution.md

---

#### D-5: Architecture: TypeScript CLI with Next.js Dashboard
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: Evolution from pure bash to TypeScript (Phase 0080)
- **Decision**: CLI in TypeScript (Commander.js, Zod, chalk), dashboard in Next.js 16 with React 19
- **Alternatives**: Bash-only rejected (testing limitations, no shared types); Electron rejected (overkill for dev tool)
- **Consequences**: Node.js 20+ required, pnpm for package management, strict TypeScript mode
- **Memory Doc Impact**: tech-stack.md, coding-standards.md

---

#### D-6: State Management: JSON File at .specify/orchestration-state.json
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: Need to track workflow progress across Claude sessions
- **Decision**: Single JSON file stores orchestration state, validated with Zod schemas
- **Alternatives**: SQLite rejected (overkill for single-user); YAML rejected (harder to parse reliably)
- **Consequences**: State is project-local, easy to inspect/debug, requires CLI commands for mutations
- **Memory Doc Impact**: tech-stack.md

---

#### D-7: Monorepo Structure: packages/cli, shared, dashboard
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: Need shared types between CLI and dashboard
- **Decision**: pnpm workspaces with three packages: @specflow/cli, @specflow/shared, @specflow/dashboard
- **Alternatives**: Single package rejected (dashboard needs different build); separate repos rejected (type sharing needed)
- **Consequences**: Requires `pnpm --filter` for targeted builds, shared package must build first
- **Memory Doc Impact**: tech-stack.md

---

#### D-8: CLI Output: Three-Line Rule for Critical Info
- **Phase**: 7: UX
- **Status**: Decided
- **Confidence**: High
- **Context**: Claude Code CLI only shows 3 lines by default
- **Decision**: Constitution Principle VII requires user-critical information in first 3 lines: Line 1 (status + result), Line 2 (key data), Line 3 (next step)
- **Alternatives**: Verbose output rejected (truncated in Claude); headers-first rejected (wastes space)
- **Consequences**: All CLI output formatted with summary first, no decorative headers in first 3 lines
- **Memory Doc Impact**: constitution.md, coding-standards.md

---

#### D-9: Dashboard Aesthetic: Linear-Inspired
- **Phase**: 7: UX
- **Status**: Decided
- **Confidence**: High
- **Context**: Dashboard design direction
- **Decision**: Linear-inspired design: clean, fast, keyboard-driven with dark mode, Cmd+K command palette
- **Alternatives**: Notion-style rejected (too document-focused); GitHub-style rejected (too dense)
- **Consequences**: shadcn/ui components, Tailwind CSS, vim-style navigation shortcuts
- **Memory Doc Impact**: tech-stack.md

---

#### D-10: Testing Framework: Vitest with memfs
- **Phase**: 9: Testing
- **Status**: Decided
- **Confidence**: High
- **Context**: Need fast, ESM-native testing for TypeScript CLI
- **Decision**: Vitest for test runner, memfs for file system mocking, no actual file system operations in tests
- **Alternatives**: Jest rejected (slower, CJS-focused); tape rejected (less feature-rich)
- **Consequences**: Tests run fast in isolation, coverage via @vitest/coverage-v8
- **Memory Doc Impact**: testing-strategy.md

---

#### D-11: Workflow Steps: 9-step orchestrated flow
- **Phase**: 3: Functional
- **Status**: Decided
- **Confidence**: High
- **Context**: Core SpecFlow workflow definition
- **Decision**: 9 steps: DISCOVER → SPECIFY → CLARIFY → PLAN → TASKS → ANALYZE → CHECKLIST → IMPLEMENT → VERIFY
- **Alternatives**: Fewer steps rejected (lost granularity); more steps rejected (complexity)
- **Consequences**: Orchestrate command manages state through all steps, state.json tracks current position
- **Memory Doc Impact**: glossary.md

---

#### D-12: Command Prefix: /flow.* for all slash commands
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: Rebrand from SpecKit to SpecFlow (Phase 0076)
- **Decision**: All slash commands use `/flow.*` prefix (e.g., /flow.orchestrate, /flow.design)
- **Alternatives**: /flow.* rejected (old brand); no prefix rejected (conflicts with other tools)
- **Consequences**: 10 slash commands total, clean break from old naming, no deprecation stubs
- **Memory Doc Impact**: glossary.md

---

#### D-13: CLI Binary Name: specflow
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: Terminal CLI naming (Phase 0076)
- **Decision**: CLI binary is `specflow` (e.g., `specflow status`, `specflow next`)
- **Alternatives**: `flow` rejected (too generic, conflicts); `sf` rejected (Salesforce conflict)
- **Consequences**: All CLI commands use `specflow` prefix, bin/specflow is hybrid dispatcher
- **Memory Doc Impact**: tech-stack.md

---

#### D-14: Local-First: No cloud dependencies
- **Phase**: 4: Non-Functional
- **Status**: Decided
- **Confidence**: High
- **Context**: Deployment and data architecture
- **Decision**: All data stored locally in project directory (.specify/) and user home (~/.specflow/), no cloud services required
- **Alternatives**: Cloud sync rejected (complexity, privacy concerns); SaaS rejected (monetization not priority)
- **Consequences**: Works offline, data portable, no account required
- **Memory Doc Impact**: constitution.md, tech-stack.md

---

#### D-15: Phase Numbering: ABBC format (0010, 0020, 0021)
- **Phase**: 5: Architecture
- **Status**: Decided
- **Confidence**: High
- **Context**: ROADMAP.md phase organization
- **Decision**: 4-digit ABBC format: A=milestone, BB=phase, C=hotfix slot (0=main, 1-9=hotfixes)
- **Alternatives**: Simple sequential rejected (can't insert); semantic versioning rejected (phases aren't versions)
- **Consequences**: Phases 0010, 0020, etc. for main work; 0021, 0022 for hotfixes after 0020
- **Memory Doc Impact**: glossary.md

---
