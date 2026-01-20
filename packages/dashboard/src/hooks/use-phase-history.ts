'use client';

import { useState, useEffect, useCallback } from 'react';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'awaiting_user' | 'blocked';

export interface Phase {
  number: string;
  name: string;
  status: PhaseStatus;
  hasUserGate: boolean;
  verificationGate?: string;
}

interface PhaseHistoryResponse {
  phases: Phase[];
  activePhase: Phase | null;
  progress: {
    total: number;
    completed: number;
  };
  error?: string;
}

interface UsePhaseHistoryResult {
  phases: Phase[];
  activePhase: Phase | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch phase history from ROADMAP.md
 */
export function usePhaseHistory(projectPath: string | null): UsePhaseHistoryResult {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPhases = useCallback(async () => {
    if (!projectPath) {
      setPhases([]);
      setActivePhase(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/phases?projectPath=${encodeURIComponent(projectPath)}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch phases: ${res.status}`);
      }

      const data: PhaseHistoryResponse = await res.json();

      if (data.error && !data.phases?.length) {
        // Only treat as error if no phases returned
        console.warn('Phase history warning:', data.error);
      }

      setPhases(data.phases || []);
      setActivePhase(data.activePhase || null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
      setPhases([]);
      setActivePhase(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchPhases();
  }, [fetchPhases]);

  return {
    phases,
    activePhase,
    isLoading,
    error,
    refresh: fetchPhases,
  };
}
