'use client';

/**
 * Session Viewer Drawer component
 *
 * Slide-out panel for viewing Claude session messages in real-time.
 * Displays user and assistant messages with auto-scroll behavior.
 */

import * as React from 'react';
import { Terminal, Clock, FileCode, FolderOpen, AlertCircle, Loader2, Send } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionContentExtended } from '@/hooks/use-session-content';
import { SessionMessageDisplay } from '../session/session-message';
import { SessionPendingState } from './session-pending-state';
import { TodoPanel } from '../session/todo-panel';

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
  /** Callback to resume this session with a follow-up message */
  onResumeSession?: (sessionId: string, followUp: string) => Promise<void>;
  /** Whether a resume operation is in progress */
  isResuming?: boolean;
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
  onResumeSession,
  isResuming = false,
}: SessionViewerDrawerProps) {
  // Session content from SSE (no polling)
  const {
    messages,
    filesModified,
    elapsed,
    isLoading,
    currentTodos,
  } = useSessionContentExtended(sessionId, projectPath);

  // SSE provides real-time data - no separate error/activeSessionId needed
  const error = null;
  const activeSessionId = sessionId;

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const lastMessageCountRef = React.useRef(0);

  // Follow-up input state for historical sessions
  const [followUpText, setFollowUpText] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  // Use explicit session ID (no auto-discovery - Phase 1053)
  const effectiveSessionId = sessionId;
  const hasSession = projectPath && effectiveSessionId;
  const hasMessages = messages.length > 0;
  // Show pending state when active but no session ID yet
  const isPending = isActive && projectPath && !effectiveSessionId;
  // Show follow-up input for historical (non-active) sessions with messages
  const showFollowUpInput = hasSession && hasMessages && !isActive && onResumeSession;

  // Handle follow-up submission
  const handleFollowUpSubmit = React.useCallback(async () => {
    if (!followUpText.trim() || !effectiveSessionId || !onResumeSession) return;
    try {
      await onResumeSession(effectiveSessionId, followUpText.trim());
      setFollowUpText(''); // Clear input on success
    } catch {
      // Error handling is done in parent component
    }
  }, [followUpText, effectiveSessionId, onResumeSession]);

  // Handle Enter key in input
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isResuming) {
      e.preventDefault();
      handleFollowUpSubmit();
    }
  }, [handleFollowUpSubmit, isResuming]);

  // Clear follow-up text when session changes
  React.useEffect(() => {
    setFollowUpText('');
  }, [sessionId]);

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
              <span>{filesModified.length} file{filesModified.length !== 1 ? 's' : ''} modified</span>
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
          {isPending ? (
            <SessionPendingState />
          ) : isLoading ? (
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

        {/* Todo panel */}
        {currentTodos.length > 0 && (
          <TodoPanel todos={currentTodos} />
        )}

        {/* Follow-up input for historical sessions */}
        {showFollowUpInput && (
          <div className="pt-3 border-t border-neutral-800">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Send a follow-up message..."
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isResuming}
                className="flex-1 bg-neutral-900 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
              />
              <Button
                onClick={handleFollowUpSubmit}
                disabled={!followUpText.trim() || isResuming}
                size="icon"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isResuming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              This will resume the session with your message
            </p>
          </div>
        )}

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
