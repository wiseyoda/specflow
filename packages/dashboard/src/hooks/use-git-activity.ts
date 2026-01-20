'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GitActivity {
  type: 'commit' | 'task' | 'file';
  description: string;
  timestamp: string;
  hash?: string;
  author?: string;
}

interface UseGitActivityResult {
  activities: GitActivity[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch recent git activity for a project
 */
export function useGitActivity(projectPath: string | null, limit = 20): UseGitActivityResult {
  const [activities, setActivities] = useState<GitActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!projectPath) {
      setActivities([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/git/activity?projectPath=${encodeURIComponent(projectPath)}&limit=${limit}`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch git activity: ${res.status}`);
      }

      const data = await res.json();
      setActivities(data.activities || []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    activities,
    isLoading,
    error,
    refresh: fetchActivity,
  };
}
