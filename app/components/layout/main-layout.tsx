"use client";

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileTree } from './file-tree';
import { Header } from './header';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/components/layout/header';

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
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleDocumentSelect = useCallback((documentId: string) => {
    router.push(`/document/${documentId}`);
  }, [router]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
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
          onToggleSidebar={() => setSidebarOpen(true)}
          hideSidebarToggle={hideFileTree}
          isViewOnly={isViewOnly}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        {!hideFileTree && (
          <div className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar backdrop-blur-sm transition-transform duration-200 lg:relative lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <FileTree
              onDocumentSelect={(documentId) => {
                handleDocumentSelect(documentId);
                setSidebarOpen(false);
              }}
              selectedDocumentId={selectedDocumentId}
              className="h-full"
            />
          </div>
        )}
        
        {/* Scrollable Content Area */}
        <div className="flex-1 min-w-0 bg-background overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}