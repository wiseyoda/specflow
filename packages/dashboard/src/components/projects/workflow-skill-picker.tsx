'use client';

/**
 * Workflow Skill Picker component
 *
 * Renders a dropdown sub-menu with all available workflow skills.
 * Used within ActionsMenu to provide "Start Workflow" with skill selection.
 */

import * as React from 'react';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Play } from 'lucide-react';
import { getSkillsByGroup, type WorkflowSkill } from '@/lib/workflow-skills';

export interface WorkflowSkillPickerProps {
  /** Called when a skill is selected */
  onSelectSkill: (skill: WorkflowSkill) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

/**
 * Dropdown sub-menu for selecting a workflow skill
 *
 * Integrates with ActionsMenu as a sub-menu item showing all /flow.* skills
 * with descriptions visible on hover/focus.
 */
export function WorkflowSkillPicker({
  onSelectSkill,
  disabled = false,
}: WorkflowSkillPickerProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        disabled={disabled}
        className="cursor-pointer"
      >
        <Play className="mr-2 h-4 w-4" />
        <span>Start Workflow</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 max-h-80 overflow-y-auto">
        {/* Primary skills - Orchestrate & Merge */}
        {getSkillsByGroup('primary').map((skill) => (
          <DropdownMenuItem
            key={skill.id}
            onClick={() => onSelectSkill(skill)}
            className="cursor-pointer py-2"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {skill.name}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                {skill.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Workflow steps */}
        <DropdownMenuLabel className="text-[10px] text-neutral-400 uppercase tracking-wide py-1">
          Workflow Steps
        </DropdownMenuLabel>
        {getSkillsByGroup('workflow').map((skill) => (
          <DropdownMenuItem
            key={skill.id}
            onClick={() => onSelectSkill(skill)}
            className="cursor-pointer py-1.5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">{skill.name}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                {skill.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Setup & Maintenance */}
        <DropdownMenuLabel className="text-[10px] text-neutral-400 uppercase tracking-wide py-1">
          Setup & Maintenance
        </DropdownMenuLabel>
        {[...getSkillsByGroup('setup'), ...getSkillsByGroup('maintenance')].map((skill) => (
          <DropdownMenuItem
            key={skill.id}
            onClick={() => onSelectSkill(skill)}
            className="cursor-pointer py-1.5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">{skill.name}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                {skill.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
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
