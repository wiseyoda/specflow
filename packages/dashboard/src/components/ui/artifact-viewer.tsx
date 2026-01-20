'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { useArtifactContent } from '@/hooks/use-artifact-content';
import { Loader2, FileText, ExternalLink, AlertCircle } from 'lucide-react';

interface ArtifactViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifactPath: string | null;
  artifactName?: string;
}

export function ArtifactViewer({
  open,
  onOpenChange,
  artifactPath,
  artifactName,
}: ArtifactViewerProps) {
  const { artifact, isLoading, error, fetchArtifact, clearArtifact } =
    useArtifactContent();

  useEffect(() => {
    if (open && artifactPath) {
      fetchArtifact(artifactPath);
    } else if (!open) {
      clearArtifact();
    }
  }, [open, artifactPath, fetchArtifact, clearArtifact]);

  const handleOpenInEditor = () => {
    if (artifactPath) {
      window.open(`vscode://file${artifactPath}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-surface-100 border-surface-300">
        <DialogHeader className="flex-shrink-0 border-b border-surface-300 pb-4">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-accent" />
              <DialogTitle className="text-white">
                {artifact?.title || artifactName || 'Artifact'}
              </DialogTitle>
            </div>
            {artifactPath && (
              <button
                onClick={handleOpenInEditor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in VS Code
              </button>
            )}
          </div>
          {artifactPath && (
            <p className="text-xs text-surface-500 font-mono mt-1 truncate">
              {artifactPath}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-danger mb-3" />
              <p className="text-sm text-danger font-medium">
                Failed to load artifact
              </p>
              <p className="text-xs text-surface-500 mt-1">{error.message}</p>
            </div>
          ) : artifact?.content ? (
            <MarkdownContent content={artifact.content} />
          ) : (
            <div className="flex items-center justify-center py-12 text-surface-500">
              No content available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
