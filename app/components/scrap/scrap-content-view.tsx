'use client'

import React, { useState, useMemo } from 'react'
import { ScrapWithPosts } from '@/lib/api/client/models/ScrapWithPosts'
import { cn } from '@/lib/utils'
import { ScrapPostComponent } from './scrap-post'
import { Button } from '@/components/ui/button'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { ScrapMetadataParser } from '@/lib/utils/scrap-metadata-parser'

interface ScrapContentViewProps {
  scrapData: ScrapWithPosts
  className?: string
  onNavigate?: (documentId: string, type?: 'document' | 'scrap') => void
}

export function ScrapContentView({ scrapData, className, onNavigate }: ScrapContentViewProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Sort posts and pin pinned posts to the top
  const sortedPosts = useMemo(() => {
    return [...scrapData.posts].sort((a, b) => {
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
  }, [scrapData.posts, sortOrder])

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
            
            {/* Sort controls */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {scrapData.posts.length} {scrapData.posts.length === 1 ? 'post' : 'posts'}
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
          </div>
          
          {/* Posts */}
          <div className="space-y-4 pb-6">
            {sortedPosts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No posts yet
              </div>
            ) : (
              sortedPosts.map((post) => (
                <ScrapPostComponent
                  key={post.id}
                  post={post}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  scrapId={scrapData.scrap.id}
                  isViewOnly={true}
                  onNavigate={onNavigate}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}