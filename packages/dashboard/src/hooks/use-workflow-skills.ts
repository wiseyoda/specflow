'use client';

import { useState, useEffect } from 'react';

export interface WorkflowSkill {
  id: string;
  name: string;
  command: string;
  description: string;
  group: 'primary' | 'workflow' | 'setup' | 'maintenance';
  isPrimary?: boolean;
}

interface UseWorkflowSkillsResult {
  skills: WorkflowSkill[];
  isLoading: boolean;
  error: Error | null;
  getSkillsByGroup: (group: WorkflowSkill['group']) => WorkflowSkill[];
  getPrimarySkills: () => WorkflowSkill[];
}

/**
 * Hook to fetch available workflow skills dynamically
 */
export function useWorkflowSkills(): UseWorkflowSkillsResult {
  const [skills, setSkills] = useState<WorkflowSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSkills() {
      try {
        const res = await fetch('/api/workflow/skills');
        if (!res.ok) {
          throw new Error(`Failed to fetch skills: ${res.status}`);
        }
        const data = await res.json();
        if (mounted) {
          setSkills(data.skills || []);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSkills();

    return () => {
      mounted = false;
    };
  }, []);

  const getSkillsByGroup = (group: WorkflowSkill['group']) => {
    return skills.filter((skill) => skill.group === group);
  };

  const getPrimarySkills = () => {
    return skills.filter((skill) => skill.isPrimary);
  };

  return {
    skills,
    isLoading,
    error,
    getSkillsByGroup,
    getPrimarySkills,
  };
}
