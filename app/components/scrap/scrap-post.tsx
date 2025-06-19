'use client';

import React, { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit2, Trash2, MessageSquare, Pin } from 'lucide-react';
import { ScrapPostForm } from './scrap-post-form';
import { ScrapMarkdown } from './scrap-markdown';
import { ScrapCommentComponent, AddCommentForm } from './scrap-comment';
import { ScrapCommentParser } from '@/lib/utils/scrap-comment-parser';
import { ScrapMetadataParser } from '@/lib/utils/scrap-metadata-parser';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import type { ScrapPost } from '@/lib/api/client';

interface ScrapPostComponentProps {
  post: ScrapPost;
  currentUserId?: string;
  currentUserName?: string;
  onUpdate: (postId: string, content: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
  scrapId: string; // The scrap/document ID
}

export function ScrapPostComponent({
  post,
  currentUserId,
  currentUserName,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
  scrapId,
}: ScrapPostComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isOwner = currentUserId === post.author_id;
  const canEdit = !!currentUserId; // Can edit if authenticated

  // First parse metadata from the original content
  const { content: contentWithoutMetadata, metadata } = useMemo(
    () => ScrapMetadataParser.parseMetadata(post.content),
    [post.content]
  );

  // Then parse comments from the content without metadata
  const { content: cleanContent, comments } = useMemo(
    () => ScrapCommentParser.parseComments(contentWithoutMetadata),
    [contentWithoutMetadata]
  );

  const isPinned = metadata.isPinned || false;

  const handleUpdate = async (content: string) => {
    // Extract existing metadata and comments from the original content
    const { metadata } = ScrapMetadataParser.parseMetadata(post.content);
    const { comments } = ScrapCommentParser.parseComments(post.content);
    
    // Rebuild content with metadata, new post content, and existing comments
    let updatedContent = content;
    
    // Re-add metadata if it exists
    if (metadata.isPinned && metadata.pinnedBy) {
      updatedContent = ScrapMetadataParser.addPinMetadata(
        updatedContent, 
        metadata.pinnedBy // Already contains just the userId
      );
    }
    
    // Re-add all existing comments
    comments.forEach(comment => {
      updatedContent = ScrapCommentParser.addComment(updatedContent, {
        authorId: comment.authorId,
        authorName: comment.authorName,
        content: comment.content,
        updatedAt: comment.updatedAt,
      }, comment.id, comment.createdAt);
    });
    
    await onUpdate(post.id, updatedContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleTogglePin = async () => {
    if (!currentUserId) return;
    
    // Always work with the current post content to avoid stale data
    const currentIsPinned = ScrapMetadataParser.isPinned(post.content);
    let updatedContent = post.content;
    
    if (currentIsPinned) {
      // Remove pin metadata
      updatedContent = ScrapMetadataParser.removePinMetadata(updatedContent);
    } else {
      // Add pin metadata (only pass userId)
      updatedContent = ScrapMetadataParser.addPinMetadata(updatedContent, currentUserId);
    }
    
    await onUpdate(post.id, updatedContent);
  };

  const handleAddComment = async (content: string) => {
    if (!currentUserId || !currentUserName) return;
    
    const updatedContent = ScrapCommentParser.addComment(post.content, {
      authorId: currentUserId,
      authorName: currentUserName,
      content,
    });
    
    await onUpdate(post.id, updatedContent);
  };

  const handleUpdateComment = async (commentId: string, newContent: string) => {
    const updatedContent = ScrapCommentParser.updateComment(
      post.content,
      commentId,
      newContent
    );
    
    await onUpdate(post.id, updatedContent);
  };

  const handleDeleteComment = async (commentId: string) => {
    const updatedContent = ScrapCommentParser.deleteComment(post.content, commentId);
    await onUpdate(post.id, updatedContent);
  };

  return (
    <Card className={`p-3 sm:p-4 shadow-none ${isPinned ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPinned && (
            <Pin className="h-4 w-4 text-primary fill-current" />
          )}
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {post.author_name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{post.author_name || 'Unknown'}</span>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">•</span>
              <time dateTime={post.created_at} suppressHydrationWarning>
                {typeof window !== 'undefined' ? formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true
                }) : ''}
              </time>
              {post.updated_at && post.updated_at !== post.created_at && (
                <>
                  <span>•</span>
                  <span className="text-xs">Edited</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {comments.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              {comments.length}
            </Button>
          )}
          {/* Pin button - available to all authenticated users */}
          {canEdit && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${isPinned ? 'text-primary' : ''}`}
              onClick={handleTogglePin}
              disabled={isUpdating || isDeleting}
              title={isPinned ? 'Unpin post' : 'Pin post'}
            >
              <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
            </Button>
          )}
          {isOwner && !isEditing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsEditing(true)}
                disabled={isUpdating || isDeleting}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isUpdating || isDeleting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <ScrapPostForm
          initialContent={cleanContent}
          onSubmit={handleUpdate}
          onCancel={handleCancel}
          isLoading={isUpdating}
          documentId={scrapId}
          autoFocus
        />
      ) : (
        <>
          <div className="prose prose-sm max-w-none w-full">
            <ScrapMarkdown 
              content={cleanContent} 
              documentId={scrapId}
            />
          </div>
          
          {showComments && (
            <div className="space-y-2">
              {comments.length > 0 && (
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <ScrapCommentComponent
                      key={comment.id}
                      comment={comment}
                      currentUserId={currentUserId}
                      onUpdate={handleUpdateComment}
                      onDelete={handleDeleteComment}
                    />
                  ))}
                </div>
              )}
              
              {canEdit && (
                <AddCommentForm
                  onSubmit={handleAddComment}
                  isLoading={isUpdating}
                />
              )}
            </div>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="this post"
        description="Are you sure you want to delete this post? All comments will also be deleted. This action cannot be undone."
        onConfirm={() => {
          onDelete(post.id);
          setShowDeleteDialog(false);
        }}
      />
    </Card>
  );
}