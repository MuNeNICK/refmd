"use client";

import React, { useState, useCallback, memo } from 'react';
import { FileText, Edit, Trash2, MoreHorizontal, NotebookText } from 'lucide-react';
import { 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarMenuAction 
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';

interface DocumentNode {
  id: string;
  title: string;
  type: 'file' | 'folder' | 'scrap';
  parent_id?: string;
  children?: DocumentNode[];
  created_at?: string;
  updated_at?: string;
}

interface FileNodeProps {
  node: DocumentNode;
  parentId?: string;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onSelect: (id: string, type: 'file' | 'folder' | 'scrap') => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent, id: string, type: 'file' | 'folder' | 'scrap') => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string, type: 'file' | 'folder' | 'scrap', parentId?: string) => void;
  onDragOver: (e: React.DragEvent, nodeId?: string, nodeType?: 'file' | 'folder' | 'scrap') => void;
}

export const FileNode = memo(function FileNode({
  node,
  parentId,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onRename,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragOver,
}: FileNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(node.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const handleSelect = useCallback(() => {
    onSelect(node.id, node.type);
  }, [node.id, node.type, onSelect]);

  return (
    <SidebarMenuItem>
      <div
        draggable={!isEditing}
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragEnd={onDragEnd}
        onDragEnter={(e) => onDragEnter(e, node.id, node.type)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node.id, node.type, parentId)}
        onDragOver={(e) => onDragOver(e, node.id, node.type)}
        className={cn(
          "relative w-full",
          isDropTarget && "before:absolute before:left-0 before:right-0 before:-top-px before:h-0.5 before:bg-primary"
        )}
      >
        {isEditing ? (
          <div className="flex items-center w-full px-2">
            {node.type === 'scrap' ? (
              <NotebookText className="h-4 w-4 mr-2 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
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
          <div className="flex items-center w-full group/file">
            <SidebarMenuButton
              isActive={isSelected}
              className={cn(
                isDragging && "opacity-50",
                "h-7"
              )}
              onClick={handleSelect}
            >
              {node.type === 'scrap' ? (
                <NotebookText className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate font-medium">{node.title}</span>
            </SidebarMenuButton>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction className="opacity-0 group-hover/file:opacity-100 data-[state=open]:opacity-100">
                  <MoreHorizontal className="h-3 w-3" />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
        )}
      </div>

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={node.title}
        onConfirm={handleDelete}
      />
    </SidebarMenuItem>
  );
},
// Prevent unnecessary re-renders with custom comparison function
(prevProps, nextProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.title === nextProps.node.title &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDropTarget === nextProps.isDropTarget
  );
});