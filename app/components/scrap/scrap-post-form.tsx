'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, ImageIcon, Eye, Edit } from 'lucide-react';
import { useFileUpload } from '@/lib/hooks/useFileUpload';
import { useDropzone } from 'react-dropzone';
import { ScrapMarkdown } from './scrap-markdown';
import { ScrapToolbar } from './scrap-toolbar';
import { DocumentLinkDialog } from './document-link-dialog';
import { applyMarkdownFormat } from '@/lib/utils/markdown-formatting';

interface ScrapPostFormProps {
  initialContent?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  submitLabel?: string;
  documentId?: string; // Optional document ID for file association
  autoFocus?: boolean;
}

export function ScrapPostForm({
  initialContent = '',
  onSubmit,
  onCancel,
  isLoading = false,
  placeholder = 'Enter a post...',
  submitLabel = 'Post',
  documentId,
  autoFocus = false
}: ScrapPostFormProps) {
  const [content, setContent] = useState(initialContent);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showDocumentLinkDialog, setShowDocumentLinkDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);


  // Insert text at cursor position
  const insertTextAtCursor = useCallback((text: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + text + content.substring(end);
    
    setContent(newContent);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [content]);

  // Apply markdown formatting
  const handleMarkdownFormat = useCallback((format: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const result = applyMarkdownFormat(format, selectedText);
    if (!result) return;
    
    const { formattedText, cursorOffset } = result;
    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);
    
    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        // If text was selected, place cursor at end of formatted text
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
      } else {
        // If no text selected, place cursor at appropriate position for typing
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }
    }, 0);
  }, [content]);

  // Handle document link insertion
  const handleDocumentLink = useCallback((documentId: string, documentTitle: string) => {
    const linkText = `[[${documentId}]]`;
    insertTextAtCursor(linkText);
    setShowDocumentLinkDialog(false);
  }, [insertTextAtCursor]);

  // File upload hook
  const { handleFileUpload, triggerFileUpload, fileInputRef, fileInputProps } = useFileUpload({
    documentId,
    onInsertText: insertTextAtCursor,
    insertMode: 'batch'
  });

  // Drag and drop hook
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    multiple: true,
    noClick: true, // Don't trigger file dialog on textarea click
    noKeyboard: true // Don't trigger on keyboard events
  });

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  useEffect(() => {
    setIsDragging(isDragActive);
  }, [isDragActive]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !isLoading) {
      onSubmit(content.trim());
      if (!initialContent) {
        setContent('');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  // Check for [[ trigger
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Check if user just typed [[
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      if (cursorPos >= 2 && newContent.substring(cursorPos - 2, cursorPos) === '[[') {
        setShowDocumentLinkDialog(true);
      }
    }
  };

  return (
    <Card className="p-3 sm:p-4 shadow-none">
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {/* Mode toggle buttons */}
          <div className="flex items-center gap-1 border-b pb-2">
            <Button
              type="button"
              variant={!isPreviewMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsPreviewMode(false)}
              className="h-7 px-2 text-xs"
            >
              <Edit className="h-3 w-3 mr-1" />
              Write
            </Button>
            <Button
              type="button"
              variant={isPreviewMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsPreviewMode(true)}
              className="h-7 px-2 text-xs"
              disabled={!content.trim()}
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
          </div>

          {/* Content area */}
          {!isPreviewMode ? (
            <div 
              {...getRootProps()} 
              className={`relative ${isDragging ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            >
              <input {...getInputProps()} />
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="min-h-[100px] resize-none"
                disabled={isLoading}
              />
              {isDragging && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-md">
                  <div className="text-center">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Drop to upload files</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-[100px] p-3 rounded-md border bg-muted/20">
              {content.trim() ? (
                <div className="prose prose-sm max-w-none w-full">
                  <ScrapMarkdown content={content} documentId={documentId} />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nothing to preview</p>
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              {!isPreviewMode && (
                <ScrapToolbar
                  onFormatClick={handleMarkdownFormat}
                  onFileUpload={triggerFileUpload}
                  onDocumentLink={() => setShowDocumentLinkDialog(true)}
                  disabled={isLoading}
                />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!isPreviewMode && (
                <div className="text-xs text-muted-foreground hidden sm:block">
                  <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Ctrl</kbd>+
                  <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Enter</kbd> to send
                </div>
              )}
              
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              
              <Button
                type="submit"
                size="sm"
                disabled={!content.trim() || isLoading}
              >
                {isLoading ? 'Sending...' : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </form>
      <input ref={fileInputRef} {...fileInputProps} />
      
      <DocumentLinkDialog
        open={showDocumentLinkDialog}
        onOpenChange={setShowDocumentLinkDialog}
        onSelectDocument={handleDocumentLink}
      />
    </Card>
  );
}