'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { DiffResult } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { getDiffStats } from '@/lib/git/diff-utils';
import { FileExpander } from './file-expander';
import { DiffViewer } from './diff-viewer';

interface CommitDiffPanelProps {
  commitId: string;
  className?: string;
}

export function CommitDiffPanel({ commitId, className }: CommitDiffPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const api = getApiClient();

  const fetchCommitDiff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get diff between parent and this commit
      const parentCommit = commitId + '^';
      const diffResults = await api.gitSync.getCommitDiff(parentCommit, commitId);
      setDiffs(diffResults);
      
      // Auto-expand all files by default
      setExpandedFiles(new Set(diffResults.map(d => d.file_path).filter((path): path is string => path !== undefined)));
    } catch (err) {
      console.error('Failed to fetch commit diff:', err);
      setError('Failed to load commit changes');
    } finally {
      setLoading(false);
    }
  }, [commitId, api]);

  useEffect(() => {
    fetchCommitDiff();
  }, [fetchCommitDiff]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };


  if (loading) {
    return (
      <div className={cn('space-y-4 p-4', className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCommitDiff}
          className="mt-4"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className={cn('p-8 text-center text-muted-foreground', className)}>
        No changes in this commit
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">
            {diffs.length} file{diffs.length !== 1 ? 's' : ''} changed
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchCommitDiff}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {diffs.map((diff) => {
          const stats = getDiffStats(diff);
          const isExpanded = diff.file_path ? expandedFiles.has(diff.file_path) : false;

          return (
            <FileExpander
              key={diff.file_path}
              filePath={diff.file_path || ''}
              isExpanded={isExpanded}
              onToggle={() => diff.file_path && toggleFile(diff.file_path)}
              stats={stats}
            >
              {diff.diff_lines && diff.diff_lines.length > 0 && (
                <div className="p-4">
                  <DiffViewer diffResult={diff} viewMode="unified" />
                </div>
              )}
            </FileExpander>
          );
        })}
      </div>
    </ScrollArea>
  );
}