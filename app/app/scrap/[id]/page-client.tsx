'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { ScrapWithPosts } from '@/lib/api/client';
import MainLayout from '@/components/layout/main-layout';
import { ScrapPostForm } from '@/components/scrap/scrap-post-form';
import { ScrapPostComponent } from '@/components/scrap/scrap-post';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '@/lib/auth/authContext';
import { getApiClient } from '@/lib/api';
import { ScrapMetadataParser } from '@/lib/utils/scrap-metadata-parser';
import { ShareDialog } from '@/components/collaboration/share-dialog';
import { useScrapConnection } from '@/lib/hooks/useScrapConnection';

interface ScrapPageClientProps {
  initialData: ScrapWithPosts;
  scrapId: string;
}

export function ScrapPageClient({ initialData, scrapId }: ScrapPageClientProps) {
  const searchParams = useSearchParams();
  const { accessToken, user } = useAuth();
  const [scrapData, setScrapData] = useState<ScrapWithPosts>(initialData);
  // Remove isAddingPost state as form will always be visible
  const [isLoading, setIsLoading] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to newest first
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [userCount, setUserCount] = useState(0);

  // Use the singleton API client with automatic token management
  const client = getApiClient();
  
  // Check if accessing via share token
  const shareToken = searchParams.get('token');
  // For now, allow editing if there's a share token (backend will validate permissions)
  // In a production app, you might want to fetch the actual permission level
  const isViewOnly = false;
  

  // Refresh data from server
  const refreshScrapData = useCallback(async () => {
    try {
      let data;
      if (shareToken) {
        const response = await fetch(`${client.request.config.BASE}/scraps/${scrapId}?token=${shareToken}`, {
          headers: {
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
          }
        });
        if (!response.ok) throw new Error('Failed to fetch scrap');
        data = await response.json();
      } else {
        data = await client.scraps.getScrap(scrapId);
      }
      setScrapData(data);
    } catch (error) {
      console.error('Failed to refresh scrap data:', error);
    }
  }, [scrapId, shareToken, accessToken, client]);

  // Handle real-time post events
  const handlePostAdded = useCallback((post: ScrapPost) => {
    setScrapData(prev => ({
      ...prev,
      posts: [...prev.posts, post]
    }));
  }, []);

  const handlePostUpdated = useCallback((post: ScrapPost) => {
    setScrapData(prev => ({
      ...prev,
      posts: prev.posts.map(p => p.id === post.id ? post : p)
    }));
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    setScrapData(prev => ({
      ...prev,
      posts: prev.posts.filter(p => p.id !== postId)
    }));
  }, []);

  const handleUserCountChanged = useCallback((count: number) => {
    setUserCount(count);
  }, []);

  // Real-time updates with Socket.IO
  const { 
    connectionError, 
    isConnected, 
    socketConnected,
    emitPostAdded,
    emitPostUpdated,
    emitPostDeleted 
  } = useScrapConnection({
    scrapId,
    shareToken: shareToken || undefined,
    onPostAdded: handlePostAdded,
    onPostUpdated: handlePostUpdated,
    onPostDeleted: handlePostDeleted,
    onContentUpdate: refreshScrapData,
    onUserCountChanged: handleUserCountChanged
  });


  const handleAddPost = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    try {
      let newPost;
      if (shareToken) {
        // Use direct API call with share token
        const response = await fetch(`${client.request.config.BASE}/scraps/${scrapId}/posts?token=${shareToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create post');
        }
        
        newPost = await response.json();
      } else {
        newPost = await client.scraps.createScrapPost(scrapId, { content });
      }
      
      setScrapData(prev => ({
        ...prev,
        posts: [...prev.posts, newPost]
      }));
      // Form stays visible, just clear content
      toast.success('Post added');
      
      // Emit real-time event to other connected clients
      emitPostAdded(newPost);
    } catch (error) {
      console.error('Failed to add post:', error);
      toast.error('Failed to add post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePost = async (postId: string, content: string) => {
    if (!content.trim()) return;

    // Don't set editingPostId for PIN updates
    const isPinUpdate = editingPostId === null;
    if (!isPinUpdate) {
      setEditingPostId(postId);
    }
    
    try {
      let updatedPost;
      if (shareToken) {
        // Use direct API call with share token
        const response = await fetch(`${client.request.config.BASE}/scraps/${scrapId}/posts/${postId}?token=${shareToken}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update post');
        }
        
        updatedPost = await response.json();
      } else {
        updatedPost = await client.scraps.updateScrapPost(scrapId, postId, { content });
      }
      
      setScrapData(prev => ({
        ...prev,
        posts: prev.posts.map(post => 
          post.id === postId ? { ...updatedPost } : post
        )
      }));
      
      if (isPinUpdate) {
        const isNowPinned = ScrapMetadataParser.isPinned(updatedPost.content);
        toast.success(isNowPinned ? 'Post pinned' : 'Post unpinned');
      } else {
        toast.success('Post updated');
      }
      
      // Emit real-time event to other connected clients
      emitPostUpdated(updatedPost);
    } catch (error) {
      console.error('Failed to update post:', error);
      toast.error('Failed to update post');
    } finally {
      if (!isPinUpdate) {
        setEditingPostId(null);
      }
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (deletingPostId) return;

    setDeletingPostId(postId);
    try {
      if (shareToken) {
        // Use direct API call with share token
        const response = await fetch(`${client.request.config.BASE}/scraps/${scrapId}/posts/${postId}?token=${shareToken}`, {
          method: 'DELETE',
          headers: {
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete post');
        }
      } else {
        await client.scraps.deleteScrapPost(scrapId, postId);
      }
      
      setScrapData(prev => ({
        ...prev,
        posts: prev.posts.filter(post => post.id !== postId)
      }));
      toast.success('Post deleted');
      
      // Emit real-time event to other connected clients
      emitPostDeleted(postId);
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast.error('Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  // Sort posts based on the current sort order and pin status
  const sortedPosts = useMemo(() => {
    const posts = [...scrapData.posts];
    return posts.sort((a, b) => {
      // Check if posts are pinned
      const aIsPinned = ScrapMetadataParser.isPinned(a.content);
      const bIsPinned = ScrapMetadataParser.isPinned(b.content);
      
      // Pinned posts always come first
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // If both are pinned or both are not pinned, sort by date
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [scrapData.posts, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  return (
    <MainLayout
      documentTitle={scrapData.scrap.title}
      selectedDocumentId={scrapId}
      showEditorFeatures={false}
      isViewOnly={isViewOnly}
      hideFileTree={!!shareToken}
      isRealtimeConnected={isConnected && !connectionError}
      realtimeUserCount={userCount}
      onShare={!isViewOnly && user ? () => setShareDialogOpen(true) : undefined}
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-6">
          <div className="space-y-4 pb-6">

            {/* Add post form - only visible if authenticated */}
            {!isViewOnly && user && (
              <ScrapPostForm
                onSubmit={handleAddPost}
                isLoading={isLoading}
                placeholder="Enter a new post..."
                documentId={scrapData.scrap.id}
              />
            )}

            {/* Sort button and Posts header */}
            {scrapData.posts.length > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {scrapData.posts.length} {scrapData.posts.length === 1 ? 'post' : 'posts'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSortOrder}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  {sortOrder === 'desc' ? (
                    <>
                      <ArrowDown className="h-3.5 w-3.5 mr-1" />
                      Newest first
                    </>
                  ) : (
                    <>
                      <ArrowUp className="h-3.5 w-3.5 mr-1" />
                      Oldest first
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Posts */}
            {scrapData.posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No posts yet
              </div>
            ) : (
              sortedPosts.map((post) => (
                <ScrapPostComponent
                  key={`${post.id}-${post.updated_at}`}
                  post={post}
                  currentUserId={user?.id}
                  currentUserName={user?.name}
                  onUpdate={handleUpdatePost}
                  onDelete={handleDeletePost}
                  isUpdating={editingPostId === post.id}
                  isDeleting={deletingPostId === post.id}
                  scrapId={scrapId}
                />
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Share Dialog */}
      <ShareDialog
        resourceId={scrapId}
        resourceType="scrap"
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </MainLayout>
  );
}