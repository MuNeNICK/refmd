'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Github } from 'lucide-react';
import { ScrapPostComponent } from '@/components/scrap/scrap-post';
import type { PublicDocumentResponse } from '@/lib/api/client/models/PublicDocumentResponse';
import type { ScrapPost } from '@/lib/api/client';
import { PublicPageLayout } from './PublicPageLayout';
import { formatPublicDate } from '@/lib/utils/date';

interface PublicScrapPageProps {
  document: PublicDocumentResponse;
}

interface ParsedScrapContent {
  posts: ScrapPost[];
}

export function PublicScrapPage({ document: scrapDocument }: PublicScrapPageProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Parse scrap content into posts
  const scrapData = useMemo(() => {
    if (!scrapDocument.content) {
      return { posts: [] };
    }

    try {
      const parsed = JSON.parse(scrapDocument.content) as ParsedScrapContent;
      return parsed;
    } catch (e) {
      console.error('Failed to parse scrap content:', e);
      return { posts: [] };
    }
  }, [scrapDocument.content]);


  // Sort posts
  const sortedPosts = useMemo(() => {
    const posts = [...scrapData.posts];
    posts.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return posts;
  }, [scrapData.posts, sortOrder]);

  // Format dates
  const publishedDate = scrapDocument.published_at ? formatPublicDate(scrapDocument.published_at) : '';
  const updatedDate = scrapDocument.updated_at ? formatPublicDate(scrapDocument.updated_at) : '';

  return (
    <PublicPageLayout 
      pageType="scrap"
      title={scrapDocument.title}
      author={scrapDocument.author}
      publishedDate={publishedDate}
      updatedDate={updatedDate}
    >

      {/* Controls */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {sortedPosts.length} posts
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="gap-2"
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowUp className="h-4 w-4" />
                Oldest first
              </>
            ) : (
              <>
                <ArrowDown className="h-4 w-4" />
                Newest first
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-8">
        <div className="space-y-4">
          {sortedPosts.map((post) => (
            <ScrapPostComponent
              key={post.id}
              post={post}
              scrapId={scrapDocument.id || ''}
              isViewOnly={true}
              onUpdate={async () => {}}
              onDelete={async () => {}}
            />
          ))}
        </div>
      </div>

      {/* GitHub Link */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-8">
        <div className="text-center">
          <Button variant="outline" asChild>
            <Link 
              href="https://github.com/yourusername/yourrepo" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gap-2"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>
    </PublicPageLayout>
  );
}