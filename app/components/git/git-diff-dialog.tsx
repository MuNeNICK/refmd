"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkingDiffPanel } from './working-diff-panel';

interface GitDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitDiffDialog({ open, onOpenChange }: GitDiffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[70vw] max-w-[90vw] h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>Git Changes</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <WorkingDiffPanel
            className="h-full"
            onRefresh={() => {
              // Refresh is handled by WorkingDiffPanel internally
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}