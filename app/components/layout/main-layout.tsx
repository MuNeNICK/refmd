"use client";

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileTree } from './file-tree';
import { Header } from './header';
import type { ViewMode } from '@/components/layout/header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  selectedDocumentId?: string;
  // Editor-specific props
  viewMode?: ViewMode;
  saveStatus?: 'saving' | 'saved' | 'error';
  lastSaved?: Date;
  isRealtimeConnected?: boolean;
  realtimeUserCount?: number;
  documentTitle?: string;
  onViewModeChange?: (mode: ViewMode) => void;
  onSave?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  showEditorFeatures?: boolean;
  hideFileTree?: boolean;
  isViewOnly?: boolean;
}

export default function MainLayout({ 
  children, 
  selectedDocumentId,
  viewMode,
  saveStatus,
  lastSaved,
  isRealtimeConnected,
  realtimeUserCount,
  documentTitle,
  onViewModeChange,
  onSave,
  onShare,
  onDownload,
  showEditorFeatures = false,
  hideFileTree = false,
  isViewOnly = false
}: MainLayoutProps) {
  const router = useRouter();

  const handleDocumentSelect = useCallback((documentId: string) => {
    router.push(`/document/${documentId}`);
  }, [router]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        {/* Fixed Header - Full width at top */}
        <Header 
          viewMode={viewMode}
          saveStatus={saveStatus}
          lastSaved={lastSaved}
          isRealtimeConnected={isRealtimeConnected}
          realtimeUserCount={realtimeUserCount}
          documentTitle={documentTitle}
          onViewModeChange={onViewModeChange}
          onSave={onSave}
          onShare={onShare}
          onDownload={onDownload}
          showEditorFeatures={showEditorFeatures}
          hideSidebarToggle={hideFileTree}
          isViewOnly={isViewOnly}
        />
        
        {/* Main content area with sidebar - Below header */}
        <div className="flex flex-1 w-full overflow-hidden">
          {/* Sidebar */}
          {!hideFileTree && (
            <FileTree
              onDocumentSelect={handleDocumentSelect}
              selectedDocumentId={selectedDocumentId}
            />
          )}
          
          {/* Content Area - SidebarInset wraps the content and handles spacing */}
          <SidebarInset className="flex-1 overflow-hidden">
            <main className="h-full w-full overflow-hidden">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}