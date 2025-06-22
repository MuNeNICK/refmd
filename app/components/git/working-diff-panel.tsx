'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import { DiffResult } from '@/lib/api/client';
import { DiffViewer } from './diff-viewer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  GitBranchIcon, 
  RefreshCwIcon,
  ChevronDownIcon, 
  ChevronRightIcon,
  FileIcon,
  AlertCircleIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkingDiffPanelProps {
  documentPath?: string;
  className?: string;
  onRefresh?: () => void;
}

export function WorkingDiffPanel({ 
  documentPath, 
  className,
  onRefresh 
}: WorkingDiffPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingDiffs, setWorkingDiffs] = useState<DiffResult[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const api = getApiClient();

  const loadDiffs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const working = await api.gitSync.getWorkingDiff();
      setWorkingDiffs(working);
      
      // If documentPath is provided, expand only that file
      if (documentPath) {
        const relevantFiles = working
          .filter(d => d.file_path === documentPath)
          .map(d => d.file_path)
          .filter((path): path is string => path !== undefined);
        setExpandedFiles(new Set(relevantFiles));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diffs');
      setWorkingDiffs([]);
    } finally {
      setLoading(false);
    }
  }, [api, documentPath]);

  useEffect(() => {
    loadDiffs();
  }, [loadDiffs]);

  const handleRefresh = useCallback(async () => {
    await loadDiffs();
    onRefresh?.();
  }, [loadDiffs, onRefresh]);

  const toggleFileExpansion = useCallback((filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  }, [expandedFiles]);

  const relevantDiffs = documentPath 
    ? workingDiffs.filter(d => d.file_path === documentPath)
    : workingDiffs;

  if (loading) {
    return (
      <div className={cn('p-4', className)}>
        <Skeleton className="h-8 mb-2" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={cn('m-4', className)}>
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const totalStats = calculateTotalStats(relevantDiffs);
  const hasChanges = relevantDiffs.length > 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranchIcon className="w-4 h-4" />
            <span className="font-medium">Git Changes</span>
            {documentPath && (
              <span className="text-sm text-muted-foreground">
                for {documentPath}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-8 w-8 p-0"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {workingDiffs.length} file{workingDiffs.length !== 1 ? 's' : ''} with changes
        </div>

        {hasChanges && (
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-600 dark:text-green-400">
                +{totalStats.additions}
              </span>
              <span className="text-red-600 dark:text-red-400">
                -{totalStats.deletions}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'unified' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('unified')}
                className="h-7 px-2 text-xs"
              >
                Unified
              </Button>
              <Button
                variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('split')}
                className="h-7 px-2 text-xs"
              >
                Split
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {hasChanges ? (
          <div className="p-4 space-y-3">
            {relevantDiffs.map((diffResult) => {
              const filePath = diffResult.file_path || '';
              const isExpanded = expandedFiles.has(filePath);
              const fileStats = calculateDiffStats(diffResult);
              
              return (
                <div key={filePath} className="border rounded">
                  <button
                    onClick={() => toggleFileExpansion(filePath)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4" />
                      )}
                      <FileIcon className="w-3 h-3" />
                      <span className="font-mono text-xs truncate">
                        {filePath}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600 dark:text-green-400">
                        +{fileStats.additions}
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{fileStats.deletions}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t">
                      <DiffViewer
                        diffResult={diffResult}
                        viewMode={viewMode}
                        showLineNumbers={true}
                        className=""
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <GitBranchIcon className="w-12 h-12 mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No changes
              {documentPath && ' in this document'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateDiffStats(diffResult: DiffResult) {
  let additions = 0;
  let deletions = 0;

  diffResult.diff_lines?.forEach(line => {
    if (line.line_type === 'added') additions++;
    if (line.line_type === 'deleted') deletions++;
  });

  return { additions, deletions };
}

function calculateTotalStats(diffResults: DiffResult[]) {
  let additions = 0;
  let deletions = 0;

  diffResults.forEach(result => {
    const stats = calculateDiffStats(result);
    additions += stats.additions;
    deletions += stats.deletions;
  });

  return { additions, deletions };
}