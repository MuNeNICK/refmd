"use client";

import React, { useState, useCallback, memo } from 'react';
import { FileText, Edit, Trash2, MoreHorizontal, NotebookText, History, FileCode } from 'lucide-react';
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
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { FileHistoryDialog } from '@/components/git/file-history-dialog';
import { getApiUrl } from '@/lib/config';
import { useIsMobile } from '@/hooks/use-mobile';

interface DocumentNode {
  id: string;
  title: string;
  type: 'file' | 'folder' | 'scrap';
  parent_id?: string;
  children?: DocumentNode[];
  created_at?: string;
  updated_at?: string;
  file_path?: string;
}

interface FileNodeProps {
  node: DocumentNode;
  parentId?: string;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  isAuthenticated?: boolean;
  onSelect: (id: string, type: 'file' | 'folder' | 'scrap') => void;
  onOpenInSecondary?: (id: string, type?: 'document' | 'scrap') => void;
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
  isAuthenticated = false,
  onSelect,
  onOpenInSecondary,
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
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [documentFilePath, setDocumentFilePath] = useState<string | null>(null);
  const isMobile = useIsMobile();

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

  const handleOpenInSecondary = useCallback(() => {
    if (onOpenInSecondary) {
      const type = node.type === 'scrap' ? 'scrap' : 'document';
      onOpenInSecondary(node.id, type);
    }
  }, [node.id, node.type, onOpenInSecondary]);

  const handleShowHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('refmd_access_token');
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/documents/${node.id}/file-path`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get file path');
      }
      
      const data = await response.json();
      if (data.file_path) {
        setDocumentFilePath(data.file_path);
        setShowHistoryDialog(true);
      } else {
        alert('File path not available for this document');
      }
    } catch (error) {
      console.error('Failed to fetch document details:', error);
      alert('Failed to fetch document details');
    }
  }, [node.id]);

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
                "h-7 overflow-visible flex-1",
                "[&>span:last-child]:text-ellipsis [&>span:last-child]:overflow-hidden [&>span:last-child]:whitespace-nowrap [&>span:last-child]:max-w-none"
              )}
              onClick={handleSelect}
            >
              {node.type === 'scrap' ? (
                <NotebookText className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium flex-1 text-ellipsis overflow-hidden whitespace-nowrap" title={node.title}>{node.title}</span>
            </SidebarMenuButton>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction className={cn(
                  isMobile ? "opacity-100" : "opacity-0 group-hover/file:opacity-100 data-[state=open]:opacity-100"
                )}>
                  <MoreHorizontal className="h-3 w-3" />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onOpenInSecondary && node.type !== 'folder' && (
                  <>
                    <DropdownMenuItem onClick={handleOpenInSecondary}>
                      <FileCode className="h-4 w-4 mr-2" />
                      Open in Secondary Viewer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleStartRename}>
                  <Edit className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {isAuthenticated && (
                  <DropdownMenuItem onClick={handleShowHistory}>
                    <History className="h-4 w-4 mr-2" />
                    View File History
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
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

      {documentFilePath && (
        <FileHistoryDialog
          filePath={documentFilePath}
          isOpen={showHistoryDialog}
          onClose={() => {
            setShowHistoryDialog(false);
            setDocumentFilePath(null);
          }}
        />
      )}
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