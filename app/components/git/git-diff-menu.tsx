'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  GitBranchIcon, 
  GitCommitIcon,
  DiffIcon,
  HistoryIcon,
  ChevronDownIcon
} from 'lucide-react';
import { CommitDiff } from './commit-diff';
import { FileDiff } from './file-diff';

interface GitDiffMenuProps {
  documentPath?: string;
  className?: string;
  showWorkingDiff?: boolean;
  onToggleWorkingDiff?: () => void;
}

export function GitDiffMenu({
  documentPath,
  className,
  showWorkingDiff,
  onToggleWorkingDiff,
}: GitDiffMenuProps) {
  const [showCommitDiffDialog, setShowCommitDiffDialog] = useState(false);
  const [showFileDiffDialog, setShowFileDiffDialog] = useState(false);
  const [fromCommit, setFromCommit] = useState('');
  const [toCommit, setToCommit] = useState('HEAD');
  const [diffFilePath, setDiffFilePath] = useState(documentPath || '');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={className}
          >
            <GitBranchIcon className="h-4 w-4 mr-1" />
            Git Diff
            <ChevronDownIcon className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Git Diff Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {onToggleWorkingDiff && (
            <DropdownMenuItem onClick={onToggleWorkingDiff}>
              <DiffIcon className="mr-2 h-4 w-4" />
              {showWorkingDiff ? 'Hide' : 'Show'} Working Changes
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={() => setShowFileDiffDialog(true)}>
            <GitBranchIcon className="mr-2 h-4 w-4" />
            View File Diff
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowCommitDiffDialog(true)}>
            <GitCommitIcon className="mr-2 h-4 w-4" />
            Compare Commits
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem disabled>
            <HistoryIcon className="mr-2 h-4 w-4" />
            View History
            <span className="ml-auto text-xs text-muted-foreground">Soon</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* File Diff Dialog */}
      <Dialog open={showFileDiffDialog} onOpenChange={setShowFileDiffDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>File Diff</DialogTitle>
            <DialogDescription>
              View uncommitted changes for a specific file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="file-path">File Path</Label>
                <Input
                  id="file-path"
                  value={diffFilePath}
                  onChange={(e) => setDiffFilePath(e.target.value)}
                  placeholder="path/to/file.md"
                />
              </div>
            </div>
            {diffFilePath && (
              <div className="flex-1 overflow-auto border rounded-md">
                <FileDiff filePath={diffFilePath} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Commit Diff Dialog */}
      <Dialog open={showCommitDiffDialog} onOpenChange={setShowCommitDiffDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Compare Commits</DialogTitle>
            <DialogDescription>
              View differences between two commits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="from-commit">From Commit</Label>
                <Input
                  id="from-commit"
                  value={fromCommit}
                  onChange={(e) => setFromCommit(e.target.value)}
                  placeholder="Commit hash or branch"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="to-commit">To Commit</Label>
                <Input
                  id="to-commit"
                  value={toCommit}
                  onChange={(e) => setToCommit(e.target.value)}
                  placeholder="Commit hash or branch (default: HEAD)"
                />
              </div>
              <Button
                onClick={() => {
                  if (fromCommit) {
                    // Trigger re-render of CommitDiff
                    setShowCommitDiffDialog(false);
                    setTimeout(() => setShowCommitDiffDialog(true), 0);
                  }
                }}
                disabled={!fromCommit}
              >
                Compare
              </Button>
            </div>
            {fromCommit && toCommit && (
              <div className="flex-1 overflow-auto border rounded-md">
                <CommitDiff
                  fromCommit={fromCommit}
                  toCommit={toCommit}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}