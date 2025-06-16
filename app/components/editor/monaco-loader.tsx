'use client';

import React, { lazy, Suspense } from 'react';
import type { MarkdownEditorProps } from './markdown-editor';

// Dynamically import the editor component
const MarkdownEditor = lazy(() => 
  import('./markdown-editor').then(module => ({ 
    default: module.MarkdownEditor 
  }))
);

// Loading component
function EditorSkeleton() {
  return (
    <div className="h-full bg-background dark:bg-[#1e1e1e] relative flex flex-col">
      <div className="h-10 border-b bg-muted/30" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading editor...</div>
      </div>
    </div>
  );
}

export function MonacoLoader(props: MarkdownEditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <MarkdownEditor {...props} />
    </Suspense>
  );
}