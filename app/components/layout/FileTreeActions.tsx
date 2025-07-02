"use client";

import React, { memo, useCallback } from 'react';
import { Plus, Folder, Download, RefreshCw, NotebookText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface FileTreeActionsProps {
  onCreateDocument: () => void;
  onCreateFolder: () => void;
  onCreateScrap?: () => void;
  onExport: (format: 'json' | 'markdown') => void;
  onSync: (direction: 'to-file' | 'from-file') => void;
  onRefresh: () => void;
}

export const FileTreeActions = memo(function FileTreeActions({
  onCreateDocument,
  onCreateFolder,
  onCreateScrap,
  onExport,
  onSync,
  onRefresh,
}: FileTreeActionsProps) {
  const handleExportJson = useCallback(() => {
    onExport('json');
  }, [onExport]);

  const handleExportMarkdown = useCallback(() => {
    onExport('markdown');
  }, [onExport]);

  const handleSyncToFile = useCallback(() => {
    onSync('to-file');
  }, [onSync]);

  const handleSyncFromFile = useCallback(() => {
    onSync('from-file');
  }, [onSync]);

  return (
    <div className="flex items-center space-x-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreateDocument}
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>New document</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreateFolder}
          >
            <Folder className="h-3 w-3 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>New folder</p>
        </TooltipContent>
      </Tooltip>

      {onCreateScrap && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onCreateScrap}
            >
              <NotebookText className="h-3 w-3 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>New scrap</p>
          </TooltipContent>
        </Tooltip>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
          >
            <Download className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportJson}>
            <Download className="h-4 w-4 mr-2" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportMarkdown}>
            <Download className="h-4 w-4 mr-2" />
            Export as Markdown
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
          >
            <RefreshCw className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleSyncToFile}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync to Files
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSyncFromFile}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync from Files
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});