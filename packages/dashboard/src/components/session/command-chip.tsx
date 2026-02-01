'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Terminal, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface CommandChipProps {
  /** Display name for the command */
  commandName: string;
  /** Full content of the command message */
  fullContent: string;
  /** Optional additional class names */
  className?: string;
}

/**
 * CommandChip component
 *
 * Displays a compact chip representing a workflow command injection.
 * Clicking opens a modal with the full command content.
 */
export function CommandChip({ commandName, fullContent, className }: CommandChipProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Truncate content preview for tooltip
  const previewContent = fullContent.length > 200
    ? fullContent.slice(0, 200) + '...'
    : fullContent;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        title={`Click to view: ${previewContent}`}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
          'bg-accent/10 text-accent border border-accent/20',
          'hover:bg-accent/20 transition-colors cursor-pointer',
          className
        )}
      >
        <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{commandName}</span>
        <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
      </button>

      {/* Command content modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col bg-surface-100 border-surface-300">
          <DialogHeader className="flex-shrink-0 border-b border-surface-300 pb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-accent" />
              <DialogTitle className="text-white">
                {commandName}
              </DialogTitle>
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Skill prompt injected into the session
            </p>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="py-4">
              <MarkdownContent content={fullContent} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
