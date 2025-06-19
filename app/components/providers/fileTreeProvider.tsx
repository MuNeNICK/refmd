'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/authContext';
import { getApiClient } from '@/lib/api';
import type { Document } from '@/lib/api/client';

interface DocumentNode {
  id: string;
  title: string;
  type: 'file' | 'folder' | 'scrap';
  children?: DocumentNode[];
  created_at?: string;
  updated_at?: string;
}

interface FileTreeContextType {
  documents: DocumentNode[];
  expandedFolders: Set<string>;
  loading: boolean;
  toggleFolder: (folderId: string) => void;
  expandFolder: (folderId: string) => void;
  expandParentFolders: (documentId: string) => void;
  fetchDocuments: () => Promise<void>;
  refreshDocuments: () => void;
  updateDocuments: (documents: DocumentNode[]) => void;
}

const FileTreeContext = createContext<FileTreeContextType | undefined>(undefined);

interface DatabaseDocument {
  id: string;
  title: string;
  is_folder: boolean;
  type?: 'document' | 'folder' | 'scrap';
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

// Extended Document type that includes fields not in the generated type
interface ExtendedDocument extends Omit<Document, 'id' | 'title' | 'created_at' | 'updated_at'> {
  id?: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  is_folder?: boolean;
  type?: Document.type;  // Rust backend returns 'type' field
  parent_id?: string;
}

function buildTree(documents: DatabaseDocument[]): DocumentNode[] {
  const nodeMap = new Map<string, DocumentNode>();
  
  documents.forEach(doc => {
    // Determine the type based on the 'type' field from the database
    let nodeType: 'file' | 'folder' | 'scrap';
    if (doc.type === 'scrap') {
      nodeType = 'scrap';
    } else if (doc.type === 'folder' || doc.is_folder) {
      nodeType = 'folder';
    } else {
      nodeType = 'file';
    }
    
    nodeMap.set(doc.id, {
      id: doc.id,
      title: doc.title,
      type: nodeType,
      children: [],
      created_at: doc.created_at,
      updated_at: doc.updated_at
    });
  });
  
  const rootNodes: DocumentNode[] = [];
  
  documents.forEach(doc => {
    const node = nodeMap.get(doc.id)!;
    if (doc.parent_id && nodeMap.has(doc.parent_id)) {
      const parent = nodeMap.get(doc.parent_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  const sortNodes = (nodes: DocumentNode[]): DocumentNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });
  };

  const sortTree = (nodes: DocumentNode[]): DocumentNode[] => {
    const sorted = sortNodes(nodes);
    sorted.forEach(node => {
      if (node.children) {
        node.children = sortTree(node.children);
      }
    });
    return sorted;
  };
  
  return sortTree(rootNodes);
}

export function FileTreeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const api = getApiClient();

  // Use React Query for fetching documents
  const { data: documents = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const response = await api.documents.listDocuments();
      
      // Handle both array response and object with data property
      const docs = Array.isArray(response) ? response : response.data;
      
      if (docs && docs.length > 0) {
        // Convert API documents to DatabaseDocument format, filtering out incomplete documents
        const dbDocs: DatabaseDocument[] = docs
          .filter(doc => doc.id && doc.title && doc.created_at && doc.updated_at)
          .map(doc => {
            const extDoc = doc as ExtendedDocument;
            // Check both 'is_folder' and 'type' fields for folder detection
            const isFolder = extDoc.is_folder || extDoc.type === 'folder';
            return {
              id: doc.id!,
              title: doc.title!,
              is_folder: isFolder,
              type: extDoc.type as 'document' | 'folder' | 'scrap' | undefined,
              parent_id: extDoc.parent_id,
              created_at: doc.created_at!,
              updated_at: doc.updated_at!
            };
          });
        
        return buildTree(dbDocs);
      }
      return [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const fetchDocuments = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const expandFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => new Set(prev).add(folderId));
  }, []);

  const expandParentFolders = useCallback((documentId: string) => {
    // Find all parent folders of the document and expand them
    const findParentFolders = (nodes: DocumentNode[], targetId: string, parents: string[] = []): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return parents;
        }
        if (node.children) {
          const result = findParentFolders(node.children, targetId, [...parents, node.id]);
          if (result) return result;
        }
      }
      return null;
    };

    const parentFolders = findParentFolders(documents, documentId);
    if (parentFolders) {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        parentFolders.forEach(folderId => newSet.add(folderId));
        return newSet;
      });
    }
  }, [documents]);

  const refreshDocuments = useCallback(() => {
    // Invalidate and refetch the documents query
    queryClient.invalidateQueries({ queryKey: ['documents', user?.id] });
  }, [queryClient, user]);

  const updateDocuments = useCallback((newDocuments: DocumentNode[]) => {
    // Update the query cache directly
    queryClient.setQueryData(['documents', user?.id], newDocuments);
  }, [queryClient, user]);

  const value: FileTreeContextType = {
    documents,
    expandedFolders,
    loading,
    toggleFolder,
    expandFolder,
    expandParentFolders,
    fetchDocuments,
    refreshDocuments,
    updateDocuments,
  };

  return (
    <FileTreeContext.Provider value={value}>
      {children}
    </FileTreeContext.Provider>
  );
}

export function useFileTree() {
  const context = useContext(FileTreeContext);
  if (context === undefined) {
    throw new Error('useFileTree must be used within a FileTreeProvider');
  }
  return context;
}