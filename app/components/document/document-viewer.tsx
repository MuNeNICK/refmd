"use client";

import React from "react";
import DocumentEditor from "@/app/document/[id]/document-editor";
import { ViewMode } from "@/components/layout/header";
import type { Document } from '@/lib/api/client/models/Document';

interface DocumentViewerProps {
  content: string;
  viewMode: ViewMode;
  documentId: string;
  token?: string;
  onRealtimeStatusChange?: (status: { isConnected: boolean; userCount: number; permission?: string | null }) => void;
}

export function DocumentViewer({
  content,
  viewMode,
  documentId,
  token,
  onRealtimeStatusChange
}: DocumentViewerProps) {
  // Create a minimal document object for DocumentEditor
  const initialDocument: Document = {
    id: documentId,
    title: '',
    content: content,
    owner_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    parent_id: null,
    file_path: null
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <DocumentEditor 
          documentId={documentId}
          initialDocument={initialDocument}
          token={token}
          viewMode={viewMode}
          onConnectionStatusChange={(connected) => {
            onRealtimeStatusChange?.({ 
              isConnected: connected, 
              userCount: 1,
              permission: 'viewer'
            });
          }}
          onActiveUsersChange={(count) => {
            onRealtimeStatusChange?.({ 
              isConnected: true, 
              userCount: count,
              permission: 'viewer'
            });
          }}
        />
      </div>
    </div>
  );
}