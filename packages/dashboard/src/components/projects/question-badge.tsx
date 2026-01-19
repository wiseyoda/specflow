'use client';

/**
 * Question Badge component
 *
 * Shows a yellow badge with "?" icon and question count.
 * Used on project cards and detail headers when workflow is waiting for input.
 */

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuestionBadgeProps {
  /** Number of pending questions */
  questionCount: number;
  /** Click handler */
  onClick?: () => void;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

const SIZE_CLASSES = {
  sm: {
    container: 'px-2 py-0.5 text-xs gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    container: 'px-2.5 py-1 text-sm gap-1.5',
    icon: 'h-4 w-4',
  },
};

/**
 * Badge showing pending question count for a workflow
 */
export function QuestionBadge({
  questionCount,
  onClick,
  size = 'sm',
  className,
}: QuestionBadgeProps) {
  const classes = SIZE_CLASSES[size];

  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'bg-yellow-100 dark:bg-yellow-900/30',
        'text-yellow-700 dark:text-yellow-400',
        classes.container,
        onClick && 'cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
        className
      )}
      role="status"
      aria-label={`${questionCount} question${questionCount !== 1 ? 's' : ''} pending`}
    >
      <HelpCircle className={classes.icon} />
      {questionCount > 0 && <span>{questionCount}</span>}
    </span>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="focus:outline-none">
        {badge}
      </button>
    );
  }

  return badge;
}
