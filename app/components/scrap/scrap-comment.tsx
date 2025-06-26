'use client';

import React, { useState, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { Edit2, Trash2, MessageSquare, Eye, Edit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/markdown/markdown';
import { ScrapToolbar } from './scrap-toolbar';
import { applyMarkdownFormat } from '@/lib/utils/markdown-formatting';
import type { ScrapComment } from '@/lib/utils/scrap-comment-parser';

interface ScrapCommentComponentProps {
  comment: ScrapComment;
  currentUserId?: string;
  onUpdate: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}

export function ScrapCommentComponent({
  comment,
  currentUserId,
  onUpdate,
  onDelete,
}: ScrapCommentComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const isOwner = currentUserId === comment.authorId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleUpdate = () => {
    if (editContent.trim()) {
      onUpdate(comment.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditContent(comment.content);
    setIsEditing(false);
    setIsPreviewMode(false);
  };

  // Apply markdown formatting
  const handleMarkdownFormat = useCallback((format: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editContent.substring(start, end);
    
    const result = applyMarkdownFormat(format, selectedText);
    if (!result) return;
    
    const { formattedText, cursorOffset } = result;
    const newContent = editContent.substring(0, start) + formattedText + editContent.substring(end);
    setEditContent(newContent);
    
    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
      } else {
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }
    }, 0);
  }, [editContent]);

  return (
    <div className="pl-4 border-l-4 border-muted-foreground/20">
      <div className="rounded-r p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <AuthorAvatar name={comment.authorName} username={null} className="h-5 w-5" />
            <span className="font-medium">{comment.authorName || 'Unknown'}</span>
            <span>•</span>
            <time dateTime={comment.createdAt} suppressHydrationWarning>
              {typeof window !== 'undefined' ? (() => {
                try {
                  const date = new Date(comment.createdAt);
                  if (isNaN(date.getTime())) {
                    return 'Date unknown';
                  }
                  return formatDistanceToNow(date, {
                    addSuffix: true,
                  });
                } catch {
                  return 'Date unknown';
                }
              })() : ''}
            </time>
            {comment.updatedAt && (
              <>
                <span>•</span>
                <span>Edited</span>
              </>
            )}
          </div>

          {isOwner && !isEditing && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            {/* Mode toggle buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={!isPreviewMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsPreviewMode(false)}
                className="h-6 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                Write
              </Button>
              <Button
                type="button"
                variant={isPreviewMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsPreviewMode(true)}
                className="h-6 px-2 text-xs"
                disabled={!editContent.trim()}
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Button>
            </div>

            {/* Toolbar */}
            {!isPreviewMode && (
              <div className="mb-2">
                <ScrapToolbar
                  onFormatClick={handleMarkdownFormat}
                  showFileUpload={false}
                />
              </div>
            )}

            {/* Content area */}
            {!isPreviewMode ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] text-sm"
                placeholder="Edit comment..."
                autoFocus
              />
            ) : (
              <div className="min-h-[60px] p-2 rounded-md border bg-muted/20">
                {editContent.trim() ? (
                  <div className="prose prose-sm max-w-none">
                    <Markdown content={editContent} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nothing to preview</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleUpdate}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <Markdown content={comment.content} />
          </div>
        )}
      </div>
    </div>
  );
}

interface AddCommentFormProps {
  onSubmit: (content: string) => void;
  isLoading?: boolean;
}

export function AddCommentForm({ onSubmit, isLoading }: AddCommentFormProps) {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
      setIsExpanded(false);
      setIsPreviewMode(false);
    }
  };

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
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
      } else {
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }
    }, 0);
  }, [content]);

  if (!isExpanded) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-muted/50"
          onClick={() => setIsExpanded(true)}
        >
          <MessageSquare className="h-3 w-3 mr-2" />
          Add comment
        </Button>
      </div>
    );
  }

  return (
    <div className="pl-4 border-l-4 border-muted-foreground/20">
      <div className="rounded p-3 space-y-2">
        {/* Mode toggle buttons */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={!isPreviewMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            className="h-6 px-2 text-xs"
          >
            <Edit className="h-3 w-3 mr-1" />
            Write
          </Button>
          <Button
            type="button"
            variant={isPreviewMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
            className="h-6 px-2 text-xs"
            disabled={!content.trim()}
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
        </div>

        {/* Toolbar */}
        {!isPreviewMode && (
          <div className="mb-2">
            <ScrapToolbar
              onFormatClick={handleMarkdownFormat}
              showFileUpload={false}
            />
          </div>
        )}

        {/* Content area */}
        {!isPreviewMode ? (
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter comment..."
            className="min-h-[80px] bg-background"
            autoFocus
          />
        ) : (
          <div className="min-h-[80px] p-2 rounded-md border bg-muted/20">
            {content.trim() ? (
              <div className="prose prose-sm max-w-none">
                <Markdown content={content} />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing to preview</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setContent('');
              setIsExpanded(false);
              setIsPreviewMode(false);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || isLoading}
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}