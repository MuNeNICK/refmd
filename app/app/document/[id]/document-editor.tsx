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

interface DocumentEditorProps {
  documentId: string;
  initialDocument: Document | null;
  token?: string;
  viewMode: ViewMode;
  onContentChange?: (content: string) => void;
  onSyncStatusChange?: (synced: boolean) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
  onActiveUsersChange?: (count: number) => void;
  onContentStatsChange?: (stats: { wordCount: number; charCount: number }) => void;
}

export default function DocumentEditor({ 
  documentId, 
  initialDocument, 
  token,
  viewMode,
  onContentChange,
  onSyncStatusChange,
  onConnectionStatusChange,
  onActiveUsersChange,
  onContentStatsChange
}: DocumentEditorProps) {
  const [selectedLine] = useState<number | undefined>();
  const [editorScrollPercentage, setEditorScrollPercentage] = useState(0);
  const [previewScrollPercentage, setPreviewScrollPercentage] = useState(0);
  const [syncScroll, setSyncScroll] = useState(true);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const insertTextRef = useRef<((text: string) => void) | null>(null);
  
  // Get user info from auth context
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // Auth context may not be available in share mode
  }

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
    
    // Update content when Yjs document changes
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      // Force immediate content update on unmount
      const finalContent = yText.toString();
      setContent(finalContent);
      onContentChange?.(finalContent);
      yText.unobserve(updateContent);
    };
  }, [doc, getText, onContentChange]);

  // Update connection status
  useEffect(() => {
    onConnectionStatusChange?.(connected);
  }, [connected, onConnectionStatusChange]);

  // Update active users
  useEffect(() => {
    if (!awareness) return;

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
      awareness.off('update', handler);
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

  // Memoize the PreviewPane to prevent unnecessary re-renders
  const MemoizedPreviewPane = useMemo(() => {
    return React.memo(PreviewPane);
  }, []);

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden" ref={editorContainerRef}>
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === "editor" && (
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
            />
          )}
          
          {viewMode === "preview" && (
            <MemoizedPreviewPane
              content={content}
              onScroll={handlePreviewScroll}
              scrollPercentage={editorScrollPercentage}
              documentId={documentId}
              viewMode={viewMode}
              contentStats={{ wordCount: 0, charCount: 0 }}
              token={token}
            />
          )}
          
          {viewMode === "split" && (
            <PanelGroup direction="horizontal" className="h-full w-full">
              <Panel defaultSize={50} minSize={30}>
                <MarkdownEditor
                  doc={doc}
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
                  />
                </div>
              </Panel>
            </PanelGroup>
          )}
        </div>
      </div>
      
      {/* Hidden file input for toolbar upload */}
      <input ref={fileInputRef} {...fileInputProps} />
    </>
  );
}