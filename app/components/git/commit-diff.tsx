'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import { DiffResult } from '@/lib/api/client';
import { DiffViewer } from './diff-viewer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitCommitIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommitDiffProps {
  fromCommit: string;
  toCommit: string;
  className?: string;
}

export function CommitDiff({ fromCommit, toCommit, className }: CommitDiffProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffResults, setDiffResults] = useState<DiffResult[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const api = getApiClient();

  const loadCommitDiff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await api.gitSync.getCommitDiff(fromCommit, toCommit);
      setDiffResults(results);
      // Expand all files by default
      setExpandedFiles(new Set(results.map(r => r.file_path).filter((path): path is string => path !== undefined)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commit diff');
      setDiffResults([]);
    } finally {
      setLoading(false);
    }
  }, [api, fromCommit, toCommit]);

  useEffect(() => {
    loadCommitDiff();
  }, [loadCommitDiff]);

  const toggleFileExpansion = useCallback((filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  }, [expandedFiles]);

  const expandAll = useCallback(() => {
    setExpandedFiles(new Set(diffResults.map(r => r.file_path).filter((p): p is string => p !== undefined)));
  }, [diffResults]);

  const collapseAll = useCallback(() => {
    setExpandedFiles(new Set());
  }, []);

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

  if (diffResults.length === 0) {
    return (
      <Alert className={className}>
        <AlertDescription>No differences found between commits</AlertDescription>
      </Alert>
    );
  }

  const totalStats = calculateTotalStats(diffResults);

  return (
    <div className={className}>
      <div className="diff-header mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitCommitIcon className="w-4 h-4" />
            <span className="font-medium">
              Comparing {fromCommit.substring(0, 7)} → {toCommit.substring(0, 7)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <span>{diffResults.length} files changed</span>
              <span className="text-green-600 dark:text-green-400">
                +{totalStats.additions}
              </span>
              <span className="text-red-600 dark:text-red-400">
                -{totalStats.deletions}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'unified' | 'split')}>
            <TabsList className="grid w-full max-w-[200px] grid-cols-2">
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse all
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {diffResults.map((diffResult) => {
          const filePath = diffResult.file_path || '';
          const isExpanded = expandedFiles.has(filePath);
          const fileStats = calculateDiffStats(diffResult);
          
          return (
            <div key={filePath} className="border rounded-md">
              <button
                onClick={() => toggleFileExpansion(filePath)}
                className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                  <span className="font-mono text-sm">{filePath}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
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
                  />
                </div>
              )}
            </div>
          );
        })}
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