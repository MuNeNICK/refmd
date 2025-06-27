'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import MainLayout from '@/components/layout/main-layout';
import { ShareDialog } from '@/components/collaboration/share-dialog';
import { ViewMode } from '@/components/layout/header';
import { getApiClient } from '@/lib/api';
import type { Document } from '@/lib/api/client/models/Document';
import { toast } from 'sonner';
import { useSecondaryViewer } from '@/components/providers/secondary-viewer-provider';

// Dynamic import only the editor part
const DocumentEditor = dynamic(
  () => import('./document-editor'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading editor...</div>
      </div>
    )
  }
);

interface PageClientProps {
  documentId: string;
  initialDocument: (Document & { permission?: string }) | null;
  token?: string;
}

export default function PageClient({ documentId, initialDocument, token }: PageClientProps) {
  const api = getApiClient();
  const {
    secondaryDocumentId,
    secondaryDocumentType,
    showSecondaryViewer,
    setSecondaryDocumentId,
    setSecondaryDocumentType,
    setShowSecondaryViewer,
    openSecondaryViewer,
    closeSecondaryViewer
  } = useSecondaryViewer();
  
  const [isViewOnly] = useState(initialDocument?.permission === 'view');
  const [viewMode, setViewMode] = useState<ViewMode>(isViewOnly ? "preview" : "split");
  const [documentTitle] = useState<string>(initialDocument?.title || `Document ${documentId.slice(0, 8)}`);
  const [isShareLink] = useState(!!token);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | undefined>(undefined);
  const [synced, setSynced] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(1);
  const [currentContent, setCurrentContent] = useState(initialDocument?.content || '');
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  
  const handleOpenDocumentInSecondary = useCallback((docId: string, type: 'document' | 'scrap' = 'document') => {
    openSecondaryViewer(docId, type);
  }, [openSecondaryViewer]);

  // Determine if document is published and generate public URL
  const isDocumentPublished = currentDocument?.visibility === 'public' && !!currentDocument?.published_at;
  const generatePublicUrl = useCallback(() => {
    if (!isDocumentPublished || !currentDocument?.owner_username) return '';
    return `/u/${currentDocument.owner_username}/${documentId}`;
  }, [isDocumentPublished, currentDocument?.owner_username, documentId]);

  // Handle mobile view mode
  React.useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile && viewMode === "split" && !isViewOnly) {
        setViewMode("preview");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [viewMode, isViewOnly]);

  const handleSave = () => {
    // With Yjs, saves are automatic
    toast.success('Document is automatically saved');
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };


  const handleDownload = async () => {
    try {
      // Build the download URL with authentication
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];
      
      const headers: HeadersInit = {
        'Accept': 'application/zip',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Check if we're in a share context
      const urlParams = new URLSearchParams(window.location.search);
      const shareToken = urlParams.get('token');
      
      let downloadUrl = `${api.request.config.BASE}/documents/${documentId}/download`;
      if (shareToken) {
        downloadUrl += `?token=${shareToken}`;
      }
      
      // Use fetch without credentials to avoid CORS issues
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: token ? headers : undefined,
        // Don't include credentials to avoid CORS issues with wildcard
        credentials: 'omit',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename="')[1]?.replace('"', '')
        : `document-${documentId.slice(0, 8)}.zip`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback to simple markdown download
      const blob = new Blob([currentContent], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `document-${documentId.slice(0, 8)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleSyncStatusChange = useCallback((isSynced: boolean) => {
    setSynced(isSynced);
    if (isSynced) {
      setLastSaved(new Date());
    }
  }, []);

  const handleConnectionStatusChange = useCallback((isConnected: boolean) => {
    setConnected(isConnected);
  }, []);

  const handleActiveUsersChange = useCallback((count: number) => {
    setActiveUsers(count);
  }, []);

  const handleContentStatsChange = useCallback(() => {
    // Stats are handled by the editor
  }, []);

  const handleContentChange = useCallback((content: string) => {
    setCurrentContent(content);
  }, []);

  // Function to refresh document data
  const refreshDocument = useCallback(async () => {
    try {
      const refreshedDoc = await api.documents.getDocument(documentId, token);
      setCurrentDocument(refreshedDoc);
      
      // If we need to get owner username, fetch it if not already present
      if (refreshedDoc.visibility === 'public' && !refreshedDoc.owner_username) {
        // This might not be needed if the API always returns owner_username for public docs
        // But adding for completeness
        const docWithOwner = { ...refreshedDoc };
        if (!docWithOwner.owner_username && initialDocument?.owner_username) {
          docWithOwner.owner_username = initialDocument.owner_username;
        }
        setCurrentDocument(docWithOwner);
      }
    } catch (error) {
      console.error('Failed to refresh document:', error);
    }
  }, [api.documents, documentId, token, initialDocument?.owner_username]);

  // Show error if document couldn't be loaded
  if (!initialDocument && token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Share Link Error</h1>
          <p className="text-muted-foreground">
            This share link is invalid or has expired.
          </p>
          <a href="/auth/signin" className="text-primary hover:underline">
            Sign in to access your documents
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainLayout 
        selectedDocumentId={documentId}
        viewMode={viewMode}
        saveStatus={synced ? "saved" : "saving"}
        lastSaved={lastSaved}
        isRealtimeConnected={connected}
        realtimeUserCount={activeUsers}
        documentTitle={documentTitle}
        onViewModeChange={isViewOnly ? undefined : setViewMode}
        onSave={handleSave}
        onShare={handleShare}
        onDownload={handleDownload}
        onBacklinksToggle={() => setShowBacklinks(!showBacklinks)}
        showBacklinks={showBacklinks}
        onOpenDocumentInSecondary={handleOpenDocumentInSecondary}
        showEditorFeatures={!isViewOnly}
        hideFileTree={isShareLink}
        isViewOnly={isViewOnly}
      >
        <DocumentEditor
          documentId={documentId}
          initialDocument={currentDocument}
          token={token}
          viewMode={viewMode}
          showBacklinks={showBacklinks}
          showSecondaryViewer={showSecondaryViewer}
          secondaryDocumentId={secondaryDocumentId}
          secondaryDocumentType={secondaryDocumentType}
          isViewOnly={isViewOnly}
          onContentChange={handleContentChange}
          onSyncStatusChange={handleSyncStatusChange}
          onConnectionStatusChange={handleConnectionStatusChange}
          onActiveUsersChange={handleActiveUsersChange}
          onContentStatsChange={handleContentStatsChange}
          onBacklinksClose={() => setShowBacklinks(false)}
          onSecondaryDocumentClose={closeSecondaryViewer}
          onSecondaryDocumentChange={(id, type) => {
            setSecondaryDocumentId(id);
            if (type) setSecondaryDocumentType(type);
          }}
        />
      </MainLayout>
      
      <ShareDialog 
        open={shareDialogOpen} 
        onOpenChange={setShareDialogOpen}
        resourceId={documentId}
        resourceType="document"
        isPublished={isDocumentPublished}
        publicUrl={generatePublicUrl()}
        onPublishChange={async () => {
          // Refresh document data to reflect the new publish state
          await refreshDocument();
        }}
      />
    </>
  );
}