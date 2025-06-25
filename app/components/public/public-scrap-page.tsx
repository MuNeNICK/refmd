'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Moon, Sun, Github } from 'lucide-react';
import { ScrapPostComponent } from '@/components/scrap/scrap-post';
import { ScrapMetadataParser } from '@/lib/utils/scrap-metadata-parser';
import type { PublicDocumentResponse } from '@/lib/api/client/models/PublicDocumentResponse';
import type { ScrapPost } from '@/lib/api/client';

interface PublicScrapPageProps {
  document: PublicDocumentResponse;
}

interface ParsedScrapContent {
  posts: ScrapPost[];
}

export function PublicScrapPage({ document: scrapDocument }: PublicScrapPageProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (typeof window !== 'undefined' && document.documentElement) {
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  // Initialize theme from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
      setTheme(savedTheme);
      if (document.documentElement) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      }
    }
  }, []);

  // Parse scrap content into posts
  const scrapData = useMemo(() => {
    if (!scrapDocument.content) {
      return { posts: [] };
    }

    try {
      const parsed = JSON.parse(scrapDocument.content) as ParsedScrapContent;
      return parsed;
    } catch {
      // If parsing fails, return empty posts
      return { posts: [] };
    }
  }, [scrapDocument.content]);

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

  const publishedDate = scrapDocument.published_at ? 
    new Date(scrapDocument.published_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric'
    }) : '';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="https://github.com/MuNeNICK/refmd" target="_blank" rel="noopener noreferrer">
              <Github className="h-5 w-5" />
            </Link>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            <h1 className="text-lg font-semibold">{scrapDocument.title || 'Untitled Scrap'}</h1>
            {scrapDocument.author && (
              <>
                <span className="text-muted-foreground">by</span>
                <Link 
                  href={`/u/${scrapDocument.author.username}`}
                  className="text-primary hover:underline"
                >
                  {scrapDocument.author.name || scrapDocument.author.username}
                </Link>
              </>
            )}
            {publishedDate && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{publishedDate}</span>
              </>
            )}
          </div>
          <div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-6">
        {/* Sort button and Posts header */}
        {scrapData.posts.length > 0 && (
          <div className="flex items-center justify-between mb-4">
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
        <div className="space-y-4">
          {scrapData.posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No posts yet
            </div>
          ) : (
            sortedPosts.map((post) => (
              <ScrapPostComponent
                key={`${post.id}-${post.updated_at}`}
                post={post}
                currentUserId={undefined}
                currentUserName={undefined}
                onUpdate={async () => {}} // Read-only
                onDelete={async () => {}} // Read-only
                isUpdating={false}
                isDeleting={false}
                scrapId={scrapDocument.id || ''}
                isViewOnly={true}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}