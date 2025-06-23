'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import { DiffResult } from '@/lib/api/client';
import { DiffViewer } from './diff-viewer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileIcon, GitBranchIcon } from 'lucide-react';
import { getDiffStats } from '@/lib/git/diff-utils';

interface FileDiffProps {
  filePath: string;
  className?: string;
}

export function FileDiff({ filePath, className }: FileDiffProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const api = getApiClient();

  const loadFileDiff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.gitSync.getFileDiff(filePath);
      setDiffResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file diff');
      setDiffResult(null);
    } finally {
      setLoading(false);
    }
  }, [api, filePath]);

  useEffect(() => {
    loadFileDiff();
  }, [loadFileDiff]);

  if (loading) {
    return (
      <div className={className}>
        <Skeleton className="h-8 mb-2" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!diffResult) {
    return (
      <Alert className={className}>
        <AlertDescription>No diff data available</AlertDescription>
      </Alert>
    );
  }

  const hasChanges = diffResult.diff_lines && diffResult.diff_lines.length > 0;
  const stats = getDiffStats(diffResult);

  return (
    <div className={className}>
      <div className="diff-header mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileIcon className="w-4 h-4" />
            <span className="font-medium">{filePath}</span>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 dark:text-green-400">
                +{stats.additions}
              </span>
              <span className="text-red-600 dark:text-red-400">
                -{stats.deletions}
              </span>
            </div>
          )}
        </div>
        
        {hasChanges && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'unified' | 'split')}>
            <TabsList className="grid w-full max-w-[200px] grid-cols-2">
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {hasChanges ? (
        <DiffViewer
          diffResult={diffResult}
          viewMode={viewMode}
          className="border rounded-md overflow-hidden"
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <GitBranchIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No changes in this file</p>
        </div>
      )}
    </div>
  );
}

