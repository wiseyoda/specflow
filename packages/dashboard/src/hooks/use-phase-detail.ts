'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Artifact {
  name: string;
  path: string;
  exists: boolean;
}

export interface PhaseDetail {
  number: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  source: 'history' | 'phase_file' | 'none';
  content: string;
  completedAt?: string;
  goal?: string;
  dependencies?: string;
  complexity?: string;
  artifacts: Artifact[];
  artifactsLocation?: string;
}

interface UsePhaseDetailResult {
  detail: PhaseDetail | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch phase detail content from HISTORY.md or phase file
 */
export function usePhaseDetail(
  projectPath: string | null,
  phaseNumber: string | null,
  phaseName?: string | null
): UsePhaseDetailResult {
  const [detail, setDetail] = useState<PhaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!projectPath || !phaseNumber) {
      setDetail(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let url = `/api/phases/${encodeURIComponent(phaseNumber)}?projectPath=${encodeURIComponent(projectPath)}`;
      if (phaseName) {
        url += `&phaseName=${encodeURIComponent(phaseName)}`;
      }
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to fetch phase detail: ${res.status}`);
      }

      const data = await res.json();
      setDetail(data.phase || null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, phaseNumber, phaseName]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    detail,
    isLoading,
    error,
    refresh: fetchDetail,
  };
}
