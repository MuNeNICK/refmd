'use client';

import { useState, useEffect } from 'react';
import { getApiClient } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { DiffResult } from '@/lib/api/client';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    fetchCommitDiff();
  }, [commitId]);

  const fetchCommitDiff = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get diff between parent and this commit
      const parentCommit = commitId + '^';
      const diffResults = await api.gitSync.getCommitDiff(parentCommit, commitId);
      setDiffs(diffResults);
      
      // Auto-expand all files by default
      setExpandedFiles(new Set(diffResults.map(d => d.file_path)));
    } catch (err) {
      console.error('Failed to fetch commit diff:', err);
      setError('Failed to load commit changes');
    } finally {
      setLoading(false);
    }
  };

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

  const getDiffStats = (diff: DiffResult) => {
    let additions = 0;
    let deletions = 0;
    
    diff.diff_lines.forEach(line => {
      if (line.line_type === 'added') additions++;
      else if (line.line_type === 'deleted') deletions++;
    });
    
    return { additions, deletions };
  };

  const getLineTypeClass = (lineType: string | undefined) => {
    switch (lineType) {
      case 'added':
        return 'bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-100';
      case 'deleted':
        return 'bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-100';
      default:
        return '';
    }
  };

  const getLinePrefix = (lineType: string | undefined) => {
    switch (lineType) {
      case 'added':
        return '+';
      case 'deleted':
        return '-';
      default:
        return ' ';
    }
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
          const { additions, deletions } = getDiffStats(diff);
          const isExpanded = expandedFiles.has(diff.file_path);

          return (
            <div key={diff.file_path} className="border rounded-lg">
              <button
                className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors"
                onClick={() => toggleFile(diff.file_path)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="font-mono text-sm flex-1 text-left truncate">
                  {diff.file_path}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-600 dark:text-green-400">
                    +{additions}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    -{deletions}
                  </span>
                </div>
              </button>

              {isExpanded && diff.diff_lines.length > 0 && (
                <div className="border-t">
                  <div className="font-mono text-xs overflow-x-auto">
                    <table className="w-full">
                      <tbody>
                        {diff.diff_lines.map((line, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              'hover:bg-accent/25',
                              getLineTypeClass(line.line_type)
                            )}
                          >
                            <td className="w-12 px-2 py-0.5 text-right text-muted-foreground select-none">
                              {line.old_line_number || ''}
                            </td>
                            <td className="w-12 px-2 py-0.5 text-right text-muted-foreground select-none">
                              {line.new_line_number || ''}
                            </td>
                            <td className="px-2 py-0.5 select-none">
                              {getLinePrefix(line.line_type)}
                            </td>
                            <td className="px-2 py-0.5 whitespace-pre-wrap break-all">
                              {line.content}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}