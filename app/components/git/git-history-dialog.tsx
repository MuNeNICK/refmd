'use client';

import { useState, useEffect } from 'react';
import { getApiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitCommit,
  Clock,
  FileText,
  AlertCircle,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { GitCommit } from '@/lib/api/client';
import { GitDiffDialog } from './git-diff-dialog';

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
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const api = getApiClient();

  useEffect(() => {
    if (open) {
      fetchCommits();
    }
  }, [open]);

  const fetchCommits = async () => {
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
  };

  const handleViewDiff = (commitHash: string) => {
    setSelectedCommit(commitHash);
    setShowDiff(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              Git Commit History
            </DialogTitle>
            <DialogDescription>
              View the complete Git commit history for this repository
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchCommits}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading commits...
              </div>
            ) : commits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No commits found
              </div>
            ) : (
              <div className="space-y-2">
                {commits.map((commit) => (
                  <div
                    key={commit.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <GitCommit className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="font-mono text-sm">
                          {commit.id.substring(0, 7)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => handleViewDiff(commit.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Diff
                        </Button>
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {commit.message.split('\n')[0]}
                      </p>
                      {commit.diff_stats && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="text-green-600">
                            +{commit.diff_stats.insertions}
                          </span>
                          <span className="text-red-600">
                            -{commit.diff_stats.deletions}
                          </span>
                          <span>
                            {commit.diff_stats.files_changed} file{commit.diff_stats.files_changed !== 1 ? 's' : ''} changed
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{commit.author_name}</span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(commit.timestamp), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {showDiff && selectedCommit && (
        <GitDiffDialog
          open={showDiff}
          onOpenChange={setShowDiff}
          commitId={selectedCommit}
        />
      )}
    </>
  );
}