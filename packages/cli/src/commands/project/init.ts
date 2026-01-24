import { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import chalk from 'chalk';
import { createInitialState, writeState } from '../../lib/state.js';
import {
  getStatePath,
  getManifestPath,
  getSpecflowDir,
  getSpecsDir,
  getRoadmapPath,
  pathExists,
} from '../../lib/paths.js';
import { registerProject } from '../../lib/registry.js';
import {
  setupFullScaffolding,
  createScaffolding,
  syncTemplates,
  ensureHistoryFile,
  ensureConstitution,
} from '../../lib/scaffold.js';
import { createV3Manifest } from '../../lib/migrate.js';
import { output, success, info, warn, header } from '../../lib/output.js';
import { handleError } from '../../lib/errors.js';

/**
 * Output structure for project init command with --json flag
 */
export interface ProjectInitOutput {
  status: 'success' | 'error';
  command: 'project init';
  project: {
    id: string;
    name: string;
    path: string;
  };
  created: {
    specflowDir: boolean;
    stateFile: boolean;
    manifestFile: boolean;
    workflowsDir: boolean;
    specifyDirs: string[];
    specsDir: boolean;
    roadmap: boolean;
    backlog: boolean;
    history: boolean;
    constitution: boolean;
  };
  templates: {
    copied: string[];
    skipped: string[];
  };
  registered: boolean;
  alreadyInitialized: boolean;
  error?: { message: string; hint: string };
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Create ROADMAP.md from template with project name substituted
 */
async function createRoadmap(projectPath: string, projectName: string): Promise<boolean> {
  const roadmapPath = getRoadmapPath(projectPath);

  if (pathExists(roadmapPath)) {
    return false;
  }

  const content = `# ${projectName} Development Roadmap

> **Source of Truth**: This document defines all feature phases, their order, and completion status.
> Work proceeds through phases sequentially. Each phase produces a deployable increment.

**Project**: ${projectName}
**Created**: ${getCurrentDate()}
**Schema Version**: 3.0 (ABBC numbering)
**Status**: Active Development

---

## Phase Numbering

Phases use **ABBC** format:

- **A** = Milestone (0-9) - Major version or project stage
- **BB** = Phase (01-99) - Sequential work within milestone
- **C** = Hotfix (0-9) - Insert slot (0 = main phase, 1-9 = hotfixes/inserts)

**Examples**:

- \`0010\` = Milestone 0, Phase 01, no hotfix
- \`0021\` = Hotfix 1 inserted after Phase 02
- \`1010\` = Milestone 1, Phase 01, no hotfix

This allows inserting urgent work without renumbering existing phases.

---

## Phase Overview

| Phase | Name | Status | Verification Gate |
| ----- | ---- | ------ | ----------------- |
| 0010  | Initial Setup | ⬜ Not Started | Project scaffolding complete |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | **USER GATE** = Requires user verification

---

## Phase Details

Phase details are stored in modular files:

| Location                      | Content                      |
| ----------------------------- | ---------------------------- |
| \`.specify/phases/*.md\`        | Active/pending phase details |
| \`.specify/history/HISTORY.md\` | Archived completed phases    |

To view a specific phase:

\`\`\`bash
specflow phase show 0010
\`\`\`

To list all phases:

\`\`\`bash
specflow phase list
specflow phase list --active
specflow phase list --complete
\`\`\`

---

## Phase Sizing Guidelines

Each phase is designed to be:

- **Completable** in a single agentic coding session (~200k tokens)
- **Independently deployable** (no half-finished features)
- **Verifiable** with clear success criteria
- **Building** on previous phases

If a phase is running long:

1. Cut scope to MVP for that phase
2. Document deferred items in \`specs/[phase]/checklists/deferred.md\`
3. Prioritize verification gate requirements

---

## How to Use This Document

### Starting a Phase

\`\`\`
/flow.orchestrate
\`\`\`

Or manually:

\`\`\`
/flow.design "Phase NNNN - [Phase Name]"
\`\`\`

### After Completing a Phase

1. Run \`/flow.verify\` to verify the phase is complete
2. Run \`/flow.merge\` to close, push, and merge (updates ROADMAP automatically)
3. If USER GATE: get explicit user verification before proceeding

### Adding New Phases

Use SpecFlow commands:

\`\`\`bash
specflow phase add 0025 "new-phase-name"
specflow phase add 0025 "new-phase-name" --user-gate --gate "Description"
specflow phase open --hotfix "Urgent Fix"
\`\`\`
`;

  try {
    await writeFile(roadmapPath, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create BACKLOG.md from template
 */
async function createBacklog(projectPath: string, projectName: string): Promise<boolean> {
  const backlogPath = join(resolve(projectPath), 'BACKLOG.md');

  if (pathExists(backlogPath)) {
    return false;
  }

  const currentDate = getCurrentDate();
  const content = `# ${projectName} Backlog

> Items deferred from phases without a specific target phase assignment.
> Review periodically to schedule into upcoming phases.

**Created**: ${currentDate}
**Last Updated**: ${currentDate}

---

## Priority Legend

| Priority | Meaning | Criteria |
|----------|---------|----------|
| **P1** | High | Core functionality, significant user value |
| **P2** | Medium | Nice-to-have, quality of life improvements |
| **P3** | Low | Future considerations, can wait indefinitely |

---

## Backlog Items

### P1 - High Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|
| (none) | - | - | - |

### P2 - Medium Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|
| (none) | - | - | - |

### P3 - Low Priority

| Item | Source | Reason Deferred | Notes |
|------|--------|-----------------|-------|
| (none) | - | - | - |

---

## Scheduling Guidelines

When planning a new phase, review this backlog:

1. **Check P1 items** - Should any be scheduled for the next phase?
2. **Look for synergies** - Do any backlog items align with planned work?
3. **Update target phases** - Move items from Backlog to specific phases as appropriate
4. **Clean up** - Remove completed items, update priorities as project evolves

---

## History

| Date | Action | Items Affected |
|------|--------|----------------|
| ${currentDate} | Created backlog | Initial setup |
`;

  try {
    await writeFile(backlogPath, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create manifest.json
 */
async function createManifest(projectPath: string, projectName: string): Promise<boolean> {
  const manifestPath = getManifestPath(projectPath);

  if (pathExists(manifestPath)) {
    return false;
  }

  const manifest = createV3Manifest(projectName);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return true;
}

/**
 * Create workflows directory
 */
async function createWorkflowsDir(projectPath: string): Promise<boolean> {
  const workflowsPath = join(getSpecflowDir(projectPath), 'workflows');

  if (pathExists(workflowsPath)) {
    return false;
  }

  await mkdir(workflowsPath, { recursive: true });
  return true;
}

/**
 * Create specs directory
 */
async function createSpecsDir(projectPath: string): Promise<boolean> {
  const specsPath = getSpecsDir(projectPath);

  if (pathExists(specsPath)) {
    return false;
  }

  await mkdir(specsPath, { recursive: true });

  // Create a .gitkeep file to ensure the directory is tracked
  await writeFile(join(specsPath, '.gitkeep'), '');
  return true;
}

/**
 * Format human-readable output for project init command
 */
function formatHumanReadable(result: ProjectInitOutput): string {
  if (result.status === 'error' && result.error) {
    return `Error: ${result.error.message}\nHint: ${result.error.hint}`;
  }

  const lines: string[] = [];

  lines.push(chalk.bold.green('✓ Initialized SpecFlow project'));
  lines.push('');
  lines.push(chalk.bold('Project'));
  lines.push(`  Name: ${result.project.name}`);
  lines.push(`  Path: ${result.project.path}`);
  lines.push('');

  lines.push(chalk.bold('Created'));

  // .specflow/ items
  if (result.created.specflowDir) {
    lines.push(`  ${chalk.green('✓')} .specflow/`);
  }
  if (result.created.stateFile) {
    lines.push(`  ${chalk.green('✓')} .specflow/orchestration-state.json`);
  }
  if (result.created.manifestFile) {
    lines.push(`  ${chalk.green('✓')} .specflow/manifest.json`);
  }
  if (result.created.workflowsDir) {
    lines.push(`  ${chalk.green('✓')} .specflow/workflows/`);
  }

  // .specify/ items
  if (result.created.specifyDirs.length > 0) {
    for (const dir of result.created.specifyDirs) {
      lines.push(`  ${chalk.green('✓')} ${dir}`);
    }
  }

  // Core files
  if (result.created.history) {
    lines.push(`  ${chalk.green('✓')} .specify/history/HISTORY.md`);
  }
  if (result.created.constitution) {
    lines.push(`  ${chalk.green('✓')} .specify/memory/constitution.md`);
  }
  if (result.created.roadmap) {
    lines.push(`  ${chalk.green('✓')} ROADMAP.md`);
  }
  if (result.created.backlog) {
    lines.push(`  ${chalk.green('✓')} BACKLOG.md`);
  }
  if (result.created.specsDir) {
    lines.push(`  ${chalk.green('✓')} specs/`);
  }

  // Templates
  if (result.templates.copied.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Templates Synced'));
    for (const template of result.templates.copied) {
      lines.push(`  ${chalk.green('✓')} ${template}`);
    }
  }

  // Registration
  if (result.registered) {
    lines.push('');
    lines.push(`${chalk.green('✓')} Registered in global project registry`);
  }

  lines.push('');
  lines.push(chalk.bold('Next Steps'));
  lines.push('  1. Edit ROADMAP.md to define your phases');
  lines.push('  2. Edit .specify/memory/constitution.md with project principles');
  lines.push('  3. Run /flow.orchestrate to start your first phase');

  return lines.join('\n');
}

/**
 * Options for the init action
 */
export interface InitOptions {
  force?: boolean;
  name?: string;
}

/**
 * Shared action handler for project initialization
 * Used by both `specflow project init` and `specflow init`
 */
export async function runProjectInit(options: InitOptions): Promise<void> {
  const projectPath = resolve(process.cwd());
  const projectName = options.name ?? basename(projectPath);
    const statePath = getStatePath(projectPath);

    // Initialize result
    const result: ProjectInitOutput = {
      status: 'error',
      command: 'project init',
      project: {
        id: '',
        name: projectName,
        path: projectPath,
      },
      created: {
        specflowDir: false,
        stateFile: false,
        manifestFile: false,
        workflowsDir: false,
        specifyDirs: [],
        specsDir: false,
        roadmap: false,
        backlog: false,
        history: false,
        constitution: false,
      },
      templates: {
        copied: [],
        skipped: [],
      },
      registered: false,
      alreadyInitialized: false,
    };

    try {
      // Check if already initialized
      const alreadyHasState = pathExists(statePath);
      if (alreadyHasState && !options.force) {
        result.alreadyInitialized = true;
        result.error = {
          message: 'Project already initialized',
          hint: 'Use --force to reinitialize',
        };
        output(result, `${chalk.yellow('⚠')} Project already initialized. Use --force to reinitialize.`);
        process.exitCode = 1;
        return;
      }

      // 1. Create .specflow/ directory
      const specflowDir = getSpecflowDir(projectPath);
      if (!pathExists(specflowDir)) {
        await mkdir(specflowDir, { recursive: true });
        result.created.specflowDir = true;
      }

      // 2. Create orchestration-state.json
      const state = createInitialState(projectName, projectPath);
      result.project.id = state.project.id;
      await writeState(state, projectPath);
      result.created.stateFile = true;

      // 3. Create manifest.json
      result.created.manifestFile = await createManifest(projectPath, projectName);

      // 4. Create workflows/ directory
      result.created.workflowsDir = await createWorkflowsDir(projectPath);

      // 5. Create .specify/ scaffolding
      const scaffoldResult = await createScaffolding(projectPath);
      result.created.specifyDirs = scaffoldResult.created;

      // 6. Sync templates
      const templatesResult = await syncTemplates(projectPath);
      result.templates.copied = templatesResult.copied;
      result.templates.skipped = templatesResult.skipped;

      // 7. Create HISTORY.md
      result.created.history = await ensureHistoryFile(projectPath);

      // 8. Create constitution.md
      result.created.constitution = await ensureConstitution(projectPath);

      // 9. Create ROADMAP.md
      result.created.roadmap = await createRoadmap(projectPath, projectName);

      // 10. Create BACKLOG.md
      result.created.backlog = await createBacklog(projectPath, projectName);

      // 11. Create specs/ directory
      result.created.specsDir = await createSpecsDir(projectPath);

      // 12. Register in global registry
      registerProject(state.project.id, projectName, projectPath);
      result.registered = true;

      // Success
      result.status = 'success';

      output(result, formatHumanReadable(result));
    } catch (err) {
      result.error = {
        message: err instanceof Error ? err.message : 'Unknown error',
        hint: 'Check the error message for details',
      };
      output(result, `Error: ${result.error.message}\nHint: ${result.error.hint}`);
      process.exitCode = 1;
    }
}

/**
 * Initialize a new SpecFlow project with full compliance
 *
 * Creates:
 *   .specflow/
 *     orchestration-state.json
 *     manifest.json
 *     workflows/
 *   .specify/
 *     memory/
 *       constitution.md
 *     templates/
 *     phases/
 *     archive/
 *     history/
 *       HISTORY.md
 *     discovery/
 *   ROADMAP.md
 *   BACKLOG.md
 *   specs/
 *
 * Examples:
 *   specflow project init
 *   specflow project init --force
 *   specflow project init --name "My Project"
 */
export const init = new Command('init')
  .description('Initialize a new SpecFlow project with full 3.0 compliance')
  .option('--force', 'Reinitialize even if already initialized')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .action(runProjectInit);
