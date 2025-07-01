'use client'

import React, { useState, useMemo } from 'react'
import { ScrapWithPosts } from '@/lib/api/client/models/ScrapWithPosts'
import { cn } from '@/lib/utils'
import { ScrapPostComponent } from './scrap-post'
import { ScrapPostFilter } from './scrap-post-filter'
import { Button } from '@/components/ui/button'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { ScrapMetadataParser } from '@/lib/utils/scrap-metadata-parser'

interface ScrapContentViewProps {
  scrapData: ScrapWithPosts
  className?: string
  onNavigate?: (documentId: string, type?: 'document' | 'scrap') => void
  onTagClick?: (tag: string) => void
}

export function ScrapContentView({ scrapData, className, onNavigate, onTagClick }: ScrapContentViewProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  
  // Handle tag click
  const handleTagClick = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag])
    }
    // Also call parent handler if provided
    if (onTagClick) {
      onTagClick(tag)
    }
  }
  
  // Filter and sort posts
  const filteredAndSortedPosts = useMemo(() => {
    let posts = [...scrapData.posts]
    
    // Filter by tags if any are selected
    if (selectedTags.length > 0) {
      posts = posts.filter(post => {
        const postTags = post.tags || []
        // Show post if it has any of the selected tags
        return selectedTags.some(selectedTag => 
          postTags.some(postTag => 
            postTag.toLowerCase() === selectedTag.toLowerCase()
          )
        )
      })
    }
    
    // Sort posts and pin pinned posts to the top
    return posts.sort((a, b) => {
      // Check if posts are pinned
      const aIsPinned = ScrapMetadataParser.isPinned(a.content)
      const bIsPinned = ScrapMetadataParser.isPinned(b.content)
      
      // Pinned posts always come first
      if (aIsPinned && !bIsPinned) return -1
      if (!aIsPinned && bIsPinned) return 1
      
      // Otherwise sort by date
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })
  }, [scrapData.posts, sortOrder, selectedTags])

  // Dummy handlers for view-only mode
  const handleUpdate = async () => {
    // No-op in view-only mode
  }
  
  const handleDelete = async () => {
    // No-op in view-only mode
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto w-full p-3 sm:p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">{scrapData.scrap.title}</h1>
            
            {/* Filter and sort controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedTags.length > 0 ? (
                    <>
                      {filteredAndSortedPosts.length} of {scrapData.posts.length} posts
                      {selectedTags.length > 0 && (
                        <span className="ml-1">(filtered by tags)</span>
                      )}
                    </>
                  ) : (
                    <>
                      {scrapData.posts.length} {scrapData.posts.length === 1 ? 'post' : 'posts'}
                    </>
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="h-8"
                >
                  {sortOrder === 'desc' ? (
                    <>
                      <ArrowDown className="h-4 w-4 mr-1" />
                      Newest first
                    </>
                  ) : (
                    <>
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Oldest first
                    </>
                  )}
                </Button>
              </div>
              
              {/* Tag Filter */}
              <ScrapPostFilter
                selectedTags={selectedTags}
                onSelectedTagsChange={setSelectedTags}
                onClearFilters={() => setSelectedTags([])}
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
              />
            </div>
          </div>
          
          {/* Posts */}
          <div className="space-y-4 pb-6">
            {filteredAndSortedPosts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {selectedTags.length > 0 ? (
                  <>
                    No posts found with the selected tags.
                    <br />
                    <Button 
                      variant="link" 
                      className="mt-2 h-auto p-0" 
                      onClick={() => setSelectedTags([])}
                    >
                      Clear filters to see all posts
                    </Button>
                  </>
                ) : (
                  'No posts yet'
                )}
              </div>
            ) : (
              filteredAndSortedPosts.map((post) => (
                <ScrapPostComponent
                  key={post.id}
                  post={post}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  scrapId={scrapData.scrap.id}
                  isViewOnly={true}
                  onNavigate={onNavigate}
                  onTagClick={handleTagClick}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}