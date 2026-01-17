"use client"

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ConnectionStatus as ConnectionStatusType } from '@/hooks/use-sse';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
}

/**
 * Connection status indicator with toast notifications
 */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const previousStatus = useRef<ConnectionStatusType | null>(null);

  useEffect(() => {
    // Show toast on status changes (but not on initial mount)
    if (previousStatus.current !== null && previousStatus.current !== status) {
      switch (status) {
        case 'connected':
          toast.success('Connected', {
            description: 'Real-time updates are active',
            duration: 3000,
          });
          break;
        case 'disconnected':
          toast.error('Disconnected', {
            description: 'Attempting to reconnect...',
            duration: 5000,
          });
          break;
        case 'connecting':
          // No toast for connecting state
          break;
      }
    }
    previousStatus.current = status;
  }, [status]);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full transition-colors',
          status === 'connected' && 'bg-green-500',
          status === 'connecting' && 'bg-yellow-500 animate-pulse',
          status === 'disconnected' && 'bg-red-500'
        )}
        title={
          status === 'connected'
            ? 'Connected - receiving live updates'
            : status === 'connecting'
              ? 'Connecting...'
              : 'Disconnected - will reconnect'
        }
      />
    </div>
  );
}
