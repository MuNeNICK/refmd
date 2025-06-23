'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import MainLayout from '@/components/layout/main-layout';
import { ShareDialog } from '@/components/collaboration/share-dialog';
import { ViewMode } from '@/components/layout/header';
import { getApiClient } from '@/lib/api';
import type { Document } from '@/lib/api/client/models/Document';
import { toast } from 'sonner';

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
  initialDocument: Document | null;
  token?: string;
}

export default function PageClient({ documentId, initialDocument, token }: PageClientProps) {
  const api = getApiClient();
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [documentTitle] = useState<string>(initialDocument?.title || `Document ${documentId.slice(0, 8)}`);
  const [isShareLink] = useState(!!token);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isViewOnly] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | undefined>(undefined);
  const [synced, setSynced] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(1);
  const [currentContent, setCurrentContent] = useState(initialDocument?.content || '');

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
        showEditorFeatures={!isViewOnly}
        hideFileTree={isShareLink}
        isViewOnly={isViewOnly}
      >
        <DocumentEditor
          documentId={documentId}
          initialDocument={initialDocument}
          token={token}
          viewMode={viewMode}
          onContentChange={handleContentChange}
          onSyncStatusChange={handleSyncStatusChange}
          onConnectionStatusChange={handleConnectionStatusChange}
          onActiveUsersChange={handleActiveUsersChange}
          onContentStatsChange={handleContentStatsChange}
        />
      </MainLayout>
      
      <ShareDialog 
        open={shareDialogOpen} 
        onOpenChange={setShareDialogOpen}
        resourceId={documentId}
        resourceType="document"
      />
    </>
  );
}