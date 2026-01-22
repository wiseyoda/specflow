'use client';

/**
 * Workflow Skill Picker component
 *
 * Renders a dropdown sub-menu with secondary workflow actions.
 * Used within ActionsMenu to provide "Run Workflow" with skill selection.
 *
 * Per Phase 1055 spec (Section 8): Shows only Orchestrate, Merge, Review, Memory.
 * Individual workflow steps (Design, Analyze, Implement, Verify) are part of
 * "Complete Phase" orchestration and are NOT shown here.
 */

import * as React from 'react';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Play, Layers, GitMerge, MessageSquareCode, BookOpen } from 'lucide-react';
import { useWorkflowSkills, type WorkflowSkill } from '@/hooks/use-workflow-skills';

export interface WorkflowSkillPickerProps {
  /** Called when a skill is selected */
  onSelectSkill: (skill: WorkflowSkill) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

/**
 * Secondary workflow actions: Orchestrate, Merge, Review, Memory
 *
 * These are the skills that can be run individually outside of the
 * "Complete Phase" orchestration flow.
 */
const SECONDARY_SKILL_IDS = [
  'flow.orchestrate',
  'flow.merge',
  'flow.review',
  'flow.memory',
];

const SKILL_ICONS: Record<string, typeof Layers> = {
  'flow.orchestrate': Layers,
  'flow.merge': GitMerge,
  'flow.review': MessageSquareCode,
  'flow.memory': BookOpen,
};

/**
 * Dropdown sub-menu for selecting a workflow skill
 *
 * Integrates with ActionsMenu as a sub-menu item showing secondary workflows.
 * Per spec: Only shows Orchestrate, Merge, Review, Memory.
 */
export function WorkflowSkillPicker({
  onSelectSkill,
  disabled = false,
}: WorkflowSkillPickerProps) {
  const { skills } = useWorkflowSkills();

  // Filter to only secondary skills (Orchestrate, Merge, Review, Memory)
  const secondarySkills = React.useMemo(() => {
    return SECONDARY_SKILL_IDS
      .map((id) => skills.find((s) => s.id === id))
      .filter((s): s is WorkflowSkill => s !== undefined);
  }, [skills]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        disabled={disabled}
        className="cursor-pointer"
      >
        <Play className="mr-2 h-4 w-4" />
        <span>Run Workflow</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {secondarySkills.map((skill) => {
          const Icon = SKILL_ICONS[skill.id] || Layers;
          return (
            <DropdownMenuItem
              key={skill.id}
              onClick={() => onSelectSkill(skill)}
              className="cursor-pointer py-2"
            >
              <Icon className="mr-2 h-4 w-4 text-neutral-400" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{skill.name}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                  {skill.description}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * Standalone button version of the skill picker
 *
 * For use in project detail header where we need a button instead of sub-menu.
 */
export interface WorkflowSkillPickerButtonProps {
  /** Called when a skill is selected */
  onSelectSkill: (skill: WorkflowSkill) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Whether currently loading */
  isLoading?: boolean;
}
