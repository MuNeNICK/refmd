'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Markdown } from '@/components/markdown/markdown';
import type { ScrapWithPosts } from '@/lib/api/client';

interface ScrapViewerProps {
  scrapData: ScrapWithPosts;
  onPostUpdate?: (postId: string, content: string) => void;
  onPostDelete?: (postId: string) => void;
  currentUserId?: string;
}

export function ScrapViewer({ 
  scrapData, 
  onPostUpdate, 
  onPostDelete,
  currentUserId 
}: ScrapViewerProps) {
  const { scrap, posts } = scrapData;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{scrap.title}</h1>
        <div className="text-sm text-muted-foreground">
          作成日: {formatDistanceToNow(new Date(scrap.created_at), { 
            addSuffix: true, 
            locale: ja 
          })}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              まだ投稿がありません
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {post.author_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">
                        {post.author_name || 'Unknown User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { 
                          addSuffix: true, 
                          locale: ja 
                        })}
                      </span>
                    </div>
                    
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Markdown content={post.content} />
                    </div>

                    {currentUserId === post.author_id && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onPostUpdate?.(post.id, post.content)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => onPostDelete?.(post.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}