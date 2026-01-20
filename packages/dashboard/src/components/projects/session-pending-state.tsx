'use client';

/**
 * Session Pending State component
 *
 * Displays a loading state while waiting for session ID to become available.
 * Shown when a workflow has just started but the first CLI response hasn't
 * completed yet.
 */

import { Loader2, Terminal } from 'lucide-react';

/**
 * Loading state shown while waiting for session ID
 */
export function SessionPendingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="relative">
        <Terminal className="h-12 w-12 text-neutral-600 mb-4" />
        <Loader2 className="h-5 w-5 text-green-500 animate-spin absolute -bottom-1 -right-1" />
      </div>
      <h3 className="text-lg font-medium text-neutral-300 mb-2">
        Waiting for Session...
      </h3>
      <p className="text-sm text-neutral-500 max-w-xs">
        Session ID will appear once Claude responds to the first prompt.
        This usually takes a few seconds.
      </p>
    </div>
  );
}
