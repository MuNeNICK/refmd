"use client";

import React, { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileTree } from './file-tree';
import { Header } from './header';
import type { ViewMode } from '@/components/layout/header';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { PanelGroup, Panel, PanelResizeHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useIsMobile } from '@/hooks/use-mobile';

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
  onBacklinksToggle?: () => void;
  showBacklinks?: boolean;
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
  onBacklinksToggle,
  showBacklinks,
  showEditorFeatures = false,
  hideFileTree = false,
  isViewOnly = false
}: MainLayoutProps) {
  const router = useRouter();
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const isMobile = useIsMobile();
  
  // Sidebar state - default closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Set initial state based on screen size
  React.useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);
  
  // Handle sidebar toggle from header (desktop only)
  React.useEffect(() => {
    if (!isMobile && sidebarOpen && sidebarPanelRef.current) {
      // Force resize to default size when opening
      setTimeout(() => {
        sidebarPanelRef.current?.resize(13);
      }, 0);
    }
  }, [sidebarOpen, isMobile]);

  const handleDocumentSelect = useCallback((documentId: string, documentType?: 'file' | 'folder' | 'scrap') => {
    if (documentType === 'scrap') {
      router.push(`/scrap/${documentId}`);
    } else if (documentType !== 'folder') {
      router.push(`/document/${documentId}`);
    }
  }, [router]);

  const handlePanelResize = useCallback((sizes: number[]) => {
    if (!hideFileTree && sizes.length > 0) {
      const newSize = sizes[0];
      
      // Auto-close if dragged to less than 5%
      if (newSize < 5 && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
  }, [hideFileTree, sidebarOpen]);

  return (
    <SidebarProvider 
      defaultOpen={sidebarOpen} 
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
    >
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
          onBacklinksToggle={onBacklinksToggle}
          showBacklinks={showBacklinks}
          showEditorFeatures={showEditorFeatures}
          hideSidebarToggle={hideFileTree || false}
          isViewOnly={isViewOnly}
        />
        
        {/* Main content area with sidebar - Below header */}
        {isMobile ? (
          // Mobile layout - use standard Sidebar component
          <div className="flex flex-1 w-full overflow-hidden">
            {!hideFileTree && (
              <Sidebar variant="sidebar" collapsible="offcanvas">
                <FileTree
                  onDocumentSelect={handleDocumentSelect}
                  selectedDocumentId={selectedDocumentId}
                />
              </Sidebar>
            )}
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        ) : (
          // Desktop layout - use resizable panels
          <PanelGroup 
            direction="horizontal" 
            className="flex-1 w-full overflow-hidden"
            onLayout={handlePanelResize}
          >
            {/* Sidebar Panel */}
            {!hideFileTree && (
              <>
              <Panel 
                ref={sidebarPanelRef}
                defaultSize={sidebarOpen ? 13 : 0}
                minSize={sidebarOpen ? 3 : 0} 
                maxSize={sidebarOpen ? 40 : 0} 
                className="overflow-hidden"
                collapsible={true}
                onCollapse={() => setSidebarOpen(false)}
                onExpand={() => setSidebarOpen(true)}
              >
                <div className="h-full w-full bg-sidebar border-r" style={{ minWidth: '150px' }}>
                  <FileTree
                    onDocumentSelect={handleDocumentSelect}
                    selectedDocumentId={selectedDocumentId}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="bg-border hover:bg-primary/20 transition-colors" />
              </>
            )}
            
            {/* Content Panel */}
            <Panel className="overflow-hidden">
              <main className="h-full w-full overflow-hidden">
                {children}
              </main>
            </Panel>
          </PanelGroup>
        )}
      </div>
    </SidebarProvider>
  );
}