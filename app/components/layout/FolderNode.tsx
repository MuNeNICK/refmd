"use client";

import React, { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Edit, Trash2, MoreHorizontal, NotebookText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarMenuSub 
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface DocumentNode {
  id: string;
  title: string;
  type: 'file' | 'folder' | 'scrap';
  parent_id?: string;
  children?: DocumentNode[];
  created_at?: string;
  updated_at?: string;
}

interface FolderNodeProps {
  node: DocumentNode;
  isExpanded: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  hasChildDropTarget: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onCreateNew: (parentId: string, isFolder: boolean, isScrap?: boolean) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent, id: string, type: 'file' | 'folder' | 'scrap') => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string, type: 'file' | 'folder' | 'scrap', parentId?: string) => void;
  onDragOver: (e: React.DragEvent, nodeId?: string, nodeType?: 'file' | 'folder' | 'scrap') => void;
  renderChildren?: () => React.ReactNode;
}

export const FolderNode = memo(function FolderNode({
  node,
  isExpanded,
  isSelected,
  isDragging,
  isDropTarget,
  hasChildDropTarget,
  onToggle,
  onRename,
  onDelete,
  onCreateNew,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragOver,
  renderChildren,
}: FolderNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(node.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isMobile = useIsMobile();

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  }, [node.id, onToggle]);

  const handleStartRename = useCallback(() => {
    setIsEditing(true);
    setEditingTitle(node.title);
  }, [node.title]);

  const handleCancelRename = useCallback(() => {
    setIsEditing(false);
    setEditingTitle('');
  }, []);

  const handleSaveRename = useCallback(() => {
    if (editingTitle.trim()) {
      onRename(node.id, editingTitle.trim());
    }
    setIsEditing(false);
  }, [editingTitle, node.id, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  }, [handleSaveRename, handleCancelRename]);

  const handleDelete = useCallback(() => {
    onDelete(node.id);
    setShowDeleteDialog(false);
  }, [node.id, onDelete]);

  const handleCreateDocument = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNew(node.id, false, false);
  }, [node.id, onCreateNew]);

  const handleCreateFolder = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNew(node.id, true, false);
  }, [node.id, onCreateNew]);

  const handleCreateScrap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNew(node.id, false, true);
  }, [node.id, onCreateNew]);

  const shouldShowDropHighlight = isDropTarget || (hasChildDropTarget && isExpanded);

  return (
    <SidebarMenuItem 
      className={cn(
        "relative",
        shouldShowDropHighlight && isExpanded && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      <div
        draggable={!isEditing}
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver(e, node.id, node.type);
        }}
        onDragEnter={(e) => onDragEnter(e, node.id, node.type)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node.id, node.type)}
        className={cn(
          "relative w-full group/folder",
          isDropTarget && !isExpanded && "bg-primary/5 border-l-2 border-l-primary pl-2"
        )}
      >
        {isEditing ? (
          <div className="flex items-center flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 mr-1"
              onClick={handleToggle}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 mr-2 text-primary" />
            ) : (
              <Folder className="h-4 w-4 mr-2 text-primary" />
            )}
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              className="h-6 text-sm flex-1"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex items-center w-full">
            <SidebarMenuButton
              isActive={isSelected}
              className={cn(
                isDragging && "opacity-50",
                "flex-1 h-7 overflow-visible",
                "[&>span:last-child]:text-ellipsis [&>span:last-child]:overflow-hidden [&>span:last-child]:whitespace-nowrap [&>span:last-child]:max-w-none"
              )}
              onClick={handleToggle}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-primary" />
              ) : (
                <Folder className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium flex-1 text-ellipsis overflow-hidden whitespace-nowrap" title={node.title}>{node.title}</span>
            </SidebarMenuButton>
            
            <div className={cn(
              "flex items-center gap-1 transition-opacity",
              isMobile ? "opacity-100" : "opacity-0 group-hover/folder:opacity-100"
            )}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={handleCreateDocument}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCreateDocument}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateFolder}>
                    <Folder className="h-4 w-4 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateScrap}>
                    <NotebookText className="h-4 w-4 mr-2" />
                    New Scrap
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleStartRename}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <SidebarMenuSub 
          className={cn(
            "gap-0.5 relative min-h-[40px]"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragOver(e, node.id, 'folder');
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragEnter(e, node.id, 'folder');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragLeave(e);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop(e, node.id, 'folder');
          }}
        >
          {node.children && node.children.length > 0 ? (
            renderChildren?.()
          ) : (
            <div className={cn(
              "text-xs text-muted-foreground py-2 px-4",
              shouldShowDropHighlight && "text-primary"
            )}>
              {shouldShowDropHighlight ? "Drop here" : "Empty folder"}
            </div>
          )}
        </SidebarMenuSub>
      )}

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={node.title}
        description={`The "${node.title}" folder and all files inside it will be deleted. This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </SidebarMenuItem>
  );
});