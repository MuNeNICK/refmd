"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MonacoLoader as MarkdownEditor } from "@/components/editor/monaco-loader";
import { PreviewPane } from "@/components/editor/preview-pane";
import { ViewMode } from "@/components/layout/header";
import type { Document } from '@/lib/api/client/models/Document';
import { useSocketConnection } from '@/lib/hooks/useSocketConnection';
import { useCollaborativeDocument } from '@/lib/hooks/useCollaborativeDocument';
import { useFileUpload } from '@/lib/hooks/useFileUpload';
import { useDragAndDrop } from '@/lib/hooks/useDragAndDrop';
import { toast } from 'sonner';
import { PanelGroup, Panel, PanelResizeHandle } from '@/components/ui/resizable';
import type { editor } from 'monaco-editor';
import { useAuth } from '@/lib/auth/authContext';
import { BacklinksPanel } from '@/components/document/backlinks-panel';
import { SecondaryViewer } from '@/components/document/secondary-viewer';

interface DocumentEditorProps {
  documentId: string;
  initialDocument: Document | null;
  token?: string;
  viewMode: ViewMode;
  showBacklinks?: boolean;
  showSecondaryViewer?: boolean;
  secondaryDocumentId?: string | null;
  secondaryDocumentType?: 'document' | 'scrap';
  isViewOnly?: boolean;
  onContentChange?: (content: string) => void;
  onSyncStatusChange?: (synced: boolean) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
  onActiveUsersChange?: (count: number) => void;
  onContentStatsChange?: (stats: { wordCount: number; charCount: number }) => void;
  onBacklinksClose?: () => void;
  onSecondaryDocumentClose?: () => void;
  onSecondaryDocumentChange?: (documentId: string, type?: 'document' | 'scrap') => void;
}

