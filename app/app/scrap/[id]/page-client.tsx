'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { ScrapWithPosts, ScrapPost } from '@/lib/api/client';
import { Scrap } from '@/lib/api/client';
import MainLayout from '@/components/layout/main-layout';
import { ScrapPostForm } from '@/components/scrap/scrap-post-form';
import { ScrapPostComponent } from '@/components/scrap/scrap-post';
import { TagSearch } from '@/components/scrap/tag-search';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/authContext';
import { getApiClient } from '@/lib/api';
import { ScrapMetadataParser } from '@/lib/utils/scrap-metadata-parser';
import { ShareDialog } from '@/components/collaboration/share-dialog';
import { useScrapConnection } from '@/lib/hooks/useScrapConnection';
import { useSecondaryViewer } from '@/components/providers/secondary-viewer-provider';
import { SecondaryViewer } from '@/components/document/secondary-viewer';
import { PanelGroup, Panel, PanelResizeHandle } from '@/components/ui/resizable';

interface ScrapPageClientProps {
  initialData: ScrapWithPosts & { permission?: string };
  scrapId: string;
  shareToken?: string;
}

export function ScrapPageClient({ initialData, scrapId, shareToken }: ScrapPageClientProps) {
  useSearchParams();
  const { accessToken, user } = useAuth();
  const [scrapData, setScrapData] = useState<ScrapWithPosts>(initialData);
  // Remove isAddingPost state as form will always be visible
  const [isLoading, setIsLoading] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to newest first
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tagRefreshTrigger, setTagRefreshTrigger] = useState(0);
  
  // Secondary document state
  const {
    secondaryDocumentId,
    secondaryDocumentType,
    showSecondaryViewer,
    setSecondaryDocumentId,
    setSecondaryDocumentType,
    openSecondaryViewer,
    closeSecondaryViewer
  } = useSecondaryViewer();

  // Use the singleton API client with automatic token management
  const client = getApiClient();
  
  // Check permission level from initial data
  const isViewOnly = initialData.permission === 'view';
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    } catch {
      // Failed to refresh scrap data
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
      
      // Refresh tags if post contains hashtags
      if (newPost.tags && newPost.tags.length > 0) {
        setTagRefreshTrigger(prev => prev + 1);
      }
      
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
      
      // Refresh tags if tags have changed
      const oldPost = scrapData.posts.find(p => p.id === postId);
      const tagsChanged = JSON.stringify(oldPost?.tags || []) !== JSON.stringify(updatedPost.tags || []);
      if (tagsChanged) {
        setTagRefreshTrigger(prev => prev + 1);
      }
      
      // Emit real-time event to other connected clients
      emitPostUpdated(updatedPost);
    } catch {
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
      
      // Get the post before deleting to check if it had tags
      const deletedPost = scrapData.posts.find(p => p.id === postId);
      
      setScrapData(prev => ({
        ...prev,
        posts: prev.posts.filter(post => post.id !== postId)
      }));
      toast.success('Post deleted');
      
      // Refresh tags if deleted post had tags
      if (deletedPost?.tags && deletedPost.tags.length > 0) {
        setTagRefreshTrigger(prev => prev + 1);
      }
      
      // Emit real-time event to other connected clients
      emitPostDeleted(postId);
    } catch {
      toast.error('Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  // Filter and sort posts based on the current sort order, pin status, selected tags, and search text
  const filteredAndSortedPosts = useMemo(() => {
    let posts = [...scrapData.posts];
    
    // Filter by search text if provided
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      posts = posts.filter(post => {
        // Search in content
        const contentMatch = post.content.toLowerCase().includes(searchLower);
        // Search in tags (with # prefix)
        const tagMatch = post.tags?.some(tag => 
          tag.toLowerCase().includes(searchLower) || 
          `#${tag}`.toLowerCase().includes(searchLower)
        ) || false;
        return contentMatch || tagMatch;
      });
    }
    
    // Filter by tags if any are selected
    if (selectedTags.length > 0) {
      posts = posts.filter(post => {
        const postTags = post.tags || [];
        // Show post if it has any of the selected tags
        return selectedTags.some(selectedTag => 
          postTags.some(postTag => 
            postTag.toLowerCase() === selectedTag.toLowerCase()
          )
        );
      });
    }
    
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
  }, [scrapData.posts, sortOrder, selectedTags, searchText]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };
  
  const handleTagClick = useCallback((tag: string) => {
    // Navigate to the search page for this tag
    window.location.href = `/search?tag=${encodeURIComponent(tag)}`;
  }, []);
  
  const handleOpenDocumentInSecondary = useCallback((docId: string, type: 'document' | 'scrap' = 'document') => {
    openSecondaryViewer(docId, type);
  }, [openSecondaryViewer]);

  // Show only SecondaryDocumentViewer in full screen on mobile when enabled
  if (isMobile && showSecondaryViewer) {
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
        onOpenDocumentInSecondary={handleOpenDocumentInSecondary}
      >
        <div className="h-full w-full bg-background">
          <SecondaryViewer 
            documentId={secondaryDocumentId}
            documentType={secondaryDocumentType}
            className="h-full" 
            onClose={closeSecondaryViewer}
            onDocumentChange={(id, type) => {
              setSecondaryDocumentId(id);
              if (type) setSecondaryDocumentType(type);
            }}
          />
        </div>
      </MainLayout>
    );
  }

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
      onOpenDocumentInSecondary={handleOpenDocumentInSecondary}
    >
      {showSecondaryViewer ? (
        <PanelGroup direction="horizontal" className="h-full w-full">
          <Panel defaultSize={50} minSize={30}>
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="max-w-6xl mx-auto w-full p-3 sm:p-6">
                <div className="flex gap-6">
                  {/* Posts column */}
                  <div className="flex-1 space-y-4">
                    {/* Add post form - only visible if not view-only */}
                    {!isViewOnly && (
                      <ScrapPostForm
                        onSubmit={handleAddPost}
                        isLoading={isLoading}
                        placeholder="Enter a new post..."
                        documentId={scrapData.scrap.id}
                      />
                    )}

                    {/* Filter and Sort Controls */}
                    {scrapData.posts.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {(selectedTags.length > 0 || searchText) ? (
                              <>
                                {filteredAndSortedPosts.length} of {scrapData.posts.length} posts
                                {(selectedTags.length > 0 || searchText) && (
                                  <span className="ml-1">(filtered)</span>
                                )}
                              </>
                            ) : (
                              <>
                                {scrapData.posts.length} {scrapData.posts.length === 1 ? 'post' : 'posts'}
                              </>
                            )}
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
                      </div>
                    )}

                    {/* Posts */}
                    {filteredAndSortedPosts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {(selectedTags.length > 0 || searchText) ? (
                          <>
                            No posts found with the selected tags.
                            <br />
                            <Button 
                              variant="link" 
                              className="mt-2 h-auto p-0" 
                              onClick={() => {
                                setSelectedTags([]);
                                setSearchText('');
                              }}
                            >
                              Clear filters to see all posts
                            </Button>
                          </>
                        ) : scrapData.posts.length === 0 ? (
                          'No posts yet'
                        ) : (
                          'No posts match the current filter'
                        )}
                      </div>
                    ) : (
                      filteredAndSortedPosts.map((post) => (
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
                          isViewOnly={isViewOnly}
                          onNavigate={handleOpenDocumentInSecondary}
                        />
                      ))
                    )}
                  </div>
                  
                  {/* Search and tags column - Sticky */}
                  <div className="w-72 hidden lg:block">
                    <div className="sticky top-6 space-y-6">
                      {/* Search Section */}
                      <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search memos..."
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          className="pl-9 pr-8 bg-muted/50"
                        />
                        {searchText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSearchText('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Tags Section */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</h3>
                      <TagSearch
                        selectedTags={selectedTags}
                        onSelectedTagsChange={setSelectedTags}
                        showPopular={true}
                        scrapId={scrapId}
                        refreshTrigger={tagRefreshTrigger}
                      />
                    </div>
                    
                    {/* Filter Stats */}
                    {(selectedTags.length > 0 || searchText) && (
                      <div className="pt-3">
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {filteredAndSortedPosts.length} / {scrapData.posts.length} memos
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTags([]);
                              setSearchText('');
                            }}
                            className="w-full text-xs"
                          >
                            Clear filters
                          </Button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />
          <Panel defaultSize={50} minSize={20} maxSize={70}>
            <SecondaryViewer 
              documentId={secondaryDocumentId}
              documentType={secondaryDocumentType}
              className="h-full" 
              onClose={closeSecondaryViewer}
              onDocumentChange={(id, type) => {
                setSecondaryDocumentId(id);
                if (type) setSecondaryDocumentType(type);
              }}
            />
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full p-3 sm:p-6">
            <div className="flex gap-6">
              {/* Posts column */}
              <div className="flex-1 space-y-4 min-w-0">
                {/* Add post form - only visible if not view-only */}
                {!isViewOnly && (
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
                      {(selectedTags.length > 0 || searchText) ? (
                        <>
                          {filteredAndSortedPosts.length} of {scrapData.posts.length} posts
                          <span className="ml-1">(filtered)</span>
                        </>
                      ) : (
                        <>
                          {scrapData.posts.length} {scrapData.posts.length === 1 ? 'post' : 'posts'}
                        </>
                      )}
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
                {filteredAndSortedPosts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {(selectedTags.length > 0 || searchText) ? (
                      <>
                        No posts found with the selected tags.
                        <br />
                        <Button 
                          variant="link" 
                          className="mt-2 h-auto p-0" 
                          onClick={() => {
                            setSelectedTags([]);
                            setSearchText('');
                          }}
                        >
                          Clear filters to see all posts
                        </Button>
                      </>
                    ) : scrapData.posts.length === 0 ? (
                      'No posts yet'
                    ) : (
                      'No posts match the current filter'
                    )}
                  </div>
                ) : (
                  filteredAndSortedPosts.map((post) => (
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
                      isViewOnly={isViewOnly}
                      onNavigate={handleOpenDocumentInSecondary}
                      onTagClick={handleTagClick}
                    />
                  ))
                )}
              </div>
              
              {/* Search and tags column - Sticky */}
              <div className="w-72 hidden lg:block">
                <div className="sticky top-6 space-y-6">
                  {/* Search Section */}
                  <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search memos..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9 pr-8 bg-muted/50"
                    />
                    {searchText && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchText('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tags Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</h3>
                  <TagSearch
                    selectedTags={selectedTags}
                    onSelectedTagsChange={setSelectedTags}
                    showPopular={true}
                    scrapId={scrapId}
                    refreshTrigger={tagRefreshTrigger}
                  />
                </div>
                
                {/* Filter Stats */}
                {(selectedTags.length > 0 || searchText) && (
                  <div className="pt-3">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {filteredAndSortedPosts.length} / {scrapData.posts.length} memos
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTags([]);
                          setSearchText('');
                        }}
                        className="w-full text-xs"
                      >
                        Clear filters
                      </Button>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Share Dialog */}
      <ShareDialog
        resourceId={scrapId}
        resourceType="scrap"
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        isPublished={scrapData.scrap.visibility === 'public'}
        publicUrl={scrapData.scrap.visibility === 'public' && scrapData.scrap.owner_username 
          ? `/u/${scrapData.scrap.owner_username}/${scrapId}` 
          : ''}
        onPublishChange={(published) => {
          // Update local state
          setScrapData(prev => ({
            ...prev,
            scrap: {
              ...prev.scrap,
              visibility: published ? Scrap.visibility.PUBLIC : Scrap.visibility.PRIVATE,
              published_at: published ? new Date().toISOString() : null,
            }
          }));
        }}
      />
    </MainLayout>
  );
}