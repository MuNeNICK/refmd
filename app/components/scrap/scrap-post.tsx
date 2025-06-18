'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { ScrapPostForm } from './scrap-post-form';
import { Markdown } from '@/components/markdown/markdown';
import type { ScrapPost } from '@/lib/api/client';

interface ScrapPostComponentProps {
  post: ScrapPost;
  currentUserId?: string;
  onUpdate: (postId: string, content: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function ScrapPostComponent({
  post,
  currentUserId,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: ScrapPostComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const isOwner = currentUserId === post.author_id;

  const handleUpdate = async (content: string) => {
    await onUpdate(post.id, content);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            {post.author_name?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{post.author_name || 'Unknown'}</span>
              <span>•</span>
              <time dateTime={post.created_at}>
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: ja,
                })}
              </time>
              {post.updated_at && post.updated_at !== post.created_at && (
                <>
                  <span>•</span>
                  <span className="text-xs">編集済み</span>
                </>
              )}
            </div>
            
            {isOwner && !isEditing && (
              <div className="flex items-center gap-1">
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
                  onClick={() => onDelete(post.id)}
                  disabled={isUpdating || isDeleting}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          {isEditing ? (
            <ScrapPostForm
              initialContent={post.content}
              onSubmit={handleUpdate}
              onCancel={handleCancel}
              isLoading={isUpdating}
              autoFocus
            />
          ) : (
            <div className="prose prose-sm max-w-none">
              <Markdown content={post.content} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}