export default function DocumentEditor({ 
  documentId, 
  initialDocument, 
  token,
  viewMode,
  showBacklinks = false,
  showSecondaryViewer = false,
  secondaryDocumentId = null,
  secondaryDocumentType = 'document',
  isViewOnly = false,
  onContentChange,
  onSyncStatusChange,
  onConnectionStatusChange,
  onActiveUsersChange,
  onContentStatsChange,
  onBacklinksClose,
  onSecondaryDocumentClose,
  onSecondaryDocumentChange
}: DocumentEditorProps) {
  const [selectedLine] = useState<number | undefined>();
  const [editorScrollPercentage, setEditorScrollPercentage] = useState(0);
  const [previewScrollPercentage, setPreviewScrollPercentage] = useState(0);
  const [syncScroll, setSyncScroll] = useState(true);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const insertTextRef = useRef<((text: string) => void) | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Get user info from auth context
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // Auth context may not be available in share mode
  }
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Socket connection
  const { socket } = useSocketConnection({ token });

  // Collaborative document
  const { 
    doc, 
    provider, 
    awareness, 
    connected,
    getText 
  } = useCollaborativeDocument({
    documentId,
    socket,
    shareToken: token,
    onSync: (isSynced) => {
      onSyncStatusChange?.(isSynced);
    },
    onConnectionError: (error) => {
      console.error('[DocumentEditor] Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Connection error: ' + errorMessage);
    },
  });

  // Get current content for preview
  const [content, setContent] = useState(initialDocument?.content || "");
  
  useEffect(() => {
    if (!doc) return;
    
    const yText = getText();
    if (!yText) return;

    // Debounce content updates to improve performance
    let timeoutId: NodeJS.Timeout | null = null;
    let rafId: number | null = null;
    
    // Update content when Yjs document changes - defined inside effect for stable reference
    const updateContent = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Use shorter debounce for faster typing response
      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(() => {
          const newContent = yText.toString();
          setContent(newContent);
          onContentChange?.(newContent);
        });
      }, 50); // Reduced debounce to 50ms for faster response
    };

    // Initial content
    const initialContent = yText.toString();
    setContent(initialContent);
    onContentChange?.(initialContent);

    // Listen for changes
    yText.observe(updateContent);

    return () => {
      // First unobserve to prevent any more updates
      try {
        yText.unobserve(updateContent);
      } catch (error) {
        // Ignore "event handler doesn't exist" errors
        if (!(error as Error)?.message?.includes('event handler')) {
          console.error('Error unobserving yText:', error);
        }
      }
      
      // Then clean up timers
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Force immediate content update on unmount
      try {
        const finalContent = yText.toString();
        setContent(finalContent);
        onContentChange?.(finalContent);
      } catch (error) {
        // yText might be destroyed already
        console.error('Error getting final content:', error);
      }
    };
  }, [doc, getText, onContentChange]);

  // Update connection status
  useEffect(() => {
    onConnectionStatusChange?.(connected);
  }, [connected, onConnectionStatusChange]);

  // Update active users
  useEffect(() => {
    if (!awareness || (awareness as unknown as { _destroyed?: boolean })._destroyed) return;

    const updateActiveUsers = () => {
      const activeUsers = awareness.getStates().size || 1;
      onActiveUsersChange?.(activeUsers);
    };

    // Initial update
    updateActiveUsers();

    // Listen for awareness updates
    const handler = () => {
      updateActiveUsers();
    };

    awareness.on('update', handler);

    return () => {
      // Check if awareness still exists and hasn't been destroyed
      if (awareness && typeof awareness.off === 'function' && !(awareness as unknown as { _destroyed?: boolean })._destroyed) {
        try {
          awareness.off('update', handler);
        } catch (error) {
          // Ignore errors when removing handlers - awareness might already be destroyed
          if (!(error as Error)?.message?.includes('event handler')) {
            console.error('Error removing awareness handler:', error);
          }
        }
      }
    };
  }, [awareness, onActiveUsersChange]);

  // Handle scroll synchronization
  const isScrollingRef = useRef<'editor' | 'preview' | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEditorScroll = useCallback((scrollTop: number, scrollPercentage: number) => {
    if (isScrollingRef.current === 'preview') return;
    
    isScrollingRef.current = 'editor';
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Only update the preview scroll if sync is enabled
    if (syncScroll) {
      setEditorScrollPercentage(scrollPercentage);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = null;
    }, 150);
  }, [syncScroll]);

  const handlePreviewScroll = useCallback((scrollTop: number, scrollPercentage: number) => {
    if (isScrollingRef.current === 'editor') return;
    
    isScrollingRef.current = 'preview';
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Only update the editor scroll if sync is enabled
    if (syncScroll) {
      setPreviewScrollPercentage(scrollPercentage);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = null;
    }, 150);
  }, [syncScroll]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // Handle visibility change to save when tab loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && provider) {
        // Flush any pending updates when tab becomes hidden
        provider.flushPendingUpdates();
        
        // Also force immediate content save
        const yText = getText();
        if (yText) {
          const finalContent = yText.toString();
          onContentChange?.(finalContent);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [provider, getText, onContentChange]);
  
  // File upload functionality
  const insertTextAtCursor = useCallback((text: string) => {
    if (insertTextRef.current) {
      insertTextRef.current(text);
    } else {
      // Insert text function not available
    }
  }, []);
  
  const { handleFileUpload, triggerFileUpload, fileInputRef, fileInputProps } = useFileUpload({
    documentId,
    onInsertText: insertTextAtCursor,
    insertMode: 'individual'
  });
  
  // Drag and drop functionality
  const { isDragOver } = useDragAndDrop({
    onFilesDrop: handleFileUpload,
    element: editorContainerRef.current
  });
  
  // Handle editor mount
  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);
  
  // Handle editor ready with insert text function
  const handleEditorReady = useCallback((insertText: (text: string) => void) => {
    insertTextRef.current = insertText;
  }, []);

  // Handle checkbox changes in preview
  const handleCheckboxChange = useCallback((checkboxIndex: number, checked: boolean) => {
    if (!doc) return;
    
    const yText = getText();
    if (!yText) return;
    
    const content = yText.toString();
    const lines = content.split('\n');
    
    // Find the nth checkbox in the document
    let checkboxCount = 0;
    let targetLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match task list item pattern: - [ ] or - [x]
      if (/^\s*[-*+]\s+\[([ xX])\]/.test(line)) {
        if (checkboxCount === checkboxIndex) {
          targetLineIndex = i;
          break;
        }
        checkboxCount++;
      }
    }
    
    if (targetLineIndex === -1) {
      console.warn(`Checkbox not found at index ${checkboxIndex}`);
      return;
    }
    
    const line = lines[targetLineIndex];
    const checkboxMatch = line.match(/^(\s*[-*+]\s+\[)([ xX])(\])/);
    if (!checkboxMatch) {
      console.warn(`Invalid checkbox format at line ${targetLineIndex}: ${line}`);
      return;
    }
    
    // Calculate the position in the document
    let position = 0;
    for (let i = 0; i < targetLineIndex; i++) {
      position += lines[i].length + 1; // +1 for newline
    }
    
    // Add the position of the checkbox state within the line
    const prefixLength = checkboxMatch[1].length;
    const statePosition = position + prefixLength;
    
    // Create a transaction to update the checkbox state
    doc.transact(() => {
      // Delete the old state character
      yText.delete(statePosition, 1);
      // Insert the new state character
      yText.insert(statePosition, checked ? 'x' : ' ');
    }, doc.clientID); // Use the doc's clientID as origin
  }, [doc, getText]);

  // Memoize the PreviewPane to prevent unnecessary re-renders
  const MemoizedPreviewPane = useMemo(() => {
    return React.memo(PreviewPane);
  }, []);

  // Show only BacklinksPanel or SecondaryViewer in full screen on mobile when enabled
  if (isMobile && showBacklinks) {
    return (
      <div className="h-full w-full bg-background">
        <BacklinksPanel documentId={documentId} className="h-full" onClose={onBacklinksClose} />
      </div>
    );
  }
  
  if (isMobile && showSecondaryViewer) {
    return (
      <div className="h-full w-full bg-background">
        <SecondaryViewer 
          documentId={secondaryDocumentId} 
          documentType={secondaryDocumentType}
          className="h-full" 
          onClose={onSecondaryDocumentClose}
          onDocumentChange={onSecondaryDocumentChange}
        />
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full flex overflow-hidden" ref={editorContainerRef}>
        {viewMode === "editor" && !showBacklinks && !showSecondaryViewer && (
            <div className="h-full w-full">
              <MarkdownEditor
              doc={doc}
              awareness={awareness}
              connected={connected}
              onMount={handleEditorMount}
              onScroll={handleEditorScroll}
              scrollToLine={selectedLine}
              onContentStatsChange={onContentStatsChange}
              syncScroll={syncScroll}
              onSyncScrollToggle={() => setSyncScroll(!syncScroll)}
              viewMode={viewMode}
              onFileUpload={triggerFileUpload}
              isDragOver={isDragOver}
              onEditorReady={handleEditorReady}
              userName={user?.name || undefined}
              userId={user?.id || undefined}
              documentPath={initialDocument?.file_path || undefined}
              readOnly={isViewOnly}
              />
            </div>
          )}
          
          {viewMode === "editor" && showBacklinks && !showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={70} minSize={30}>
                <MarkdownEditor
                  doc={doc}
                  readOnly={isViewOnly}
                  awareness={awareness}
                  connected={connected}
                  onMount={handleEditorMount}
                  onScroll={handleEditorScroll}
                  scrollToLine={selectedLine}
                  onContentStatsChange={onContentStatsChange}
                  syncScroll={syncScroll}
                  onSyncScrollToggle={() => setSyncScroll(!syncScroll)}
                  viewMode={viewMode}
                  onFileUpload={triggerFileUpload}
                  isDragOver={isDragOver}
                  onEditorReady={handleEditorReady}
                  userName={user?.name || undefined}
                  userId={user?.id || undefined}
                  documentPath={initialDocument?.file_path || undefined}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                <BacklinksPanel documentId={documentId} className="h-full border-l" onClose={onBacklinksClose} />
              </Panel>
            </PanelGroup>
          )}
          
          {viewMode === "editor" && !showBacklinks && showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={70} minSize={30}>
                <MarkdownEditor
                  doc={doc}
                  readOnly={isViewOnly}
                  awareness={awareness}
                  connected={connected}
                  onMount={handleEditorMount}
                  onScroll={handleEditorScroll}
                  scrollToLine={selectedLine}
                  onContentStatsChange={onContentStatsChange}
                  syncScroll={syncScroll}
                  onSyncScrollToggle={() => setSyncScroll(!syncScroll)}
                  viewMode={viewMode}
                  onFileUpload={triggerFileUpload}
                  isDragOver={isDragOver}
                  onEditorReady={handleEditorReady}
                  userName={user?.name || undefined}
                  userId={user?.id || undefined}
                  documentPath={initialDocument?.file_path || undefined}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                <SecondaryViewer 
                  documentId={secondaryDocumentId} 
                  documentType={secondaryDocumentType}
                  className="h-full border-l" 
                  onClose={onSecondaryDocumentClose}
                  onDocumentChange={onSecondaryDocumentChange}
                />
              </Panel>
            </PanelGroup>
          )}
          
          {viewMode === "preview" && !showBacklinks && !showSecondaryViewer && (
            <div className="h-full w-full">
              <MemoizedPreviewPane
                content={content}
                onScroll={handlePreviewScroll}
                scrollPercentage={editorScrollPercentage}
                documentId={documentId}
                viewMode={viewMode}
                contentStats={{ wordCount: 0, charCount: 0 }}
                token={token}
                onCheckboxChange={handleCheckboxChange}
              />
            </div>
          )}
          
          {viewMode === "preview" && showBacklinks && !showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={70} minSize={30}>
                <MemoizedPreviewPane
                  content={content}
                  onScroll={handlePreviewScroll}
                  scrollPercentage={editorScrollPercentage}
                  documentId={documentId}
                  viewMode={viewMode}
                  contentStats={{ wordCount: 0, charCount: 0 }}
                  token={token}
                  onCheckboxChange={handleCheckboxChange}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                <BacklinksPanel documentId={documentId} className="h-full border-l" onClose={onBacklinksClose} />
              </Panel>
            </PanelGroup>
          )}
          
          {viewMode === "preview" && !showBacklinks && showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={50} minSize={30}>
                <MemoizedPreviewPane
                  content={content}
                  onScroll={handlePreviewScroll}
                  scrollPercentage={editorScrollPercentage}
                  documentId={documentId}
                  viewMode={viewMode}
                  contentStats={{ wordCount: 0, charCount: 0 }}
                  token={token}
                  onCheckboxChange={handleCheckboxChange}
                  forceFloatingToc={true}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={50} minSize={20} maxSize={70}>
                <SecondaryViewer 
                  documentId={secondaryDocumentId} 
                  documentType={secondaryDocumentType}
                  className="h-full border-l" 
                  onClose={onSecondaryDocumentClose}
                  onDocumentChange={onSecondaryDocumentChange}
                />
              </Panel>
            </PanelGroup>
          )}
          
          {viewMode === "split" && !showBacklinks && !showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={50} minSize={30}>
                <MarkdownEditor
                  doc={doc}
                  readOnly={isViewOnly}
                  awareness={awareness}
                  connected={connected}
                  onMount={handleEditorMount}
                  onScroll={handleEditorScroll}
                  scrollPercentage={syncScroll ? previewScrollPercentage : undefined}
                  scrollToLine={selectedLine}
                  onContentStatsChange={onContentStatsChange}
                  syncScroll={syncScroll}
                  onSyncScrollToggle={() => setSyncScroll(!syncScroll)}
                  viewMode={viewMode}
                  onFileUpload={triggerFileUpload}
                  isDragOver={isDragOver}
                  onEditorReady={handleEditorReady}
                  userName={user?.name || undefined}
                  userId={user?.id || undefined}
                  documentPath={initialDocument?.file_path || undefined}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full border-l">
                  <MemoizedPreviewPane
                    content={content}
                    onScroll={handlePreviewScroll}
                    scrollPercentage={syncScroll ? editorScrollPercentage : undefined}
                    documentId={documentId}
                    viewMode={viewMode}
                    contentStats={{ wordCount: 0, charCount: 0 }}
                    token={token}
                    onCheckboxChange={handleCheckboxChange}
                  />
                </div>
              </Panel>
            </PanelGroup>
          )}
          
          {viewMode === "split" && showBacklinks && !showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={35} minSize={20}>
                <MarkdownEditor
                  doc={doc}
                  readOnly={isViewOnly}
                  awareness={awareness}
                  connected={connected}
                  onMount={handleEditorMount}
                  onScroll={handleEditorScroll}
                  scrollPercentage={syncScroll ? previewScrollPercentage : undefined}
                  scrollToLine={selectedLine}
                  onContentStatsChange={onContentStatsChange}
                  syncScroll={syncScroll}
                  onSyncScrollToggle={() => setSyncScroll(!syncScroll)}
                  viewMode={viewMode}
                  onFileUpload={triggerFileUpload}
                  isDragOver={isDragOver}
                  onEditorReady={handleEditorReady}
                  userName={user?.name || undefined}
                  userId={user?.id || undefined}
                  documentPath={initialDocument?.file_path || undefined}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={35} minSize={20}>
                <div className="h-full border-l">
                  <MemoizedPreviewPane
                    content={content}
                    onScroll={handlePreviewScroll}
                    scrollPercentage={syncScroll ? editorScrollPercentage : undefined}
                    documentId={documentId}
                    viewMode={viewMode}
                    contentStats={{ wordCount: 0, charCount: 0 }}
                    token={token}
                    onCheckboxChange={handleCheckboxChange}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={30} minSize={20} maxSize={40}>
                <BacklinksPanel documentId={documentId} className="h-full border-l" onClose={onBacklinksClose} />
              </Panel>
            </PanelGroup>
          )}
          
          {viewMode === "split" && !showBacklinks && showSecondaryViewer && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={33.33} minSize={20}>
                <MarkdownEditor
                  doc={doc}
                  readOnly={isViewOnly}
                  awareness={awareness}
                  connected={connected}
                  onMount={handleEditorMount}
                  onScroll={handleEditorScroll}
                  scrollPercentage={syncScroll ? previewScrollPercentage : undefined}
                  scrollToLine={selectedLine}
                  onContentStatsChange={onContentStatsChange}
                  syncScroll={syncScroll}
                  onSyncScrollToggle={() => setSyncScroll(!syncScroll)}
                  viewMode={viewMode}
                  onFileUpload={triggerFileUpload}
                  isDragOver={isDragOver}
                  onEditorReady={handleEditorReady}
                  userName={user?.name || undefined}
                  userId={user?.id || undefined}
                  documentPath={initialDocument?.file_path || undefined}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={33.33} minSize={20}>
                <div className="h-full bg-background">
                  <MemoizedPreviewPane
                    content={content}
                    onScroll={handlePreviewScroll}
                    scrollPercentage={syncScroll ? editorScrollPercentage : undefined}
                    documentId={documentId}
                    viewMode={viewMode}
                    contentStats={{ wordCount: 0, charCount: 0 }}
                    token={token}
                    onCheckboxChange={handleCheckboxChange}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
              <Panel defaultSize={33.34} minSize={20} maxSize={50}>
                <SecondaryViewer 
                  documentId={secondaryDocumentId} 
                  documentType={secondaryDocumentType}
                  className="h-full border-l" 
                  onClose={onSecondaryDocumentClose}
                  onDocumentChange={onSecondaryDocumentChange}
                />
              </Panel>
            </PanelGroup>
          )}
      </div>
      
      {/* Hidden file input for toolbar upload */}
      <input ref={fileInputRef} {...fileInputProps} />
    </>
  );
}