"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PanelResizeHandle,
  Panel,
  PanelGroup,
} from "@/components/ui/resizable";
import type { GitCommit } from '@/lib/api/client';
import { getApiClient } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { 
  GitCommitIcon, 
  Clock, 
  User, 
  FileText, 
  AlertCircle,
  RefreshCw,
  Eye,
  Columns2,
  AlignLeft
} from "lucide-react";
import { FileCommitDiffPanel } from "./file-commit-diff-panel";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface FileHistoryDialogProps {
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FileHistoryDialog({ filePath, isOpen, onClose }: FileHistoryDialogProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const isMobile = useIsMobile();

  const fetchFileHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      const history = await client.gitSync.getFileCommitHistory(filePath);
      setCommits(history);
    } catch (err) {
      console.error("Failed to fetch file history:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch file history");
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (isOpen && filePath) {
      fetchFileHistory();
    }
  }, [isOpen, filePath, fetchFileHistory]);

  const handleRefresh = useCallback(() => {
    fetchFileHistory();
  }, [fetchFileHistory]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[85vw] max-w-[95vw] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File History: {filePath.split('/').pop()}
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
                          No commit history found for this file
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
                          <div className="flex-1">
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
                      </div>
                      
                      <div className="flex-1 overflow-hidden">
                        <FileCommitDiffPanel
                          commitId={selectedCommit.id ?? ''}
                          filePath={filePath}
                          viewMode={viewMode}
                          onViewModeChange={setViewMode}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <GitCommitIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Select a commit to view changes</p>
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
                        No commit history found for this file
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
                    <div className="space-y-3">
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
                  </div>
                  
                  {selectedCommit && (
                    <div className="flex-1 overflow-hidden">
                      <FileCommitDiffPanel
                        commitId={selectedCommit.id ?? ''}
                        filePath={filePath}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}