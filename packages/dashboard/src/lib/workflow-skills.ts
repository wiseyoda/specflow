/**
 * Workflow skill definitions for the dashboard
 * These define the available /flow.* skills that can be executed on projects
 */

export interface WorkflowSkill {
  /** Unique identifier matching the skill command */
  id: string;
  /** Display name for the skill */
  name: string;
  /** Full command to execute (e.g., "/flow.design") */
  command: string;
  /** Short description of what the skill does */
  description: string;
  /** Longer description shown in tooltips/hover */
  longDescription: string;
  /** Whether this is a primary/promoted skill */
  isPrimary?: boolean;
  /** Group for organizing skills */
  group: 'primary' | 'workflow' | 'setup' | 'maintenance';
}

/**
 * Primary skills - prominently displayed at top
 */
const PRIMARY_SKILLS: WorkflowSkill[] = [
  {
    id: 'orchestrate',
    name: 'Orchestrate',
    command: '/flow.orchestrate',
    description: 'Run the complete development workflow',
    longDescription:
      'Runs the complete design → analyze → implement → verify workflow automatically',
    isPrimary: true,
    group: 'primary',
  },
  {
    id: 'merge',
    name: 'Merge',
    command: '/flow.merge',
    description: 'Complete phase and merge to main',
    longDescription:
      'Closes the current phase, pushes changes, and merges to main branch',
    isPrimary: true,
    group: 'primary',
  },
];

/**
 * Workflow skills - individual workflow steps
 */
const WORKFLOW_SKILLS_GROUP: WorkflowSkill[] = [
  {
    id: 'design',
    name: 'Design',
    command: '/flow.design',
    description: 'Create specs, plans, and tasks',
    longDescription:
      'Creates discovery, spec, plan, tasks, and checklists for the current phase',
    group: 'workflow',
  },
  {
    id: 'analyze',
    name: 'Analyze',
    command: '/flow.analyze',
    description: 'Check artifacts for issues',
    longDescription:
      'Analyzes spec, plan, and tasks for inconsistencies and gaps',
    group: 'workflow',
  },
  {
    id: 'implement',
    name: 'Implement',
    command: '/flow.implement',
    description: 'Execute tasks with TDD',
    longDescription:
      'Implements all tasks from tasks.md using test-driven development',
    group: 'workflow',
  },
  {
    id: 'verify',
    name: 'Verify',
    command: '/flow.verify',
    description: 'Verify completion and checklists',
    longDescription:
      'Verifies task completion, memory compliance, and runs checklists',
    group: 'workflow',
  },
  {
    id: 'review',
    name: 'Review',
    command: '/flow.review',
    description: 'Systematic code review',
    longDescription:
      'Performs systematic code reviews and generates actionable findings',
    group: 'workflow',
  },
];

/**
 * Setup skills - project initialization
 */
const SETUP_SKILLS: WorkflowSkill[] = [
  {
    id: 'init',
    name: 'Initialize',
    command: '/flow.init',
    description: 'Set up SpecFlow for project',
    longDescription:
      'Initializes SpecFlow in a project, creating memory documents and configuration',
    group: 'setup',
  },
  {
    id: 'roadmap',
    name: 'Roadmap',
    command: '/flow.roadmap',
    description: 'Create or update ROADMAP.md',
    longDescription:
      'Creates or updates the project roadmap with logical feature phases',
    group: 'setup',
  },
];

/**
 * Maintenance skills - ongoing project health
 */
const MAINTENANCE_SKILLS: WorkflowSkill[] = [
  {
    id: 'memory',
    name: 'Memory',
    command: '/flow.memory',
    description: 'Verify memory documents',
    longDescription:
      'Verifies and optimizes memory documents, reconciles against roadmap and codebase',
    group: 'maintenance',
  },
  {
    id: 'doctor',
    name: 'Doctor',
    command: '/flow.doctor',
    description: 'Diagnose and fix issues',
    longDescription:
      'Diagnoses SpecFlow issues, detects version, and guides through migrations',
    group: 'maintenance',
  },
];

/**
 * All available workflow skills organized by group
 * Primary skills first, then workflow, setup, maintenance
 */
export const WORKFLOW_SKILLS: WorkflowSkill[] = [
  ...PRIMARY_SKILLS,
  ...WORKFLOW_SKILLS_GROUP,
  ...SETUP_SKILLS,
  ...MAINTENANCE_SKILLS,
];

/**
 * Get skills by group
 */
export function getSkillsByGroup(group: WorkflowSkill['group']): WorkflowSkill[] {
  return WORKFLOW_SKILLS.filter((skill) => skill.group === group);
}

/**
 * Get primary skills (orchestrate, merge)
 */
export function getPrimarySkills(): WorkflowSkill[] {
  return WORKFLOW_SKILLS.filter((skill) => skill.isPrimary);
}

/**
 * Get a skill by its ID
 */
export function getSkillById(id: string): WorkflowSkill | undefined {
  return WORKFLOW_SKILLS.find((skill) => skill.id === id);
}

/**
 * Get a skill by its command
 */
export function getSkillByCommand(command: string): WorkflowSkill | undefined {
  return WORKFLOW_SKILLS.find((skill) => skill.command === command);
}
