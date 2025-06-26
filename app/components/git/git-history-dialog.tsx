'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  PanelResizeHandle,
  Panel,
  PanelGroup,
} from '@/components/ui/resizable';
import {
  GitCommit as GitCommitIcon,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  User,
  GitBranch,
  Columns2,
  AlignLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { GitCommit, DiffResult } from '@/lib/api/client';
import { GitDiffDialog } from './git-diff-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getDiffStats } from '@/lib/git/diff-utils';
import { toggleFileExpansion } from '@/lib/git/utils';
import { FileExpander } from './file-expander';
import { DiffViewer } from './diff-viewer';

interface GitHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitHistoryDialog({
  open,
  onOpenChange,
}: GitHistoryDialogProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [commitDiffs, setCommitDiffs] = useState<DiffResult[]>([]);
  const [diffsLoading, setDiffsLoading] = useState(false);
  const [diffsError, setDiffsError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const isMobile = useIsMobile();
  const api = getApiClient();

  const fetchCommits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const commitData = await api.gitSync.getCommitHistory();
      setCommits(commitData);
    } catch (err) {
      setError('Failed to fetch Git commit history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (open) {
      fetchCommits();
    }
  }, [open, fetchCommits]);

  const handleRefresh = useCallback(() => {
    fetchCommits();
  }, [fetchCommits]);

  const fetchCommitDiffs = useCallback(async (commitId: string) => {
    try {
      setDiffsLoading(true);
      setDiffsError(null);
      setCommitDiffs([]);
      
      // Get diff between parent and this commit
      const parentCommit = commitId + '^';
      const diffResults = await api.gitSync.getCommitDiff(parentCommit, commitId);
      setCommitDiffs(diffResults);
    } catch (err) {
      console.error('Failed to fetch commit diff:', err);
      setDiffsError('Failed to load commit changes');
    } finally {
      setDiffsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (selectedCommit?.id && showDiff) {
      fetchCommitDiffs(selectedCommit.id);
    }
  }, [selectedCommit, showDiff, fetchCommitDiffs]);

  const toggleFile = (filePath: string) => {
    toggleFileExpansion(filePath, expandedFiles, setExpandedFiles);
  };




  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[85vw] max-w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git Commit History
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {error && (
              <Alert variant="destructive" className="m-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!error && !isMobile && (
              <PanelGroup direction="horizontal" className="h-full">
                <Panel defaultSize={30} minSize={20} maxSize={50}>
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
                      <h3 className="text-sm font-medium">Commits</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                      >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 overflow-hidden">
                      <div className="p-4 space-y-3">
                        {loading && (
                          <div className="flex justify-center items-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        
                        {!loading && commits.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No commits found
                          </div>
                        )}
                        
                        {!loading && commits.map((commit) => (
                          <div
                            key={commit.id}
                            className={cn(
                              "border rounded-lg p-4 cursor-pointer transition-colors",
                              selectedCommit?.id === commit.id
                                ? "bg-accent border-accent-foreground/20"
                                : "hover:bg-accent/50"
                            )}
                            onClick={() => {
                              setSelectedCommit(commit);
                              if (!isMobile) {
                                setShowDiff(true);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <GitCommitIcon className="h-4 w-4 text-muted-foreground" />
                                  <code className="text-xs font-mono text-muted-foreground">
                                    {commit.id?.slice(0, 7) ?? ''}
                                  </code>
                                  <span className="text-xs text-muted-foreground">
                                    {commit.timestamp ? formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true }) : ''}
                                  </span>
                                </div>
                                
                                <p className="font-medium text-sm line-clamp-2 mb-1">
                                  {commit.message?.split('\n')[0] ?? ''}
                                </p>
                                
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {commit.author_name ?? ''}
                                  </span>
                                  
                                  {commit.diff_stats && (
                                    <div className="flex items-center gap-2">
                                      {(commit.diff_stats.insertions ?? 0) > 0 && (
                                        <span className="text-green-600">
                                          +{commit.diff_stats.insertions}
                                        </span>
                                      )}
                                      {(commit.diff_stats.deletions ?? 0) > 0 && (
                                        <span className="text-red-600">
                                          -{commit.diff_stats.deletions}
                                        </span>
                                      )}
                                      <span>
                                        {commit.diff_stats.files_changed ?? 0} files
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </Panel>
                
                <PanelResizeHandle className="bg-border hover:bg-primary/20 transition-colors" />
                
                <Panel defaultSize={70} className="flex flex-col">
                  {selectedCommit && showDiff ? (
                    <div className="h-full flex flex-col">
                      <div className="p-4 border-b">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg mb-1">
                              Commit {selectedCommit.id?.slice(0, 7) ?? ''}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {selectedCommit.message?.split('\n')[0] ?? ''}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {selectedCommit.author_name ?? ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {selectedCommit.timestamp ? new Date(selectedCommit.timestamp).toLocaleString() : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <ScrollArea className="flex-1">
                        <div className="p-4">
                          {diffsLoading && (
                            <div className="flex justify-center items-center py-8">
                              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          
                          {diffsError && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{diffsError}</AlertDescription>
                            </Alert>
                          )}
                          
                          {!diffsLoading && !diffsError && commitDiffs.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              No changes in this commit
                            </div>
                          )}
                          
                          {!diffsLoading && !diffsError && commitDiffs.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-medium">
                                  {commitDiffs.length} file{commitDiffs.length !== 1 ? 's' : ''} changed
                                </h4>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-8 px-2", viewMode === 'unified' && "bg-accent")}
                                    onClick={() => setViewMode('unified')}
                                  >
                                    <AlignLeft className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-8 px-2", viewMode === 'split' && "bg-accent")}
                                    onClick={() => setViewMode('split')}
                                  >
                                    <Columns2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {commitDiffs.map((diff) => {
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
                                        <DiffViewer diffResult={diff} viewMode={viewMode} />
                                      </div>
                                    )}
                                  </FileExpander>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <GitCommitIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Select a commit to view details</p>
                      </div>
                    </div>
                  )}
                </Panel>
              </PanelGroup>
            )}
            
            {!error && isMobile && (
              <div className="h-full overflow-hidden">
                {!showDiff ? (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
                      <h3 className="text-sm font-medium">Commits</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                      >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 overflow-hidden">
                      <div className="p-4 space-y-3">
                        {loading && (
                          <div className="flex justify-center items-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        
                        {!loading && commits.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No commits found
                          </div>
                        )}
                        
                        {!loading && commits.map((commit) => (
                          <div
                            key={commit.id}
                            className={cn(
                              "border rounded-lg p-4 cursor-pointer transition-colors",
                              selectedCommit?.id === commit.id
                                ? "bg-accent border-accent-foreground/20"
                                : "hover:bg-accent/50"
                            )}
                            onClick={() => {
                              setSelectedCommit(commit);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <GitCommitIcon className="h-4 w-4 text-muted-foreground" />
                                  <code className="text-xs font-mono text-muted-foreground">
                                    {commit.id?.slice(0, 7) ?? ''}
                                  </code>
                                  <span className="text-xs text-muted-foreground">
                                    {commit.timestamp ? formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true }) : ''}
                                  </span>
                                </div>
                                
                                <p className="font-medium text-sm line-clamp-2 mb-1">
                                  {commit.message?.split('\n')[0] ?? ''}
                                </p>
                                
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {commit.author_name ?? ''}
                                  </span>
                                  
                                  {commit.diff_stats && (
                                    <div className="flex items-center gap-2">
                                      {(commit.diff_stats.insertions ?? 0) > 0 && (
                                        <span className="text-green-600">
                                          +{commit.diff_stats.insertions}
                                        </span>
                                      )}
                                      {(commit.diff_stats.deletions ?? 0) > 0 && (
                                        <span className="text-red-600">
                                          -{commit.diff_stats.deletions}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {isMobile && selectedCommit?.id === commit.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDiff(true);
                                    if (commit.id) {
                                      fetchCommitDiffs(commit.id);
                                    }
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">
                            Commit {selectedCommit?.id?.slice(0, 7) ?? ''}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {selectedCommit?.message?.split('\n')[0] ?? ''}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {selectedCommit?.author_name ?? ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {selectedCommit?.timestamp ? new Date(selectedCommit.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDiff(false)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                    
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        {diffsLoading && (
                          <div className="flex justify-center items-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        
                        {diffsError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{diffsError}</AlertDescription>
                          </Alert>
                        )}
                        
                        {!diffsLoading && !diffsError && commitDiffs.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No changes in this commit
                          </div>
                        )}
                        
                        {!diffsLoading && !diffsError && commitDiffs.length > 0 && (
                          <div className="space-y-3">
                            <div className="space-y-2 mb-4">
                              <h4 className="text-sm font-medium">
                                {commitDiffs.length} file{commitDiffs.length !== 1 ? 's' : ''} changed
                              </h4>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn("h-7 px-2 flex-1", viewMode === 'unified' && "bg-accent")}
                                  onClick={() => setViewMode('unified')}
                                >
                                  <AlignLeft className="h-3 w-3 mr-1" />
                                  Unified
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn("h-7 px-2 flex-1", viewMode === 'split' && "bg-accent")}
                                  onClick={() => setViewMode('split')}
                                >
                                  <Columns2 className="h-3 w-3 mr-1" />
                                  Split
                                </Button>
                              </div>
                            </div>
                            
                            {commitDiffs.map((diff) => {
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
                                      <DiffViewer diffResult={diff} viewMode={viewMode} />
                                    </div>
                                  )}
                                </FileExpander>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showDiffDialog && selectedCommit?.id && (
        <GitDiffDialog
          open={showDiffDialog}
          onOpenChange={setShowDiffDialog}
          commitId={selectedCommit.id}
        />
      )}
    </>
  );
}