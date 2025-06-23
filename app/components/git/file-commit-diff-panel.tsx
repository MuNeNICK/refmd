'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { DiffResult } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { DiffViewer } from './diff-viewer';

interface FileCommitDiffPanelProps {
  commitId: string;
  filePath: string;
  className?: string;
  viewMode?: 'unified' | 'split';
  onViewModeChange?: (mode: 'unified' | 'split') => void;
}

export function FileCommitDiffPanel({ 
  commitId, 
  filePath, 
  className,
  viewMode: externalViewMode,
  onViewModeChange
}: FileCommitDiffPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<'unified' | 'split'>('unified');
  const api = getApiClient();
  
  // Use external viewMode if provided, otherwise use internal state
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const fetchFileCommitDiff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get diff for this specific file in the commit
      const parentCommit = commitId + '^';
      const fileDiff = await api.gitSync.getFileCommitDiff(parentCommit, commitId, filePath);
      
      if (fileDiff && fileDiff.diff_lines && fileDiff.diff_lines.length > 0) {
        setDiff(fileDiff);
      } else {
        setError('No changes found for this file in the selected commit');
      }
    } catch (err) {
      console.error('Failed to fetch file commit diff:', err);
      setError('Failed to load file changes');
    } finally {
      setLoading(false);
    }
  }, [api, commitId, filePath]);

  useEffect(() => {
    fetchFileCommitDiff();
  }, [fetchFileCommitDiff]);

  if (loading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!diff) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No changes found for this file</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-mono text-sm">{diff.file_path}</span>
        </div>
        {!externalViewMode && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'unified' | 'split')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <DiffViewer diffResult={diff} viewMode={viewMode} />
        </div>
      </ScrollArea>
    </div>
  );
}