'use client';

/**
 * Session History List component
 *
 * Displays a table of past sessions for a project.
 * Allows clicking to view session details and shows active status.
 */

import * as React from 'react';
import { Clock, Terminal, AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { WorkflowIndexEntry } from '@/lib/services/workflow-service';

export interface SessionHistoryListProps {
  /** List of sessions to display */
  sessions: WorkflowIndexEntry[];
  /** Whether the list is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Currently selected session ID */
  selectedSessionId: string | null;
  /** Callback when a session is clicked */
  onSessionClick: (session: WorkflowIndexEntry) => void;
  /** Callback to refresh the list */
  onRefresh?: () => void;
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format cost for display
 */
function formatCost(costUsd: number): string {
  if (costUsd === 0) return '-';
  if (costUsd < 0.01) return '<$0.01';
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Get status icon and color
 */
function getStatusDisplay(status: WorkflowIndexEntry['status']) {
  switch (status) {
    case 'running':
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-950/30',
        label: 'Running',
      };
    case 'waiting_for_input':
      return {
        icon: <Clock className="h-3.5 w-3.5" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-950/30',
        label: 'Waiting',
      };
    case 'completed':
      return {
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-950/30',
        label: 'Completed',
      };
    case 'failed':
      return {
        icon: <XCircle className="h-3.5 w-3.5" />,
        color: 'text-red-400',
        bgColor: 'bg-red-950/30',
        label: 'Failed',
      };
    case 'cancelled':
      return {
        icon: <XCircle className="h-3.5 w-3.5" />,
        color: 'text-neutral-400',
        bgColor: 'bg-neutral-800/30',
        label: 'Cancelled',
      };
    default:
      return {
        icon: <Terminal className="h-3.5 w-3.5" />,
        color: 'text-neutral-400',
        bgColor: 'bg-neutral-800/30',
        label: 'Unknown',
      };
  }
}

/**
 * Check if session is currently active
 */
function isSessionActive(status: WorkflowIndexEntry['status']): boolean {
  return status === 'running' || status === 'waiting_for_input';
}

/**
 * Empty state when no sessions exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Terminal className="h-10 w-10 text-neutral-600 mb-3" />
      <h3 className="text-sm font-medium text-neutral-300 mb-1">No Sessions Yet</h3>
      <p className="text-xs text-neutral-500 max-w-xs">
        Start a workflow to create your first session.
      </p>
    </div>
  );
}

/**
 * Loading state
 */
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 text-neutral-500 animate-spin" />
    </div>
  );
}

/**
 * Error state
 */
function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
      <h3 className="text-sm font-medium text-neutral-300 mb-1">Failed to Load Sessions</h3>
      <p className="text-xs text-neutral-500 max-w-xs mb-3">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Session row component
 */
function SessionRow({
  session,
  isSelected,
  onClick,
}: {
  session: WorkflowIndexEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusDisplay = getStatusDisplay(session.status);
  const isActive = isSessionActive(session.status);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left',
        isSelected
          ? 'bg-neutral-800 ring-1 ring-neutral-700'
          : 'hover:bg-neutral-900',
      )}
    >
      {/* Active indicator */}
      <div className="flex-shrink-0 w-2">
        {isActive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-200 truncate">
            {session.skill}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
              statusDisplay.bgColor,
              statusDisplay.color,
            )}
          >
            {statusDisplay.icon}
            {statusDisplay.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-neutral-500 truncate font-mono">
            {session.sessionId.slice(0, 8)}...
          </span>
          <span className="text-xs text-neutral-600">|</span>
          <span className="text-xs text-neutral-500">
            {formatDate(session.startedAt)}
          </span>
        </div>
      </div>

      {/* Cost */}
      <div className="flex-shrink-0 text-xs text-neutral-500">
        {formatCost(session.costUsd)}
      </div>
    </button>
  );
}

/**
 * Session History List component
 */
export function SessionHistoryList({
  sessions,
  isLoading,
  error,
  selectedSessionId,
  onSessionClick,
  onRefresh,
}: SessionHistoryListProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRefresh} />;
  }

  if (sessions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Session History
        </span>
        <span className="text-xs text-neutral-500">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map((session) => (
            <SessionRow
              key={session.sessionId}
              session={session}
              isSelected={selectedSessionId === session.sessionId}
              onClick={() => onSessionClick(session)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
