'use client';

/**
 * Session Viewer Drawer component
 *
 * Slide-out panel for viewing Claude session messages in real-time.
 * Displays user and assistant messages with auto-scroll behavior.
 */

import * as React from 'react';
import { Terminal, Clock, FileCode, FolderOpen, AlertCircle, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSessionMessages } from '@/hooks/use-session-messages';
import { SessionMessageDisplay } from './session-message';

export interface SessionViewerDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Project path for session file lookup */
  projectPath: string | null;
  /** Session ID from workflow execution */
  sessionId: string | null;
  /** Whether the session is currently active (running/waiting) */
  isActive: boolean;
}

/**
 * Format elapsed time in human-readable format
 */
function formatElapsed(ms: number): string {
  if (ms <= 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Empty state when no session is available
 */
function SessionEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <FolderOpen className="h-12 w-12 text-neutral-500 mb-4" />
      <h3 className="text-lg font-medium text-neutral-300 mb-2">
        No Active Session
      </h3>
      <p className="text-sm text-neutral-500 max-w-xs">
        Start a workflow to see session activity here. Messages will appear in
        real-time as Claude works.
      </p>
    </div>
  );
}

/**
 * Error state when session file cannot be found
 */
function SessionErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-medium text-neutral-300 mb-2">
        Session Not Found
      </h3>
      <p className="text-sm text-neutral-500 max-w-xs mb-4">{error}</p>
      <p className="text-xs text-neutral-600">
        The session file may have been moved or deleted. Try starting a new
        workflow.
      </p>
    </div>
  );
}

/**
 * Loading state during initial fetch
 */
function SessionLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Loader2 className="h-8 w-8 text-neutral-500 animate-spin mb-4" />
      <p className="text-sm text-neutral-500">Loading session...</p>
    </div>
  );
}

/**
 * Session viewer drawer component
 */
export function SessionViewerDrawer({
  open,
  onOpenChange,
  projectPath,
  sessionId,
  isActive,
}: SessionViewerDrawerProps) {
  const {
    messages,
    filesModified,
    elapsed,
    isLoading,
    error,
    activeSessionId,
  } = useSessionMessages(projectPath, sessionId, isActive && open);

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const lastMessageCountRef = React.useRef(0);

  // Auto-scroll to bottom when new messages arrive (if autoScroll is enabled)
  React.useEffect(() => {
    if (autoScroll && messages.length > lastMessageCountRef.current) {
      const scrollContainer = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, autoScroll]);

  // Handle scroll to detect user scroll-up (pause auto-scroll)
  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtBottom =
      Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Reset auto-scroll when drawer opens
  React.useEffect(() => {
    if (open) {
      setAutoScroll(true);
    }
  }, [open]);

  // Use discovered session ID if prop is null (auto-discovery)
  const effectiveSessionId = sessionId || activeSessionId;
  const hasSession = projectPath && effectiveSessionId;
  const hasMessages = messages.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[500px] sm:max-w-lg flex flex-col bg-neutral-950"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-neutral-100">
            <Terminal className="h-5 w-5 text-green-500" />
            Session Viewer
          </SheetTitle>
          <SheetDescription className="text-neutral-400">
            Real-time view of Claude session activity
          </SheetDescription>
        </SheetHeader>

        {/* Progress indicators */}
        {hasSession && !error && (
          <div className="flex items-center gap-4 mt-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatElapsed(elapsed)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <FileCode className="h-3.5 w-3.5" />
              <span>{filesModified} file{filesModified !== 1 ? 's' : ''} modified</span>
            </div>
            {isActive && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-400">Live</span>
              </div>
            )}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 mt-2 -mx-6 overflow-hidden">
          {isLoading ? (
            <SessionLoadingState />
          ) : error ? (
            <SessionErrorState error={error} />
          ) : !hasSession ? (
            <SessionEmptyState />
          ) : !hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Terminal className="h-8 w-8 text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500">
                Waiting for messages...
              </p>
            </div>
          ) : (
            <ScrollArea
              ref={scrollAreaRef}
              className="h-full px-6"
              onScrollCapture={handleScroll}
            >
              <div className="space-y-3 py-2">
                {messages.map((msg, i) => (
                  <SessionMessageDisplay key={i} message={msg} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer with auto-scroll indicator */}
        {hasMessages && (
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800 text-xs">
            <span className="text-neutral-500">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setAutoScroll(true);
                const scrollContainer = scrollAreaRef.current?.querySelector(
                  '[data-radix-scroll-area-viewport]'
                );
                if (scrollContainer) {
                  scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
              }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded transition-colors',
                autoScroll
                  ? 'text-green-400 bg-green-950/30'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              )}
            >
              Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
