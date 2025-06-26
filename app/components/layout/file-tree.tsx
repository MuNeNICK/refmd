"use client";

import React, { useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { useFileTree } from '@/components/providers/fileTreeProvider';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api';
import { Document } from '@/lib/api/client/models/Document';
import { FileNode } from './FileNode';
import { FolderNode } from './FolderNode';
import { FileTreeActions } from './FileTreeActions';
import { useFileTreeDrag } from '@/lib/hooks/useFileTreeDrag';
import { GitSyncButton } from '@/components/git/git-sync-button';
import { GitDiffDialog } from '@/components/git/git-diff-dialog';
import { useAuth } from '@/lib/auth/authContext';

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

interface FileTreeProps {
  onDocumentSelect: (documentId: string, documentType?: 'file' | 'folder' | 'scrap') => void;
  selectedDocumentId?: string;
}

function FileTreeComponent({ onDocumentSelect, selectedDocumentId }: FileTreeProps) {
  const { documents, expandedFolders, loading, toggleFolder, expandFolder, expandParentFolders, refreshDocuments, updateDocuments } = useFileTree();
  const router = useRouter();
  const { user } = useAuth();
  const [showGitDiff, setShowGitDiff] = React.useState(false);

  // Expand parent folders when a document is selected
  React.useEffect(() => {
    if (selectedDocumentId && !loading) {
      expandParentFolders(selectedDocumentId);
    }
  }, [selectedDocumentId, expandParentFolders, loading]);

  const createNewDocument = useCallback(async (parentId?: string, isFolder: boolean = false, isScrap: boolean = false) => {
    try {
      const api = getApiClient();
      const response = await api.documents.createDocument({
        title: isFolder ? 'New Folder' : isScrap ? 'New Scrap' : 'New Document',
        content: '',
        type: isFolder ? Document.type.FOLDER : isScrap ? Document.type.SCRAP : Document.type.DOCUMENT,
        parent_id: parentId || null,
      });

      refreshDocuments();
      if (parentId) {
        expandFolder(parentId);
      }

      if (isScrap && response.id) {
        router.push(`/scrap/${response.id}`);
      } else if (!isFolder && response.id) {
        router.push(`/document/${response.id}`);
      }
    } catch (error) {
      console.error('Failed to create document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create document: ${errorMessage}`);
    }
  }, [refreshDocuments, expandFolder, router]);

  const deleteDocument = useCallback(async (documentId: string) => {
    const isCurrentDocumentAffected = (node: DocumentNode): boolean => {
      if (node.id === selectedDocumentId) return true;
      if (node.children) {
        return node.children.some(child => isCurrentDocumentAffected(child));
      }
      return false;
    };

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

    const removeDocument = (nodes: DocumentNode[]): DocumentNode[] => {
      return nodes.filter(node => {
        if (node.id === documentId) return false;
        if (node.children) {
          node.children = removeDocument(node.children);
        }
        return true;
      });
    };

    // Always update the file tree to remove the deleted document
    const updatedDocs = removeDocument(documents);
    updateDocuments(updatedDocs);

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
      refreshDocuments();
    }
  }, [documents, updateDocuments, selectedDocumentId, router, refreshDocuments]);

  const renameDocument = useCallback(async (documentId: string, newTitle: string) => {
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

    const updatedDocs = updateDocumentTitle(documents);
    updateDocuments(updatedDocs);

    try {
      const api = getApiClient();
      await api.documents.updateDocument(documentId, {
        title: newTitle,
      });
    } catch (error) {
      console.error('Failed to rename document:', error);
      refreshDocuments();
    }
  }, [documents, updateDocuments, refreshDocuments]);

  const exportDocuments = useCallback(async (format: 'json' | 'markdown') => {
    try {
      const api = getApiClient();
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
      await api.request.request({
        method: 'POST',
        url: '/documents/sync',
        body: { direction },
        mediaType: 'application/json',
      });

      refreshDocuments();
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

        if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          content = await file.text();
        } else if (file.type.startsWith('image/')) {
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
              content = `Image: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n*Note: Image upload not available. Please use the editor to upload images.*`;
            }
          } catch {
            content = `Image: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n*Note: Image upload not available. Please use the editor to upload images.*`;
          }
        } else {
          content = `File: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n*This file type is not directly supported. The file information is shown above.*`;
        }

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

      const refreshWithRetry = async (attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
          refreshDocuments();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      };

      await refreshWithRetry();

      if (newParentId) {
        setTimeout(() => expandFolder(newParentId), 500);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Move failed: ${errorMessage}`);
      refreshDocuments();
    }
  }, [refreshDocuments, expandFolder]);

  // Use drag & drop hook
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDrop: originalHandleDrop,
    handleDragOver,
  } = useFileTreeDrag({
    onMove: moveDocument,
    onFileUpload: handleFileUpload,
  });

  // Add handling for dropping on files
  const handleDrop = useCallback((e: React.DragEvent, targetId?: string, targetType?: 'file' | 'folder' | 'scrap', parentId?: string) => {
    if (targetType === 'file' && parentId !== undefined) {
      // When dropped on a file, move to the file's parent folder
      originalHandleDrop(e, parentId, 'folder', undefined);
    } else if (targetId && targetType) {
      originalHandleDrop(e, targetId, targetType, parentId);
    }
  }, [originalHandleDrop]);

  // Helper function to check if any child folder has drop target
  const hasChildDropTarget = useCallback((node: DocumentNode): boolean => {
    if (!node.children || !dragState.dropTarget) return false;
    
    const checkRecursively = (children: DocumentNode[]): boolean => {
      return children.some(child => {
        if (child.id === dragState.dropTarget) return true;
        if (child.children) return checkRecursively(child.children);
        return false;
      });
    };
    
    return checkRecursively(node.children);
  }, [dragState.dropTarget]);

  // Helper function to find a document by ID
  const findDocument = useCallback((nodes: DocumentNode[], id: string): DocumentNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findDocument(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Get the file path of the selected document
  const selectedDocument = selectedDocumentId ? findDocument(documents, selectedDocumentId) : null;
  const selectedDocumentPath = selectedDocument?.file_path;

  // Node rendering function
  const renderNode = useCallback((node: DocumentNode, parentId?: string) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedDocumentId === node.id;
    const isDragging = dragState.draggedItem === node.id;
    const isDropTarget = dragState.dropTarget === node.id;
    const childHasDropTarget = hasChildDropTarget(node);

    if (node.type === 'folder') {
      return (
        <FolderNode
          key={node.id}
          node={node}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isDragging={isDragging}
          isDropTarget={isDropTarget}
          hasChildDropTarget={childHasDropTarget}
          onToggle={toggleFolder}
          onRename={renameDocument}
          onDelete={deleteDocument}
          onCreateNew={createNewDocument}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          renderChildren={() => node.children?.map(child => renderNode(child, node.id))}
        />
      );
    }

    return (
      <FileNode
        key={node.id}
        node={node}
        parentId={parentId}
        isSelected={isSelected}
        isDragging={isDragging}
        isDropTarget={false}
        isAuthenticated={!!user}
        onSelect={(id, type) => onDocumentSelect(id, type)}
        onRename={renameDocument}
        onDelete={deleteDocument}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />
    );
  }, [expandedFolders, selectedDocumentId, dragState, hasChildDropTarget, toggleFolder, onDocumentSelect, renameDocument, deleteDocument, createNewDocument, handleDragStart, handleDragEnd, handleDragEnter, handleDragLeave, handleDrop, handleDragOver, user]);

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <SidebarHeader className="px-2 py-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Files</span>
            <FileTreeActions
              onCreateDocument={() => {}}
              onCreateFolder={() => {}}
              onCreateScrap={() => {}}
              onExport={() => {}}
              onSync={() => {}}
              onRefresh={() => {}}
            />
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
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SidebarHeader className="px-2 py-2 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Files</span>
          <FileTreeActions
            onCreateDocument={() => createNewDocument(undefined, false, false)}
            onCreateFolder={() => createNewDocument(undefined, true, false)}
            onCreateScrap={() => createNewDocument(undefined, false, true)}
            onExport={exportDocuments}
            onSync={syncDocuments}
            onRefresh={refreshDocuments}
          />
        </div>
      </SidebarHeader>

      <SidebarContent
        className="relative"
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, '', 'folder')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, undefined, undefined)}
      >
        {/* Root drop zone overlay */}
        {((dragState.draggedItem && dragState.dropTarget === '') || (dragState.isExternalDrag && dragState.dropTarget === '')) && (
          <div className="absolute inset-0 bg-primary/5 border-l-2 border-l-primary z-0 pointer-events-none" />
        )}

        {/* External file drop feedback */}
        {dragState.isExternalDrag && !dragState.dropTarget && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-primary font-medium">Drop files here to add to root</p>
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
                {documents.map(node => renderNode(node))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <GitSyncButton onShowDiff={() => setShowGitDiff(true)} currentDocumentPath={selectedDocumentPath} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      
      <GitDiffDialog 
        open={showGitDiff} 
        onOpenChange={setShowGitDiff} 
      />
    </div>
  );
}

export const FileTree = React.memo(FileTreeComponent, (prevProps, nextProps) => {
  return (
    prevProps.selectedDocumentId === nextProps.selectedDocumentId &&
    prevProps.onDocumentSelect === nextProps.onDocumentSelect
  );
});