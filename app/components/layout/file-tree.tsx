"use client";

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, Edit, MoreHorizontal, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
  SidebarRail,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useFileTree } from '@/components/providers/fileTreeProvider';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api';
import { Document } from '@/lib/api/client/models/Document';

interface DocumentNode {
  id: string;
  title: string;
  type: 'file' | 'folder';
  parent_id?: string;
  children?: DocumentNode[];
  created_at?: string;
  updated_at?: string;
}

interface FileTreeProps {
  onDocumentSelect: (documentId: string) => void;
  selectedDocumentId?: string;
}

function FileTreeComponent({ onDocumentSelect, selectedDocumentId }: FileTreeProps) {
  const { documents, expandedFolders, loading, toggleFolder, expandFolder, expandParentFolders, refreshDocuments, updateDocuments } = useFileTree();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<{ nodeId: string; position: 'before' | 'after' } | null>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState<boolean>(false);
  const router = useRouter();

  // Expand parent folders when a document is selected
  React.useEffect(() => {
    if (selectedDocumentId && !loading) {
      expandParentFolders(selectedDocumentId);
    }
  }, [selectedDocumentId, expandParentFolders, loading]);

  const createNewDocument = useCallback(async (parentId?: string, isFolder: boolean = false) => {
    try {
      const api = getApiClient();
      const response = await api.documents.createDocument({
        title: isFolder ? 'New Folder' : 'New Document',
        content: '',
        type: isFolder ? Document.type.FOLDER : Document.type.DOCUMENT,
        parent_id: parentId || null,
      });

      refreshDocuments();
      if (parentId) {
        expandFolder(parentId);
      }

      // Navigate to the newly created document if it's not a folder
      if (!isFolder && response.id) {
        router.push(`/document/${response.id}`);
      }
    } catch (error) {
      console.error('Failed to create document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create document: ${errorMessage}`);
    }
  }, [refreshDocuments, expandFolder, router]);

  const deleteDocument = useCallback(async (documentId: string) => {
    // Check if the deleted document or any of its children is currently selected
    const isCurrentDocumentAffected = (node: DocumentNode): boolean => {
      if (node.id === selectedDocumentId) return true;
      if (node.children) {
        return node.children.some(child => isCurrentDocumentAffected(child));
      }
      return false;
    };

    // Find the document node to check if it's a folder with children
    const findNode = (nodes: DocumentNode[], id: string): DocumentNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const deletedNode = findNode(documents, documentId);
    const shouldNavigateAway = deletedNode && isCurrentDocumentAffected(deletedNode);

    // Optimistically update the UI by removing the document from the tree
    const removeDocument = (nodes: DocumentNode[]): DocumentNode[] => {
      return nodes.filter(node => {
        if (node.id === documentId) return false;
        if (node.children) {
          node.children = removeDocument(node.children);
        }
        return true;
      });
    };

    const updatedDocs = removeDocument(documents);
    updateDocuments(updatedDocs);

    // Navigate to dashboard if the current document is being deleted
    if (shouldNavigateAway) {
      router.push('/dashboard');
    }

    try {
      const api = getApiClient();
      await api.documents.deleteDocument(documentId);
    } catch (error) {
      console.error('Failed to delete document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete: ${errorMessage}`);
      // Restore the original state on error
      refreshDocuments();
    }
  }, [documents, updateDocuments, selectedDocumentId, router, refreshDocuments]);

  const startRename = useCallback((documentId: string, currentTitle: string) => {
    setEditingId(documentId);
    setEditingTitle(currentTitle);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
  }, []);

  const saveRename = useCallback(async (documentId: string) => {
    if (!editingTitle.trim()) {
      cancelRename();
      return;
    }

    const newTitle = editingTitle.trim();

    // Optimistically update the UI immediately
    const updateDocumentTitle = (nodes: DocumentNode[]): DocumentNode[] => {
      return nodes.map(node => {
        if (node.id === documentId) {
          return { ...node, title: newTitle };
        }
        if (node.children) {
          return { ...node, children: updateDocumentTitle(node.children) };
        }
        return node;
      });
    };

    // Update the documents in the provider immediately
    const updatedDocs = updateDocumentTitle(documents);
    updateDocuments(updatedDocs);

    // Cancel rename UI state
    cancelRename();

    try {
      const api = getApiClient();
      await api.documents.updateDocument(documentId, {
        title: newTitle,
      });
    } catch (error) {
      console.error('Failed to rename document:', error);
      // If the API call fails, refresh to revert to the actual state
      refreshDocuments();
    }
  }, [editingTitle, documents, updateDocuments, refreshDocuments, cancelRename]);

  const exportDocuments = useCallback(async (format: 'json' | 'markdown') => {
    try {
      const api = getApiClient();
      // Use the raw request method for export endpoint as it's not in the generated client
      const response = await api.request.request({
        method: 'GET',
        url: `/documents/export?format=${format}`,
      }) as Response;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `documents.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Export failed: ${errorMessage}`);
    }
  }, []);

  const syncDocuments = useCallback(async (direction: 'to-file' | 'from-file') => {
    try {
      const api = getApiClient();
      // Use the raw request method for sync endpoint as it's not in the generated client
      await api.request.request({
        method: 'POST',
        url: '/documents/sync',
        body: { direction },
        mediaType: 'application/json',
      });

      refreshDocuments();
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to sync documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Sync failed: ${errorMessage}`);
    }
  }, [refreshDocuments]);

  const handleFileUpload = useCallback(async (files: File[], parentId?: string) => {
    try {
      for (const file of files) {
        let content = '';
        const title = file.name;

        // Read file content based on type
        if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          content = await file.text();
        } else if (file.type.startsWith('image/')) {
          // For images, try to upload the file first
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('parent_id', parentId || '');

            const api = getApiClient();
            const result = await api.files.uploadFile({
              file,
              document_id: parentId || '',
            });

            if (result.data) {
              content = `![${title}](${result.data.url})`;
            } else {
              // Fallback: create a placeholder for the image
              content = `Image: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n*Note: Image upload not available. Please use the editor to upload images.*`;
            }
          } catch {
            // Fallback: create a placeholder for the image
            content = `Image: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n*Note: Image upload not available. Please use the editor to upload images.*`;
          }
        } else {
          // For other file types, create a placeholder document
          content = `File: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n*This file type is not directly supported. The file information is shown above.*`;
        }

        // Create document
        try {
          const api = getApiClient();
          await api.documents.createDocument({
            title,
            content,
            parent_id: parentId || null,
          });
        } catch (error) {
          console.error('Failed to create document for file:', file.name, error);
        }
      }

      // Refresh documents after all uploads
      refreshDocuments();
      if (parentId) {
        expandFolder(parentId);
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    }
  }, [refreshDocuments, expandFolder]);

  const moveDocument = useCallback(async (documentId: string, newParentId?: string) => {
    try {
      const api = getApiClient();
      await api.documents.updateDocument(documentId, {
        parent_id: newParentId || null
      });

      // Multiple refresh attempts to ensure update
      const refreshWithRetry = async (attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1))); // Longer delays
          refreshDocuments();

          // Wait a bit and check if the update took effect
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      };

      await refreshWithRetry();

      // Expand target folder if moving into a folder
      if (newParentId) {
        setTimeout(() => expandFolder(newParentId), 500);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Move failed: ${errorMessage}`);
      refreshDocuments();
    }
  }, [refreshDocuments, expandFolder]);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    // Ensure clean state before starting new drag
    setDropTarget(null);
    setDropPosition(null);

    setDraggedItem(nodeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);

    // Add visual feedback
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // Reset visual feedback first
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';

    // Clean up all drag-related state
    setTimeout(() => {
      setDraggedItem(null);
      setDropTarget(null);
      setDropPosition(null);
    }, 50); // Small delay to ensure drop event processes first
  }, []);


  const handleDragOverBetween = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem || draggedItem === nodeId) return;

    const target = e.currentTarget as HTMLElement;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Determine position based on mouse position within the element
    const position = y < height / 2 ? 'before' : 'after';

    // Only update state if it's actually different to prevent unnecessary re-renders
    const newDropPosition = { nodeId, position: position as 'before' | 'after' };
    if (!dropPosition ||
      dropPosition.nodeId !== newDropPosition.nodeId ||
      dropPosition.position !== newDropPosition.position) {
      setDropPosition(newDropPosition);
      setDropTarget(null);
    }
  }, [draggedItem, dropPosition]);

  const handleDragEnter = useCallback((e: React.DragEvent, nodeId: string, nodeType: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is an external file drag
    const hasFiles = e.dataTransfer?.types.includes('Files');
    const draggedFromEvent = e.dataTransfer?.types.includes('text/plain');

    if (hasFiles) {
      // External files can be dropped on folders or root
      if (nodeType === 'folder') {
        // Only update if it's actually a different target
        if (dropTarget !== nodeId) {
          setDropTarget(nodeId);
          setDropPosition(null);
        }
      } else if (nodeType === 'root') {
        if (dropTarget !== '') {
          setDropTarget('');
          setDropPosition(null);
        }
      }
      setIsExternalDragOver(true);
      return;
    }

    if (!draggedFromEvent && !draggedItem) {
      return;
    }

    // Only allow drop on folders (not the dragged item itself)
    if (nodeType === 'folder' && draggedItem && draggedItem !== nodeId) {
      // Only update if different to prevent unnecessary re-renders and flickering
      if (dropTarget !== nodeId) {
        setDropTarget(nodeId);
        setDropPosition(null);
      }
    }
  }, [draggedItem, dropTarget]);

  const handleDragLeave = useCallback((e: React.DragEvent, nodeId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Use a small delay to prevent flickering when moving between child elements
    // Slightly longer delay for better stability with nested folders
    setTimeout(() => {
      // Check if the element still exists and we're actually leaving the target element
      const target = e.currentTarget as HTMLElement;
      if (!target) {
        // If target is null, just clear the states
        setDropTarget(null);
        setDropPosition(null);
        setIsExternalDragOver(false);
        return;
      }

      const rect = target.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      // Only clear if mouse is outside the element bounds and this was the active drop target
      const isOutside = x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
      const isCurrentTarget = nodeId ? dropTarget === nodeId : true;

      if (isOutside && isCurrentTarget) {
        setDropTarget(null);
        setDropPosition(null);
        setIsExternalDragOver(false);
      }
    }, 100);
  }, [dropTarget]);

  const handleDrop = useCallback((e: React.DragEvent, targetNodeId?: string, targetNodeType?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear drag states
    setIsExternalDragOver(false);
    setDropTarget(null);
    setDropPosition(null);

    // Check if this is an external file drop
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Handle external file upload
      const parentId = targetNodeType === 'folder' ? targetNodeId : undefined;
      handleFileUpload(files, parentId);
      return;
    }

    const draggedNodeId = e.dataTransfer.getData('text/plain') || draggedItem;

    if (!draggedNodeId) {
      return;
    }

    if (draggedNodeId === targetNodeId) {
      return;
    }

    // Only allow dropping on folders or root area (no targetNodeId)
    if (targetNodeId && targetNodeType !== 'folder') {
      return;
    }

    moveDocument(draggedNodeId, targetNodeId);
  }, [draggedItem, handleFileUpload, moveDocument]);

  const handleDropBetween = useCallback((e: React.DragEvent, targetNodeId: string, parentId: string | undefined) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedNodeId = e.dataTransfer.getData('text/plain') || draggedItem;

    if (!draggedNodeId || draggedNodeId === targetNodeId) {
      return;
    }

    // Move to the same parent as the target node with position info
    // Note: targetNodeId and position are not supported by the backend yet
    moveDocument(draggedNodeId, parentId);
  }, [draggedItem, moveDocument]);

  // Helper function to check if any child is a drop target
  const checkChildDropTarget = useCallback((node: DocumentNode, dropPosition: { nodeId: string; position: 'before' | 'after' } | null): boolean => {
    if (!node.children || !dropPosition) return false;

    const checkChildRecursively = (children: DocumentNode[]): boolean => {
      return children.some(child => {
        if (dropPosition.nodeId === child.id) return true;
        if (child.children) return checkChildRecursively(child.children);
        return false;
      });
    };

    return checkChildRecursively(node.children);
  }, []);

  // Helper function to check if any child folder is the current drop target
  const checkChildFolderIsDropTarget = useCallback((node: DocumentNode, currentDropTarget: string | null): boolean => {
    if (!node.children || !currentDropTarget) return false;

    const checkChildRecursively = (children: DocumentNode[]): boolean => {
      return children.some(child => {
        if (child.type === 'folder' && child.id === currentDropTarget) return true;
        if (child.children) return checkChildRecursively(child.children);
        return false;
      });
    };

    return checkChildRecursively(node.children);
  }, []);

  const renderDocumentNode = React.useCallback((node: DocumentNode, level: number = 0, parentId?: string) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedDocumentId === node.id;
    const isDragging = draggedItem === node.id;
    const isDroppable = node.type === 'folder' && dropTarget === node.id;
    const hasExpandedChildren = node.type === 'folder' && isExpanded && node.children && node.children.length > 0;
    // Check if this node is a drop position target
    const isDropPositionTarget = dropPosition?.nodeId === node.id;

    // Check if any child in this folder is a drop target (for files)
    const hasChildDropTarget = checkChildDropTarget(node, dropPosition);

    // Check if any child folder is the current drop target (should prevent parent from showing range)
    const hasChildFolderAsDropTarget = checkChildFolderIsDropTarget(node, dropTarget);

    // Apply folder range CSS if this folder is drop target OR if any child file is drop target
    // BUT NOT if a child folder is the drop target (to prevent parent from showing when child folder should show)
    const shouldShowFolderRange = (isDroppable || hasChildDropTarget) &&
      (hasExpandedChildren || (node.type === 'folder' && isExpanded && isDroppable)) &&
      !hasChildFolderAsDropTarget;

    if (node.type === 'folder') {
      return (
        <SidebarMenuItem key={node.id}>
          <Collapsible open={isExpanded} onOpenChange={() => toggleFolder(node.id)}>
            <div
              draggable={editingId !== node.id}
              onDragStart={(e) => handleDragStart(e, node.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();

                const hasFiles = e.dataTransfer.types.includes('Files');
                const draggedFromEvent = e.dataTransfer?.types.includes('text/plain');

                if (hasFiles) {
                  e.dataTransfer.dropEffect = 'copy';
                  if (dropTarget !== node.id) {
                    setDropTarget(node.id);
                    setDropPosition(null);
                    setIsExternalDragOver(true);
                  }
                } else if ((draggedFromEvent || draggedItem) && draggedItem !== node.id) {
                  e.dataTransfer.dropEffect = 'move';
                  if (dropTarget !== node.id) {
                    setDropTarget(node.id);
                    setDropPosition(null);
                  }
                }
              }}
              onDragEnter={(e) => handleDragEnter(e, node.id, node.type)}
              onDragLeave={(e) => handleDragLeave(e, node.id)}
              onDrop={(e) => handleDrop(e, node.id, node.type)}
              className={cn(
                "relative w-full group/folder",
                shouldShowFolderRange && "bg-primary/10 border-2 border-primary border-dashed rounded-md p-1",
                dropTarget === node.id && !isExpanded && "bg-primary/10 border-2 border-primary border-dashed"
              )}
            >
              {editingId === node.id ? (
                <div className="flex items-center flex-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(node.id);
                    }}
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
                    onBlur={() => saveRename(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveRename(node.id);
                      } else if (e.key === 'Escape') {
                        cancelRename();
                      }
                    }}
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
                      "flex-1 h-7"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(node.id);
                    }}
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
                    <span className="truncate font-medium">{node.title}</span>
                  </SidebarMenuButton>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              createNewDocument(node.id, false);
                            }}
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
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          createNewDocument(node.id, false);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Document
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          createNewDocument(node.id, true);
                        }}
                      >
                        <Folder className="h-4 w-4 mr-2" />
                        New Folder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(node.id, node.title);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${node.title}"?`)) {
                            deleteDocument(node.id);
                          }
                        }}
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

            {isExpanded && node.children && node.children.length > 0 && (
              <SidebarMenuSub className="gap-0.5">
                {node.children.map(child => renderDocumentNode(child, level + 1, node.id))}
              </SidebarMenuSub>
            )}
          </Collapsible>
        </SidebarMenuItem>
      );
    }

    // Render file node
    return (
      <SidebarMenuItem key={node.id}>
        <div
          draggable={editingId !== node.id}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOverBetween(e, node.id)}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => handleDragLeave(e)}
          onDrop={(e) => {
            if (isDropPositionTarget) {
              handleDropBetween(e, node.id, parentId);
            }
          }}
          className={cn(
            "relative w-full",
            isDropPositionTarget && "before:absolute before:left-0 before:right-0 before:-top-px before:h-0.5 before:bg-primary"
          )}
        >
          {editingId === node.id ? (
            <div className="flex items-center w-full px-2">
              <File className="h-4 w-4 mr-2 text-muted-foreground" />
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => saveRename(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveRename(node.id);
                  } else if (e.key === 'Escape') {
                    cancelRename();
                  }
                }}
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
                onClick={() => onDocumentSelect(node.id)}
              >
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="truncate font-medium">{node.title}</span>
              </SidebarMenuButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction className="opacity-0 group-hover/file:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontal className="h-3 w-3" />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(node.id, node.title);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${node.title}"?`)) {
                          deleteDocument(node.id);
                        }
                      }}
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
      </SidebarMenuItem>
    );
  }, [expandedFolders, selectedDocumentId, draggedItem, dropTarget, dropPosition, editingId, editingTitle, createNewDocument, deleteDocument, handleDragEnter, handleDragLeave, handleDragOverBetween, handleDrop, handleDropBetween, onDocumentSelect, saveRename, toggleFolder, startRename, cancelRename, handleDragStart, handleDragEnd, checkChildDropTarget, checkChildFolderIsDropTarget]);

  if (loading) {
    return (
      <Sidebar variant="sidebar" collapsible="offcanvas" className="top-14 h-[calc(100vh-3.5rem)]">
          <SidebarHeader className="px-2 border-b">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-foreground">Files</span>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                  <Folder className="h-3 w-3 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                  <Download className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas" className="top-14 h-[calc(100vh-3.5rem)]">
        <SidebarHeader className="px-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Files</span>
            <div className="flex items-center space-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => createNewDocument(undefined, false)}
                    >
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>New document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => createNewDocument(undefined, true)}
                    >
                      <Folder className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>New folder</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

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
                  <DropdownMenuItem onClick={() => exportDocuments('json')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportDocuments('markdown')}>
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
                  <DropdownMenuItem onClick={() => syncDocuments('to-file')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync to Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => syncDocuments('from-file')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync from Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refreshDocuments()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const hasFiles = e.dataTransfer.types.includes('Files');
            if (hasFiles) {
              e.dataTransfer.dropEffect = 'copy';
              setIsExternalDragOver(true);
              setDropTarget('');
            } else {
              e.dataTransfer.dropEffect = 'move';
              if (draggedItem) {
                setDropTarget('');
              }
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const hasFiles = e.dataTransfer.types.includes('Files');
            const draggedFromEvent = e.dataTransfer?.types.includes('text/plain');

            if (hasFiles) {
              setDropTarget('');
              setDropPosition(null);
              setIsExternalDragOver(true);
            } else if (draggedFromEvent || draggedItem) {
              setDropTarget('');
              setDropPosition(null);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.currentTarget as HTMLElement;
            if (!target) {
              setDropTarget(null);
              setDropPosition(null);
              setIsExternalDragOver(false);
              return;
            }

            const rect = target.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;

            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
              setDropTarget(null);
              setDropPosition(null);
              setIsExternalDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();

            // Clear drag states
            setIsExternalDragOver(false);
            setDropTarget(null);
            setDropPosition(null);

            // Check if this is an external file drop
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
              handleFileUpload(files, undefined);
              return;
            }

            // Handle internal document drop to root
            const draggedNodeId = e.dataTransfer.getData('text/plain') || draggedItem;
            if (draggedNodeId) {
              moveDocument(draggedNodeId, undefined);
            }
          }}
        >
          {/* Root drop zone overlay */}
          {((draggedItem && dropTarget === '') || (isExternalDragOver && dropTarget === '')) && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-sm z-0 pointer-events-none" />
          )}

          {/* External file drop feedback */}
          {isExternalDragOver && (
            <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 border-dashed rounded-sm z-0 pointer-events-none">
              <div className="flex items-center justify-center h-full">
                <p className="text-blue-600 font-medium">Drop files here to add to {dropTarget ? 'folder' : 'root'}</p>
              </div>
            </div>
          )}

          <SidebarGroup>
            <SidebarGroupContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-2">No documents yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Drop files here or create a new document</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createNewDocument(undefined, false)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first document
                  </Button>
                </div>
              ) : (
                <SidebarMenu className="gap-0.5">
                  {documents.map(node => renderDocumentNode(node, 0, undefined))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
    </Sidebar>
  );
}

// Export memoized component
export const FileTree = React.memo(FileTreeComponent);