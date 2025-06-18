'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefMDClient, type ScrapWithPosts, type ScrapPost } from '@/lib/api/client';
import MainLayout from '@/components/layout/main-layout';
import { ScrapViewer } from '@/components/scrap/scrap-viewer';
import { ScrapPostForm } from '@/components/scrap/scrap-post-form';
import { ScrapPostComponent } from '@/components/scrap/scrap-post';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/authContext';
import { getApiClient } from '@/lib/api';

interface ScrapPageClientProps {
  initialData: ScrapWithPosts;
  scrapId: string;
}

export function ScrapPageClient({ initialData, scrapId }: ScrapPageClientProps) {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [scrapData, setScrapData] = useState<ScrapWithPosts>(initialData);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Create API client with current access token
  const client = useMemo(() => {
    if (!accessToken) {
      return getApiClient();
    }
    return new RefMDClient({
      BASE: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
      TOKEN: accessToken,
    });
  }, [accessToken]);
  
  // Debug log
  useEffect(() => {
    console.log('ScrapPageClient mounted', {
      scrapId,
      user,
      initialData,
      hasAccessToken: !!accessToken,
    });
  }, [scrapId, user, initialData, accessToken]);

  // リアルタイム更新用（後で実装）
  useEffect(() => {
    // TODO: WebSocket接続でリアルタイム更新を実装
  }, [scrapId]);

  const handleAddPost = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const newPost = await client.scraps.createScrapPost(scrapId, { content });
      setScrapData(prev => ({
        ...prev,
        posts: [...prev.posts, newPost]
      }));
      setIsAddingPost(false);
      toast.success('投稿を追加しました');
    } catch (error) {
      console.error('Failed to add post:', error);
      toast.error('投稿の追加に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePost = async (postId: string, content: string) => {
    if (!content.trim() || editingPostId) return;

    setEditingPostId(postId);
    try {
      const updatedPost = await client.scraps.updateScrapPost(scrapId, postId, { content });
      setScrapData(prev => ({
        ...prev,
        posts: prev.posts.map(post => 
          post.id === postId ? updatedPost : post
        )
      }));
      toast.success('投稿を更新しました');
    } catch (error) {
      console.error('Failed to update post:', error);
      toast.error('投稿の更新に失敗しました');
    } finally {
      setEditingPostId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (deletingPostId || !window.confirm('この投稿を削除しますか？')) return;

    setDeletingPostId(postId);
    try {
      await client.scraps.deleteScrapPost(scrapId, postId);
      setScrapData(prev => ({
        ...prev,
        posts: prev.posts.filter(post => post.id !== postId)
      }));
      toast.success('投稿を削除しました');
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast.error('投稿の削除に失敗しました');
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <MainLayout
      documentTitle={scrapData.scrap.title}
      selectedDocumentId={scrapId}
      showEditorFeatures={false}
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-6">
          <div className="space-y-4 pb-6">
            {/* Posts */}
            {scrapData.posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                まだ投稿がありません
              </div>
            ) : (
              scrapData.posts.map((post) => (
                <ScrapPostComponent
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  onUpdate={handleUpdatePost}
                  onDelete={handleDeletePost}
                  isUpdating={editingPostId === post.id}
                  isDeleting={deletingPostId === post.id}
                />
              ))
            )}

            {/* Add post form */}
            {isAddingPost ? (
              <ScrapPostForm
                onSubmit={handleAddPost}
                onCancel={() => setIsAddingPost(false)}
                isLoading={isLoading}
                placeholder="新しい投稿を入力..."
              />
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAddingPost(true)}
              >
                投稿を追加
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}