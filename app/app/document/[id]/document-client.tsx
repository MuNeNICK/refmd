"use client";

import { useState, useEffect } from "react";
import DocumentEditor from "./document-editor";
import { ViewMode } from "@/components/layout/header";
import MainLayout from "@/components/layout/main-layout";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { ShareDialog } from "@/components/collaboration/share-dialog";
import { getApiClient } from '@/lib/api';
import type { Document } from '@/lib/api/client/models/Document';

interface DocumentClientProps {
  documentId: string;
  initialDocument: Document | null;
  token?: string;
}

export default function DocumentClient({ documentId, initialDocument, token }: DocumentClientProps) {
  const api = getApiClient();
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [content, setContent] = useState(initialDocument?.content || "");
  const [documentTitle] = useState<string>(initialDocument?.title || `Document ${documentId.slice(0, 8)}`);
  const [isContentLoaded] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<{ isConnected: boolean; userCount: number; permission?: string | null }>({ isConnected: false, userCount: 0 });
  const [isShareLink] = useState(!!token);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isViewOnly] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | undefined>(undefined);

  // Handle mobile view mode
  useEffect(() => {
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

  // Auto-save functionality for collaborative documents (only if user has edit permission)
  useAutoSave({
    content,
    delay: 2000,
    onSave: async () => {
      // Save to database via API to ensure persistence
      if (content.trim() && !isViewOnly) {
        try {
          if (token) {
            // For share links, use raw request with token
            await api.request.request({
              method: 'PUT',
              url: `/documents/${documentId}?token=${token}`,
              body: { content },
              mediaType: 'application/json',
            });
            setLastSaved(new Date());
          } else {
            // For authenticated users, use the API client
            await api.documents.updateDocument(documentId, {
              content,
            });
            setLastSaved(new Date());
          }
        } catch (error) {
          console.error('Error auto-saving document:', error);
        }
      }
    }
  });


  const handleSave = () => {
    // For collaborative documents, this could trigger a manual save
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleDownload = async () => {
    try {
      // Use the new bundled download API endpoint
      const response = await api.request.request({
        method: 'GET',
        url: `/documents/${documentId}/download`,
      }) as Response;
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename="')[1]?.replace('"', '')
        : `document-${documentId.slice(0, 8)}_with_files.zip`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback to simple markdown download
      const blob = new Blob([content], { type: "text/markdown" });
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

  return (
    <MainLayout 
      selectedDocumentId={documentId}
      viewMode={viewMode}
      saveStatus="saved"
      lastSaved={lastSaved}
      isRealtimeConnected={realtimeStatus.isConnected}
      realtimeUserCount={realtimeStatus.userCount}
      documentTitle={documentTitle}
      onViewModeChange={isViewOnly ? undefined : setViewMode}
      onSave={handleSave}
      onShare={handleShare}
      onDownload={handleDownload}
      showEditorFeatures={!isViewOnly}
      hideFileTree={isShareLink}
      isViewOnly={isViewOnly}
    >
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0">
          {isContentLoaded && (
            <DocumentEditor 
              documentId={documentId}
              initialDocument={initialDocument}
              token={token}
              viewMode={viewMode}
              onContentChange={setContent}
              onConnectionStatusChange={(connected) => {
                setRealtimeStatus(prev => ({ ...prev, isConnected: connected }));
              }}
              onActiveUsersChange={(count) => {
                setRealtimeStatus(prev => ({ ...prev, userCount: count }));
              }}
            />
          )}
        </div>
      </div>
      
      <ShareDialog 
        open={shareDialogOpen} 
        onOpenChange={setShareDialogOpen}
        resourceId={documentId}
        resourceType="document"
      />
    </MainLayout>
  );
}