'use client';

/**
 * Session Message component
 *
 * Displays a single message from a Claude session with role-based styling.
 * User messages have a blue tint, assistant messages have neutral styling.
 */

import * as React from 'react';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionMessage } from '@/lib/session-parser';

export interface SessionMessageProps {
  /** The session message to display */
  message: SessionMessage;
  /** Optional className for customization */
  className?: string;
}

/**
 * Format timestamp to human-readable time
 */
function formatTime(timestamp?: string): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Truncate long content with ellipsis
 */
function truncateContent(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

/**
 * Single message display component
 */
export function SessionMessageDisplay({
  message,
  className,
}: SessionMessageProps) {
  const isUser = message.role === 'user';
  const timeStr = formatTime(message.timestamp);

  return (
    <div
      className={cn(
        'rounded-lg p-3',
        isUser
          ? 'bg-blue-950/50 border-l-2 border-blue-500'
          : 'bg-neutral-900',
        className
      )}
    >
      {/* Header: Role and timestamp */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isUser ? (
            <User className="h-4 w-4 text-blue-400" />
          ) : (
            <Bot className="h-4 w-4 text-neutral-400" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              isUser ? 'text-blue-400' : 'text-neutral-400'
            )}
          >
            {isUser ? 'User' : 'Claude'}
          </span>
        </div>
        {timeStr && (
          <span className="text-xs text-neutral-500">{timeStr}</span>
        )}
      </div>

      {/* Content */}
      <div className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
        {truncateContent(message.content)}
      </div>
    </div>
  );
}
